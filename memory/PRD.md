# IBP Analytics Platform — Product Requirements (living doc)

## Original Problem Statement
A scalable, production-ready, scientifically rigorous full-stack platform for the
**Ionospheric Bubble Probability (IBP)** model. Simultaneously support reproducible
scientific research, high-performance simulations, and a clear upgrade path to SaaS
commercialization. Target users: space-weather researchers, satellite mission
operators, GNSS/telecom engineers, aviation stakeholders.

## Architecture (current MVP)
- **Backend**: FastAPI (async) + Motor/MongoDB. Modular routers under `/app/backend/app/`.
- **Scientific core**: Real `ibpmodel` v2.0.2 PyPI package (model_source reported at `/api/ibp/meta`), with vectorized NumPy surrogate fallback (`surrogate-v1`) if the package fails to import.
- **Compute layer**: FastAPI `BackgroundTasks` with MongoDB-backed job lifecycle (PENDING → RUNNING → COMPLETED / FAILED). Roadmap calls for Celery/Ray migration.
- **Auth**: JWT bearer tokens (24h), bcrypt hashing. Roles: `researcher`, `pro`, `admin`. Admin seeded on startup from env.
- **SaaS hooks**: API keys (SHA-256 hashed, last-used tracking, call counter, revoke); in-memory sliding-window rate limiter per role; usage counters in user doc.
- **Frontend**: React 19 + Tailwind + Plotly (plotly.js-cartesian-dist-min) + Phosphor icons. Dark Command Center theme (Chivo + JetBrains Mono).

## Implemented (2026-04-24) — v1.0 MVP
- [x] JWT auth (register/login/me/logout) with 3 roles
- [x] Single-point IBP calculator (/calculator)
- [x] Parameter sweep builder + async job (/sweep) with 10k-cell grid cap
- [x] Plotly heatmap with scientific palette (blue → yellow → red)
- [x] Experiments library with reproducibility hash + clone/delete (/experiments)
- [x] A/B scenario comparison with diff heatmap (/compare)
- [x] API keys UI (one-shot reveal, copy, revoke) + `x-api-key` header auth (/keys)
- [x] Admin panel: user list + role mutator + global stats (/admin)
- [x] Landing page (marketing hero, features grid, pricing teaser)
- [x] Dashboard (stat strip, recent jobs, usage meter, quick actions)
- [x] CSV download endpoint `/api/ibp/download/{id}`
- [x] Config-hash (SHA-256) on every job + experiment for reproducibility
- [x] Confidence score + anomaly detection flag on single-point results
- [x] Rate limiter with per-role minute + daily quotas
- [x] data-testid coverage across all interactive elements

## Implemented — v1.3 (2026-04-24 night)
- [x] **Contour heatmap** — reverted from 3-D surface to publication-ready 2-D `contour` plot with **Viridis** colorscale, HH:MM time axis, and title "IBP index at DOY X with F10.7 = Y" — matches the upstream `ibpmodel.plotIBPindex()` reference exactly.
- [x] Sklearn-smoothed grid still drives the bands so they remain silky-smooth.
- [x] Rich hover preserved (Lon/LT/IBP/risk classification).

## Implemented — v1.4 (2026-05-25) — Visualization upgrades
- [x] **World Map overhaul** (`WorldMap.jsx`): 8-band discrete Viridis IBP overlay, animated day/night terminator dotted line (proper great-circle math), gold sun marker at subsolar point, 24-hour UTC slider, requestAnimationFrame play loop with 5-speed selector (0.5×–4×), discrete band legend swatches.
- [x] **Plot export toolbar** (`Plot.jsx`): contour density selector (coarse / standard / fine / ultra — sizes 0.10 / 0.05 / 0.025 / 0.0125), PNG export, SVG export, and **"Export for Paper" 300 DPI PNG** with auto-caption footer (DOY, F10.7, model source, config hash, "Reference: Rino & Carrano, ibpmodel — IBP Analytics Platform"). Wired meta props from Sweep & Compare.
- [x] **Butterfly Diagram page** (`/butterfly`): Month × Longitude IBP climatology at fixed LT (default 21:00), backend endpoint `GET /api/ibp/butterfly`, same export toolbar, summary stats + top-8 hotspots panel. New nav entry.
- [x] **Password policy hardening fix** (`models.py`): replaced pydantic regex pattern with lookahead (rejected by pydantic-core rust regex engine — was crashing the backend on import) with explicit `field_validator` checking lowercase / uppercase / digit / special-char (@$!%*?&) / length. Returns 422 with a precise error message.
- [x] Infra fix: re-installed `redis-server` binary and restarted Celery worker — `/api/ibp/meta` now reports `compute_backend = celery`.

