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
