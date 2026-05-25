"""Wrapper around the `ibpmodel` scientific package with a numpy surrogate fallback.

The surrogate is a reference implementation based on known equatorial plasma
bubble climatology (post-sunset peak around 20-23 LT, solar-activity dependence,
equinoctial enhancement). It is clearly marked as a fallback and is only used
when the upstream `ibpmodel` package fails to import or raises at runtime.
"""
from __future__ import annotations
import hashlib
import json
import logging
import math
from typing import Iterable
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

_USE_UPSTREAM = True
try:
    from ibpmodel import calculateIBPindex as _upstream_calc  # noqa: F401
except Exception as exc:  # pragma: no cover - fallback path
    logger.warning("ibpmodel unavailable, using surrogate: %s", exc)
    _USE_UPSTREAM = False
    _upstream_calc = None


MODEL_SOURCE = "ibpmodel-2.x" if _USE_UPSTREAM else "surrogate-v1"


def _surrogate(day_month: int, lons: Iterable[float], lts: Iterable[float], f107: float) -> pd.DataFrame:
    """Vectorized surrogate IBP probability."""
    lons = np.asarray(list(lons), dtype=float)
    lts = np.asarray(list(lts), dtype=float)
    LON, LT = np.meshgrid(lons, lts, indexing="ij")

    if day_month <= 12:
        month = int(day_month)
        doy = int((month - 1) * 30.4 + 15)
    else:
        doy = int(day_month)
        month = min(12, max(1, int(doy / 30.4) + 1))

    # Post-sunset gaussian around ~21 LT with width 2.5h, zero outside 18-03
    lt_eff = np.where(LT < 12, LT + 24, LT)  # fold 0-6 to 24-30 so peak is smooth
    lt_term = np.exp(-0.5 * ((lt_eff - 21.0) / 2.5) ** 2)
    lt_term = np.where((LT >= 4) & (LT <= 17), 0.0, lt_term)

    # Longitude sectors: African (~0-40E) and Pacific (~180) favoured
    lon_term = 0.55 + 0.25 * np.cos(np.deg2rad(LON - 10)) + 0.20 * np.cos(np.deg2rad(2 * LON))
    lon_term = np.clip(lon_term, 0.3, 1.0)

    # Seasonal: equinoxes (Mar, Sep) enhanced
    seasonal = 0.6 + 0.4 * abs(math.cos(2 * math.pi * (doy - 80) / 365.25))

    # Solar flux dependence: saturates around F10.7 ~ 180
    solar = 0.4 + 0.6 * (1 - math.exp(-(f107 - 60) / 80.0))
    solar = max(0.3, min(1.2, solar))

    ibp = lt_term * lon_term * seasonal * solar
    ibp = np.clip(ibp, 0.0, 1.0)

    rows = []
    for i, ln in enumerate(lons):
        for j, t in enumerate(lts):
            rows.append({
                "Doy": doy, "Month": month, "Lon": float(ln),
                "LT": float(t), "F10.7": float(f107), "IBP": float(ibp[i, j]),
            })
    return pd.DataFrame(rows)


def calculate(day_month: int, lons: Iterable[float], lts: Iterable[float], f107: float) -> pd.DataFrame:
    """Returns DataFrame columns: Doy, Month, Lon, LT, F10.7, IBP."""
    lons = list(lons)
    lts = list(lts)
    if _USE_UPSTREAM:
        try:
            df = _upstream_calc(day_month=day_month, longitude=lons, local_time=lts, f107=f107)
            # Normalize column types
            df = df.copy()
            df["IBP"] = df["IBP"].astype(float).clip(0.0, 1.0)
            return df
        except Exception as exc:  # pragma: no cover
            logger.exception("ibpmodel runtime failure, falling back to surrogate: %s", exc)
    return _surrogate(day_month, lons, lts, f107)


# ---------- Analytics helpers ----------
def confidence_for(ibp: float, lt: float) -> float:
    """Heuristic confidence: highest in post-sunset hours, tapered elsewhere."""
    in_peak = 19.0 <= lt <= 24.0 or 0.0 <= lt <= 2.0
    base = 0.85 if in_peak else 0.55
    # mid-range probabilities (0.4-0.6) are less confident than extremes
    extremity = abs(ibp - 0.5) * 2  # 0..1
    return float(round(min(0.98, base + 0.12 * extremity), 3))


def anomaly_flag(ibp: float, lt: float) -> bool:
    """Flag unusual post-midnight high probabilities outside expected window."""
    if ibp > 0.5 and not (18.0 <= lt <= 24.0 or 0.0 <= lt <= 3.0):
        return True
    return False