## Implemented — v1.5 (2026-05-25) — Code-review fixes (security + architecture)
- [x] **Broke circular import** `celery_app ↔ routes_ibp`: extracted in-process batch runner into new `app/tasks_local.py`. Celery worker and FastAPI BackgroundTasks both consume `tasks_local.run_batch_job`. `routes_ibp._run_batch_job` is a thin shim kept for backwards-compat.
- [x] **XSS-hardened auth**: backend (`auth_cookies.py`) now sets an `httpOnly; Secure; SameSite=lax; Max-Age=86400` cookie on `/auth/login` and `/auth/register`; `/auth/logout` clears it. Frontend (`lib/tokenStore.js`, `lib/api.js`, `AuthContext.jsx`, `Sweep.jsx`) no longer reads or writes the JWT to `localStorage` — only a non-sensitive `"1"` sentinel in `sessionStorage` (wiped on tab close). Axios uses `withCredentials: true`; `fetch()` for downloads uses `credentials: 'include'`. `Authorization: Bearer …` still works for CLIs/API-key clients.
- [x] **Reduced cyclomatic complexity** in route handlers:
  - `routes_ibp.download()` → helpers `_csv_response / _netcdf_response / _parquet_response / _load_completed_job`
  - `routes_ibp.compare()` → reuses `_load_completed_job`
  - `routes_share.create_compare_share()` → helpers `_build_share_payload / _load_share_jobs`
- [x] **Hardcoded test secret** removed: `tests/backend_test.py` reads `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` from env (fallback values kept for local-dev convenience).
- [x] **AuthContext empty catch** now logs `console.error("Logout request failed:", err)`.
- [x] **Hook-deps**: `signIn/signUp/signOut` wrapped in `useCallback`; lint clean across all components.
- [x] Verified: 54/54 backend pytest pass, cookie-based `/auth/me` round-trip works end-to-end, browser confirms `localStorage.ibp_token = null` after login.

## Implemented — v1.2 (2026-04-24 late evening)
- [x] **3-D surface plots** (Plotly `type: surface`) replace 2-D heatmaps in /sweep and /compare
- [x] **Scikit-learn Gaussian-Process smoothing** (`GaussianProcessRegressor` + RBF kernel) upscales sweep grids 2-3× for smooth surfaces
- [x] **Continuous world-map overlay** — backend upscales sparse grid to 181×51 dense (`sklearn.GPR upscaled`) for a true heatmap appearance instead of columns-of-dots
- [x] Rich hover information on all plots: Lon / LT / IBP / risk classification (HIGH / Moderate / Low / Negligible)
- [x] Physics-informed magnetic-equator envelope (σ=9° Gaussian centered on a sinusoidal magnetic-dip approximation) for physically meaningful off-equator values
- [x] Swapped Plotly bundle to `plotly.js-dist-min` to support surface + geo in a single bundle

## Implemented — v1.1 (2026-04-24 evening)
- [x] Removed role/tier selector from `/register` — all logged-in users get full access
- [x] **World-map page** (/worldmap) with Plotly scattergeo + 48-frame local-time slider (0.5h step) + play/pause animation
- [x] **Celery + Redis** compute backend (supervisor-managed) with in-process `BackgroundTasks` fallback. Live `/api/ibp/queue/stats` telemetry
- [x] **Multi-format exports**: CSV + NetCDF (xarray) + Parquet (pyarrow) via `/api/ibp/download/{id}?format=...`
- [x] **Public share links** for A/B comparisons — `POST /api/share/compare` → public `/s/:token` page (no auth) with view-count tracking
- [x] Landing pricing section updated: "free for the whole research community"

## Deferred / Backlog

### P1 (next iteration)
- [ ] NetCDF / Parquet export (adds xarray/netCDF4 deps)
- [ ] Interactive world-map overlay with time-slider animation (globe view)
- [ ] Stripe billing wiring (design hooks already present)
- [ ] Password reset + email verification flow (SMTP not configured)

### P2 (future)
- [ ] Celery/Redis replacement for BackgroundTasks (horizontal scale)
- [ ] Ray cluster migration path for 100k+ cell sweeps
- [ ] PostgreSQL + TimescaleDB data store (for time-indexed sim series)
- [ ] S3-compatible object storage for very large result artifacts
- [ ] docker-compose + Kubernetes manifests
- [ ] OAuth (Google/ORCID) for researcher SSO
- [ ] Model confidence intervals via bootstrap sampling (research-grade)

## Key environment variables
- `MONGO_URL`, `DB_NAME` (db)
- `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (auth)
- `IBP_GRID_CAP=10000` (memory guard)
- `CORS_ORIGINS="*"` (dev)

## Credentials
See `/app/memory/test_credentials.md`.
