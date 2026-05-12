# Plasma-bubbles

Plasma-bubbles is a full-stack analytics platform for Ionospheric Bubble Probability (IBP) modeling.
It combines a FastAPI backend with a React frontend and supports interactive calculation, batch sweeps, experiment management, and shareable results.

## Key features

- User authentication and role-based access
- FastAPI backend with MongoDB persistence
- Ad-hoc IBP calculation endpoint
- Batch grid sweeps with Celery/Redis or fallback background execution
- Experiment creation, cloning, and history
- Job queue monitoring and downloadable results (CSV, NetCDF, Parquet)
- Shareable result links and public access
- React frontend using Tailwind, Radix UI, Plotly, and Recharts

## Repository structure

- `backend/` — FastAPI app, MongoDB integration, Celery worker, authentication, IBP routes
- `frontend/` — React application, pages, UI components, routing, dashboards
- `memory/`, `test_reports/`, `tests/` — project support files and test artifacts

## Tech stack

- Python, FastAPI, Motor, Celery, Redis
- React, Create React App, CRACO, Tailwind CSS
- Plotly, Recharts, Radix UI, React Router

## Environment setup

1. Clone the repository:
   ```bash
   git clone https://github.com/safaryharold/Plasma-bubbles.git
   cd Plasma-bubbles
   ```

2. Create a backend virtual environment and install dependencies:
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. Create a `.env` file in `backend/` with at least:
   ```env
   MONGO_URL=mongodb://localhost:27017
   DB_NAME=plasma_bubbles
   REDIS_URL=redis://localhost:6379/0
   CORS_ORIGINS=http://localhost:3000
   ```

4. Start the backend API:
   ```bash
   cd backend
   uvicorn server:app --reload --host 0.0.0.0 --port 8000
   ```

5. Start the frontend app:
   ```bash
   cd frontend
   yarn install
   yarn start
   ```

6. Open the frontend in your browser:
   ```text
   http://localhost:3000
   ```

## Optional: start Celery worker

If you want background batch sweep processing through Redis/Celery:

```bash
cd backend
celery -A app.celery_app.celery worker --loglevel=info
```

If Redis is not available, batch jobs will automatically fall back to FastAPI `BackgroundTasks`.

## Backend API overview

The backend serves API routes under `/api`:

- `/api/auth` — register, login, current user, logout
- `/api/ibp` — calculate IBP, create batch sweep jobs, list jobs, download outputs
- `/api/experiments` — create, list, clone, delete experiment definitions
- `/api/keys` — API key management
- `/api/share` — shareable result links
- `/api/admin` — admin-only management endpoints

## Screenshots

### Login screen
![Login screen screenshot](docs/screenshots/login-screen.svg)

### Dashboard view
![Dashboard screenshot](docs/screenshots/dashboard.svg)

### IBP results and visualization
![IBP results screenshot](docs/screenshots/ibp-results.svg)

### Experiment management and batch job tracking
![Experiment management screenshot](docs/screenshots/experiment-management.svg)

> The login screenshot above is a visual representation of your attached login page. Replace the SVG files in `docs/screenshots/` with real PNG/JPG screenshots once you want exact production visuals.

## Notes

- Do not commit `.env` or secret credentials.
- Add any local configuration and secrets to `.gitignore`.
- The backend creates MongoDB indexes automatically on startup.

## License

This project does not include a license file. Add one if you want to publish or share the repository.