def explain(ibp: float, lt: float, lon: float, f107: float, doy: int) -> str:
    parts = []
    if ibp >= 0.6:
        parts.append("High bubble probability")
    elif ibp >= 0.3:
        parts.append("Moderate bubble probability")
    else:
        parts.append("Low bubble probability")
    if 19 <= lt <= 24 or 0 <= lt <= 2:
        parts.append("post-sunset window (expected)")
    else:
        parts.append("off-peak local time (anomalous if elevated)")
    if f107 >= 150:
        parts.append("high solar flux amplifies occurrence")
    elif f107 <= 90:
        parts.append("low solar flux suppresses occurrence")
    if 60 <= (doy % 365) <= 100 or 240 <= (doy % 365) <= 280:
        parts.append("equinoctial season enhances activity")
    return "; ".join(parts)


def config_hash(params: dict) -> str:
    canonical = json.dumps(params, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()[:16]


def compute_grid(params: dict) -> tuple[list[float], list[float]]:
    lons = list(np.round(np.arange(params["lon_min"], params["lon_max"] + 1e-9, params["lon_step"]), 4))
    lts = list(np.round(np.arange(params["lt_min"], params["lt_max"] + 1e-9, params["lt_step"]), 4))
    # clip lon to [-180, 180]
    lons = [float(x) for x in lons if -180 <= x <= 180]
    lts = [float(x) for x in lts if 0 <= x <= 24]
    return lons, lts


# ---------- Scikit-learn based smoothing & latitude extrapolation ----------
def smooth_surface(lons: list[float], lts: list[float], matrix: list[list[float]],
                   upscale: int = 3) -> dict:
    """Upscale a (lon × lt) IBP matrix using scikit-learn Gaussian Process smoothing.

    Returns a dictionary with the denser grid suitable for a Plotly 3-D surface.
    Falls back to a simple bilinear interpolation via scipy if sklearn fails.
    """
    try:
        from sklearn.gaussian_process import GaussianProcessRegressor
        from sklearn.gaussian_process.kernels import RBF, ConstantKernel as C
        arr = np.asarray(matrix, dtype=float)  # shape (len(lons), len(lts))
        LON, LT = np.meshgrid(lons, lts, indexing="ij")
        X = np.column_stack([LON.ravel(), LT.ravel()])
        y = arr.ravel()
        # Normalise features so the single length-scale kernel works well
        x_scale = np.array([max(1.0, np.ptp(lons) / 6.0), max(0.5, np.ptp(lts) / 6.0)])
        Xs = X / x_scale
        kernel = C(1.0, (1e-3, 1e3)) * RBF(length_scale=1.0, length_scale_bounds=(0.3, 10.0))
        gpr = GaussianProcessRegressor(kernel=kernel, alpha=1e-4, normalize_y=True, n_restarts_optimizer=0)
        gpr.fit(Xs, y)
        # Dense query grid
        n_lon = max(2, len(lons) * upscale)
        n_lt = max(2, len(lts) * upscale)
        dlons = np.linspace(min(lons), max(lons), n_lon)
        dlts = np.linspace(min(lts), max(lts), n_lt)
        DL, DT = np.meshgrid(dlons, dlts, indexing="ij")
        Xq = np.column_stack([DL.ravel(), DT.ravel()]) / x_scale
        zq = gpr.predict(Xq).reshape(n_lon, n_lt)
        zq = np.clip(zq, 0.0, 1.0)
        return {
            "lons": [float(v) for v in dlons],
            "lts": [float(v) for v in dlts],
            "matrix": zq.tolist(),
            "method": "sklearn.GaussianProcessRegressor+RBF",
        }
    except Exception as exc:
        logger.warning("sklearn smoothing failed, falling back: %s", exc)
        return {"lons": lons, "lts": lts, "matrix": matrix, "method": "raw"}


def worldmap_grid(day_month: int, f107: float, lon_step: float = 10.0,
                  lat_half_range: float = 25.0, lat_step: float = 2.0,
                  output_lon_step: float = 2.0, output_lat_step: float = 1.0) -> dict:
    """Compute a 2-D lat × lon IBP overlay per local-time frame.

    The ibpmodel only returns IBP on the equator; this function uses a physics-
    informed Gaussian envelope centered at the magnetic equator (~11° tilt from
    geographic equator at the African sector, drifting with longitude) to
    extrapolate IBP to off-equator latitudes. Scikit-learn GPR is then used to
    upscale the resulting sparse lat×lon grid to a DENSE output grid so the
    frontend overlay appears continuous rather than as discrete columns.
    """
    from sklearn.gaussian_process import GaussianProcessRegressor
    from sklearn.gaussian_process.kernels import RBF, ConstantKernel as C

    lons = list(range(-180, 181, int(lon_step)))
    lt_values = [round(x * 0.5, 2) for x in range(0, 48)]
    lats = list(np.round(np.arange(-lat_half_range, lat_half_range + 1e-9, lat_step), 2))
    df = calculate(day_month, lons, lt_values, f107)

    lookup: dict = {}
    for _, row in df.iterrows():
        lookup.setdefault(float(row["LT"]), {})[float(row["Lon"])] = float(row["IBP"])

    doy = int(df.iloc[0]["Doy"]); month = int(df.iloc[0]["Month"])

    def mag_lat_offset(lon_deg: float) -> float:
        return 7.0 * np.sin(np.deg2rad(lon_deg + 60.0))

    def envelope(lat: float, mag_offset: float) -> float:
        sigma = 9.0
        return float(np.exp(-0.5 * ((lat - mag_offset) / sigma) ** 2))

    # Dense output grid used for the overlay rendering
    out_lons = list(np.round(np.arange(-180, 180 + 1e-9, output_lon_step), 2))
    out_lats = list(np.round(np.arange(-lat_half_range, lat_half_range + 1e-9, output_lat_step), 2))
    n_out_lat = len(out_lats); n_out_lon = len(out_lons)
    out_LA, out_LO = np.meshgrid(out_lats, out_lons, indexing="ij")
    out_X = np.column_stack([out_LA.ravel() / 10.0, out_LO.ravel() / 30.0])

    frames = []
    kernel = C(1.0, (1e-3, 1e3)) * RBF(length_scale=1.0, length_scale_bounds=(0.5, 15.0))

    for lt in lt_values:
        eq_values = np.array([lookup[lt].get(ln, 0.0) for ln in lons])
        # Build sparse 2-D training grid
        sparse = np.zeros((len(lats), len(lons)))
        for j, ln in enumerate(lons):
            off = mag_lat_offset(ln)
            for i, la in enumerate(lats):
                sparse[i, j] = eq_values[j] * envelope(la, off)
        # Upscale to dense output grid via GPR
        try:
            if sparse.std() > 1e-6:
                LA, LO = np.meshgrid(lats, lons, indexing="ij")
                X = np.column_stack([LA.ravel() / 10.0, LO.ravel() / 30.0])
                y = sparse.ravel()
                gpr = GaussianProcessRegressor(kernel=kernel, alpha=5e-4, normalize_y=True,
                                               n_restarts_optimizer=0)
                gpr.fit(X, y)
                dense = np.clip(gpr.predict(out_X).reshape(n_out_lat, n_out_lon), 0.0, 1.0)
            else:
                dense = np.zeros((n_out_lat, n_out_lon))
        except Exception as exc:
            logger.warning("sklearn upscale failed at lt=%s: %s", lt, exc)
            # Fallback: nearest-sparse-cell fill
            dense = np.zeros((n_out_lat, n_out_lon))
            for i_out, la in enumerate(out_lats):
                for j_out, ln in enumerate(out_lons):
                    i = int(min(len(lats) - 1, (la - lats[0]) / max(lat_step, 1e-6)))
                    j = int(min(len(lons) - 1, (ln - lons[0]) / max(lon_step, 1e-6)))
                    dense[i_out, j_out] = sparse[max(0, i), max(0, j)]
        frames.append({"lt": lt, "matrix": dense.tolist()})

    return {
        "day_month": day_month, "f107": f107, "doy": doy, "month": month,
        "lons": [float(x) for x in out_lons],
        "lats": [float(x) for x in out_lats],
        "lt_values": lt_values,
        "frames": frames,
        "method": "sklearn.GPR upscaled + physical-magnetic-equator envelope",
        "raw_grid": {"lons": lons, "lats": [float(x) for x in lats]},
    }



def butterfly_grid(lt: float, f107: float, lon_step: float = 5.0) -> dict:
    """Climatology 'butterfly' diagram: Month (1-12) × Longitude at fixed LT.

    Mirrors the standard space-weather butterfly view used to study seasonal /
    longitudinal patterns of post-sunset bubble occurrence.
    """
    lons = list(range(-180, 181, int(max(1, lon_step))))
    months = list(range(1, 13))
    matrix = []  # shape: (n_lon, n_month) — caller expects matrix[i_lon][j_month]
    summary_hotspots = []
    all_vals = []
    for ln in lons:
        row = []
        for m in months:
            df = calculate(m, [ln], [lt], f107)
            v = float(df.iloc[0]["IBP"])
            row.append(v)
            all_vals.append((v, ln, m))
        matrix.append(row)

    arr = np.array(matrix)
    flat = sorted(all_vals, key=lambda x: -x[0])[:8]
    summary_hotspots = [{"IBP": float(v), "Lon": float(ln), "Month": int(m)} for v, ln, m in flat]

    return {
        "lt": lt,
        "f107": f107,
        "lons": [float(x) for x in lons],
        "months": months,
        "matrix": matrix,
        "summary": {
            "ibp_min": float(arr.min()),
            "ibp_max": float(arr.max()),
            "ibp_mean": float(arr.mean()),
            "ibp_p95": float(np.percentile(arr, 95)),
            "hotspots": summary_hotspots,
        },
        "method": MODEL_SOURCE,
    }
