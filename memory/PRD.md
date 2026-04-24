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

## Implemented (2026-04-24)
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
- [x] 25/25 backend pytest cases passing + frontend e2e verified

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
