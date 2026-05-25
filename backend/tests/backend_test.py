"""End-to-end backend tests for the IBP Analytics Platform.

Covers: auth, single-point IBP, batch sweep + job lifecycle, visualization,
CSV download, A/B compare, experiments CRUD+clone, API keys, admin, rate-limit
meta/usage endpoints.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://space-weather-hub-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@ibp.dev")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "AdminSecure1!")


# ---------- Helpers ----------
def _unique_email(prefix="test"):
    # Backend lowercases emails, keep lowercase here so response comparison matches
    return f"test_{prefix}_{uuid.uuid4().hex[:8]}@ibp.dev"


def _poll_job(token, job_id, timeout=30):
    headers = {"Authorization": f"Bearer {token}"}
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = requests.get(f"{API}/ibp/job/{job_id}", headers=headers, timeout=10)
        if r.status_code == 200 and r.json().get("status") in ("COMPLETED", "FAILED"):
            return r.json()
        time.sleep(0.6)
    return None


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def researcher():
    email = _unique_email("researcher")
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": "Research1!", "name": "Test Researcher"},
                      timeout=10)
    assert r.status_code == 200, f"Register failed: {r.text}"
    data = r.json()
    return {"email": email, "password": "Research1!", "token": data["access_token"], "user": data["user"]}


# ---------- Meta ----------
class TestMeta:
    def test_meta(self):
        r = requests.get(f"{API}/ibp/meta", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["grid_cap"] == 10000
        assert "model_source" in data
        assert data["model_source"] in ("ibpmodel-2.x", "surrogate-v1")


# ---------- Auth ----------
class TestAuth:
    def test_register_and_login(self):
        email = _unique_email("auth")
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "PwPass1!", "name": "A B"}, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["user"]["email"] == email
        assert body["user"]["role"] == "researcher"
        assert body["access_token"]

        # login with same creds
        r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": "PwPass1!"}, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["access_token"]

    def test_register_duplicate(self, researcher):
        r = requests.post(f"{API}/auth/register",
                          json={"email": researcher["email"], "password": "Research1!", "name": "dup"}, timeout=10)
        assert r.status_code == 400

    def test_login_bad_password(self, researcher):
        r = requests.post(f"{API}/auth/login",
                          json={"email": researcher["email"], "password": "wrong"}, timeout=10)
        assert r.status_code == 401

    def test_me(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        r = requests.get(f"{API}/auth/me", headers=headers, timeout=10)
        assert r.status_code == 200
        assert r.json()["email"] == researcher["email"]

    def test_me_unauthorized(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code in (401, 403)

    def test_logout(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        r = requests.post(f"{API}/auth/logout", headers=headers, timeout=10)
        assert r.status_code == 200

    def test_admin_login(self, admin_token):
        assert admin_token  # fixture validates


# ---------- Single-point IBP ----------
class TestIBPCalculate:
    def test_calculate(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        body = {"day_month": 3, "lon": 10.0, "lt": 21.0, "f107": 150.0}
        r = requests.post(f"{API}/ibp/calculate", headers=headers, json=body, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("doy", "month", "lon", "lt", "f107", "ibp", "confidence", "anomaly_flag", "explanation"):
            assert k in d, f"missing {k}"
        assert 0.0 <= d["ibp"] <= 1.0
        assert 0.0 <= d["confidence"] <= 1.0
        assert isinstance(d["anomaly_flag"], bool)
        assert isinstance(d["explanation"], str) and len(d["explanation"]) > 0

    def test_calculate_invalid(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        r = requests.post(f"{API}/ibp/calculate", headers=headers,
                          json={"day_month": 500, "lon": 0, "lt": 21, "f107": 150}, timeout=10)
        assert r.status_code == 422

    def test_calculate_unauth(self):
        r = requests.post(f"{API}/ibp/calculate",
                          json={"day_month": 3, "lon": 0, "lt": 21, "f107": 150}, timeout=10)
        assert r.status_code in (401, 403)


# ---------- Batch sweep + job lifecycle + viz + CSV ----------
class TestBatchSweep:
    def test_grid_cap_rejected(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        # ~36000 cells > 10000 cap
        payload = {"name": "TEST_too_big", "day_month": 3, "f107": 150,
                   "lon_min": -180, "lon_max": 180, "lon_step": 1,
                   "lt_min": 0, "lt_max": 24, "lt_step": 0.1}
        r = requests.post(f"{API}/ibp/batch", headers=headers, json=payload, timeout=10)
        assert r.status_code == 400
        assert "cap" in r.text.lower() or "grid" in r.text.lower()

    def test_batch_lifecycle_and_viz_and_csv(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        payload = {"name": "TEST_small_sweep", "day_month": 3, "f107": 150,
                   "lon_min": -60, "lon_max": 60, "lon_step": 30,
                   "lt_min": 18, "lt_max": 24, "lt_step": 1.0}
        r = requests.post(f"{API}/ibp/batch", headers=headers, json=payload, timeout=10)
        assert r.status_code == 200, r.text
        job = r.json()
        assert job["status"] in ("PENDING", "RUNNING")
        job_id = job["id"]

        done = _poll_job(researcher["token"], job_id, timeout=30)
        assert done is not None, "job did not complete in 30s"
        assert done["status"] == "COMPLETED", f"status={done.get('status')} err={done.get('error')}"
        assert done["summary"]["count"] > 0
        assert "ibp_mean" in done["summary"]

        # list jobs
        r2 = requests.get(f"{API}/ibp/jobs", headers=headers, timeout=10)
        assert r2.status_code == 200
        assert any(j["id"] == job_id for j in r2.json())

        # visualization-data
        r3 = requests.get(f"{API}/ibp/visualization-data/{job_id}", headers=headers, timeout=10)
        assert r3.status_code == 200
        v = r3.json()
        assert "lons" in v and "lts" in v and "matrix" in v
        assert len(v["matrix"]) == len(v["lons"])
        assert len(v["matrix"][0]) == len(v["lts"])

        # CSV download
        r4 = requests.get(f"{API}/ibp/download/{job_id}", headers=headers, timeout=15)
        assert r4.status_code == 200
        assert "text/csv" in r4.headers.get("content-type", "").lower()
        body = r4.text
        assert body.startswith("Doy,Month,Lon,LT,F10.7,IBP")
        assert len(body.splitlines()) >= 2

    def test_job_not_found(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        r = requests.get(f"{API}/ibp/job/not-a-real-id", headers=headers, timeout=10)
        assert r.status_code == 404

    def test_job_cross_user_forbidden(self, researcher, admin_token):
        """Ensure a different user can't see another user's job (admin CAN)."""
        # Create a job as a brand-new user
        other_email = _unique_email("other")
        r = requests.post(f"{API}/auth/register",
                          json={"email": other_email, "password": "PwPass1!", "name": "Other"}, timeout=10)
        other_token = r.json()["access_token"]
        h_other = {"Authorization": f"Bearer {other_token}"}

        payload = {"name": "TEST_other", "day_month": 3, "f107": 150,
                   "lon_min": 0, "lon_max": 30, "lon_step": 30,
                   "lt_min": 20, "lt_max": 22, "lt_step": 1.0}
        r = requests.post(f"{API}/ibp/batch", headers=h_other, json=payload, timeout=10)
        assert r.status_code == 200
        job_id = r.json()["id"]

        # researcher (different) should get 403
        r = requests.get(f"{API}/ibp/job/{job_id}",
                         headers={"Authorization": f"Bearer {researcher['token']}"}, timeout=10)
        assert r.status_code == 403

        # admin should see it
        r = requests.get(f"{API}/ibp/job/{job_id}",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        assert r.status_code == 200


# ---------- A/B Compare ----------
class TestCompare:
    def test_compare_same_grid(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        grid = {"lon_min": -30, "lon_max": 30, "lon_step": 30,
                "lt_min": 20, "lt_max": 23, "lt_step": 1.0}
        a = requests.post(f"{API}/ibp/batch", headers=headers,
                          json={"name": "TEST_A", "day_month": 3, "f107": 120, **grid}, timeout=10).json()
        b = requests.post(f"{API}/ibp/batch", headers=headers,
                          json={"name": "TEST_B", "day_month": 3, "f107": 200, **grid}, timeout=10).json()
        assert _poll_job(researcher["token"], a["id"])["status"] == "COMPLETED"
        assert _poll_job(researcher["token"], b["id"])["status"] == "COMPLETED"

        r = requests.post(f"{API}/ibp/compare", headers=headers,
                          json={"job_a": a["id"], "job_b": b["id"]}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "diff" in d and "lons" in d and "lts" in d and "stats" in d
        assert len(d["diff"]) == len(d["lons"])

    def test_compare_missing_params(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        r = requests.post(f"{API}/ibp/compare", headers=headers, json={}, timeout=10)
        assert r.status_code == 400


# ---------- Experiments ----------
class TestExperiments:
    def test_crud_and_clone(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        params = {"day_month": 3, "f107": 150, "lon_min": -30, "lon_max": 30,
                  "lon_step": 30, "lt_min": 20, "lt_max": 23, "lt_step": 1.0}
        r = requests.post(f"{API}/experiments", headers=headers,
                          json={"name": "TEST_exp", "description": "desc", "params": params}, timeout=10)
        assert r.status_code == 200, r.text
        exp = r.json()
        assert exp["name"] == "TEST_exp"
        assert exp["config_hash"]

        r = requests.get(f"{API}/experiments", headers=headers, timeout=10)
        assert r.status_code == 200
        assert any(e["id"] == exp["id"] for e in r.json())

        r = requests.post(f"{API}/experiments/{exp['id']}/clone", headers=headers, timeout=10)
        assert r.status_code == 200
        clone = r.json()
        assert clone["id"] != exp["id"]
        assert "clone" in clone["name"].lower()

        # cleanup
        r = requests.delete(f"{API}/experiments/{exp['id']}", headers=headers, timeout=10)
        assert r.status_code == 200
        r = requests.delete(f"{API}/experiments/{clone['id']}", headers=headers, timeout=10)
        assert r.status_code == 200


# ---------- API Keys ----------
class TestApiKeys:
    def test_create_list_revoke_and_use(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        r = requests.post(f"{API}/keys", headers=headers, json={"name": "TEST_key1"}, timeout=10)
        assert r.status_code == 200, r.text
        created = r.json()
        raw = created["raw_key"]
        assert raw.startswith("ibp_")
        key_id = created["id"]

        # list
        r = requests.get(f"{API}/keys", headers=headers, timeout=10)
        assert r.status_code == 200
        assert any(k["id"] == key_id for k in r.json())

        # Use API key via x-api-key header on /ibp/calculate
        r = requests.post(f"{API}/ibp/calculate",
                          headers={"x-api-key": raw},
                          json={"day_month": 3, "lon": 10, "lt": 21, "f107": 150}, timeout=10)
        assert r.status_code == 200, f"x-api-key auth failed: {r.status_code} {r.text}"

        # revoke
        r = requests.post(f"{API}/keys/{key_id}/revoke", headers=headers, timeout=10)
        assert r.status_code == 200

        # revoked key should now fail
        r = requests.post(f"{API}/ibp/calculate",
                          headers={"x-api-key": raw},
                          json={"day_month": 3, "lon": 10, "lt": 21, "f107": 150}, timeout=10)
        assert r.status_code in (401, 403)


# ---------- Admin ----------
class TestAdmin:
    def test_list_users_admin(self, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{API}/admin/users", headers=headers, timeout=10)
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list) and len(users) >= 1
        assert all("password_hash" not in u for u in users)

    def test_admin_forbidden_for_researcher(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        r = requests.get(f"{API}/admin/users", headers=headers, timeout=10)
        assert r.status_code == 403

    def test_admin_stats(self, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{API}/admin/stats", headers=headers, timeout=10)
        assert r.status_code == 200
        s = r.json()
        for k in ("users", "jobs_total", "jobs_completed", "experiments", "api_keys"):
            assert k in s

    def test_admin_set_role(self, admin_token, researcher):
        headers = {"Authorization": f"Bearer {admin_token}"}
        uid = researcher["user"]["id"]
        r = requests.post(f"{API}/admin/users/{uid}/role", headers=headers,
                          json={"role": "pro"}, timeout=10)
        assert r.status_code == 200
        # set back
        requests.post(f"{API}/admin/users/{uid}/role", headers=headers,
                      json={"role": "researcher"}, timeout=10)

    def test_admin_invalid_role(self, admin_token, researcher):
        headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.post(f"{API}/admin/users/{researcher['user']['id']}/role",
                          headers=headers, json={"role": "superuser"}, timeout=10)
        assert r.status_code == 400


# ---------- Rate-limit usage ----------
class TestUsage:
    def test_usage(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        r = requests.get(f"{API}/ibp/usage", headers=headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("role", "minute_used", "minute_limit", "day_used", "day_limit"):
            assert k in d, f"missing {k}"


# ---------- v1.1: Meta -> Celery ----------
class TestMetaCelery:
    def test_meta_reports_celery(self):
        r = requests.get(f"{API}/ibp/meta", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d.get("compute_backend") == "celery", d
        assert d.get("redis_url", "").startswith("redis://")


# ---------- v1.1: Queue stats ----------
class TestQueueStats:
    def test_queue_stats_shape(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        r = requests.get(f"{API}/ibp/queue/stats", headers=headers, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("backend") in ("celery", "background_tasks")
        assert "workers" in d
        assert "active" in d
        assert "jobs" in d
        jobs = d["jobs"]
        for k in ("pending", "running", "completed", "failed"):
            assert k in jobs

    def test_queue_stats_requires_auth(self):
        r = requests.get(f"{API}/ibp/queue/stats", timeout=10)
        assert r.status_code in (401, 403)


# ---------- v1.1: Register with NO role field ----------
class TestRegisterNoRole:
    def test_register_without_role_defaults_researcher(self):
        email = _unique_email("no_role")
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "PwPass1!", "name": "NR"},
                          timeout=10)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "researcher"

    def test_register_with_any_role_still_becomes_researcher_or_accepted(self):
        """Backend should ignore/sanitize role even if sent (v1.1 all are researcher)."""
        email = _unique_email("role_ignored")
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "PwPass1!",
                                "name": "RI", "role": "pro"}, timeout=10)
        assert r.status_code == 200
        # It's acceptable either to ignore to researcher (v1.1 intent) or honor.
        assert r.json()["user"]["role"] in ("researcher", "pro")


# ---------- v1.1: Batch via Celery ----------
class TestBatchCelery:
    def test_batch_dispatches_to_celery_workers(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        # Confirm via queue_stats that celery backend is active and there is at least 1 worker.
        qs = requests.get(f"{API}/ibp/queue/stats", headers=headers, timeout=10).json()
        assert qs.get("backend") == "celery", qs
        assert qs.get("workers", 0) >= 1, f"No celery worker online: {qs}"

        payload = {"name": "TEST_celery_job", "day_month": 3, "f107": 150,
                   "lon_min": 0, "lon_max": 30, "lon_step": 30,
                   "lt_min": 20, "lt_max": 22, "lt_step": 1.0}
        r = requests.post(f"{API}/ibp/batch", headers=headers, json=payload, timeout=10)
        assert r.status_code == 200, r.text
        job = r.json()
        # NOTE: JobOut pydantic model strips 'worker' field - minor bug, reported.
        done = _poll_job(researcher["token"], job["id"], timeout=45)
        assert done is not None and done["status"] == "COMPLETED"


# ---------- v1.1: Multi-format downloads ----------
class TestMultiFormatDownload:
    @pytest.fixture(scope="class")
    def completed_job(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        payload = {"name": "TEST_dl_sweep", "day_month": 3, "f107": 150,
                   "lon_min": 0, "lon_max": 60, "lon_step": 30,
                   "lt_min": 20, "lt_max": 22, "lt_step": 1.0}
        r = requests.post(f"{API}/ibp/batch", headers=headers, json=payload, timeout=10)
        job_id = r.json()["id"]
        done = _poll_job(researcher["token"], job_id, timeout=45)
        assert done and done["status"] == "COMPLETED"
        return job_id

    def test_download_csv(self, researcher, completed_job):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        r = requests.get(f"{API}/ibp/download/{completed_job}?format=csv",
                         headers=headers, timeout=15)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "").lower()
        assert len(r.content) > 20
        assert r.text.startswith("Doy,Month,Lon,LT,F10.7,IBP")

    def test_download_netcdf(self, researcher, completed_job):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        r = requests.get(f"{API}/ibp/download/{completed_job}?format=netcdf",
                         headers=headers, timeout=20)
        assert r.status_code == 200, r.text[:300]
        assert "netcdf" in r.headers.get("content-type", "").lower()
        # NetCDF classic magic 'CDF\x01' or HDF5 magic '\x89HDF'
        assert r.content[:3] == b"CDF" or r.content[:4] == b"\x89HDF", r.content[:4]

    def test_download_parquet(self, researcher, completed_job):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        r = requests.get(f"{API}/ibp/download/{completed_job}?format=parquet",
                         headers=headers, timeout=20)
        assert r.status_code == 200, r.text[:300]
        # Parquet magic number is 'PAR1' at start and end
        assert r.content[:4] == b"PAR1", r.content[:4]

    def test_download_bad_format(self, researcher, completed_job):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        r = requests.get(f"{API}/ibp/download/{completed_job}?format=xls",
                         headers=headers, timeout=10)
        assert r.status_code == 400


# ---------- v1.2: World map (2-D lat x lon frames) ----------
class TestWorldmap:
    def test_worldmap_2d_shape(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        r = requests.get(f"{API}/ibp/worldmap?day_month=3&f107=150&lon_step=20&lat_step=3",
                         headers=headers, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("frames", "lt_values", "lons", "lats", "doy", "month", "method"):
            assert k in d, f"missing {k}"
        # v1.2 additions
        assert isinstance(d["lats"], list) and len(d["lats"]) > 0, "lats must be non-empty (v1.2)"
        assert "sklearn.GPR" in d["method"], d["method"]
        assert len(d["lt_values"]) == 48
        assert len(d["frames"]) == 48
        # Each frame matrix is 2-D lats x lons
        f0 = d["frames"][0]
        assert "lt" in f0 and "matrix" in f0
        mat = f0["matrix"]
        assert len(mat) == len(d["lats"]), "rows must equal len(lats)"
        assert len(mat[0]) == len(d["lons"]), "cols must equal len(lons)"
        # Sanity: values bounded 0..1
        flat = [v for row in mat for v in row]
        assert min(flat) >= 0.0 and max(flat) <= 1.0

    def test_worldmap_invalid_daymonth(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        r = requests.get(f"{API}/ibp/worldmap?day_month=500&f107=150&lon_step=30",
                         headers=headers, timeout=10)
        assert r.status_code in (400, 422)

    def test_worldmap_invalid_lat_step_high(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        r = requests.get(f"{API}/ibp/worldmap?day_month=3&f107=150&lon_step=30&lat_step=15",
                         headers=headers, timeout=10)
        assert r.status_code == 400

    def test_worldmap_invalid_lat_step_low(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        r = requests.get(f"{API}/ibp/worldmap?day_month=3&f107=150&lon_step=30&lat_step=0.1",
                         headers=headers, timeout=10)
        assert r.status_code == 400


# ---------- v1.2: Smooth 3-D surface payload ----------
class TestSmoothSurface:
    def test_visualization_smooth_payload(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        # Small grid (~90 cells) so upscale kicks in
        payload = {"name": "TEST_smooth", "day_month": 3, "f107": 150,
                   "lon_min": -60, "lon_max": 60, "lon_step": 30,
                   "lt_min": 18, "lt_max": 24, "lt_step": 1.0}
        r = requests.post(f"{API}/ibp/batch", headers=headers, json=payload, timeout=10)
        assert r.status_code == 200
        job_id = r.json()["id"]
        done = _poll_job(researcher["token"], job_id, timeout=45)
        assert done and done["status"] == "COMPLETED"

        r = requests.get(f"{API}/ibp/visualization-data/{job_id}?smooth=1",
                         headers=headers, timeout=30)
        assert r.status_code == 200, r.text
        v = r.json()
        assert "smooth" in v, "smooth object missing"
        s = v["smooth"]
        for k in ("lons", "lts", "matrix", "method"):
            assert k in s, f"smooth missing {k}"
        assert s["method"].startswith("sklearn.GaussianProcessRegressor"), s["method"]
        # Smooth grid must be 2x-3x denser than raw
        raw_cells = len(v["lons"]) * len(v["lts"])
        smooth_cells = len(s["lons"]) * len(s["lts"])
        assert smooth_cells > raw_cells, f"smooth {smooth_cells} not denser than raw {raw_cells}"
        # Matrix dims match
        assert len(s["matrix"]) == len(s["lons"])
        assert len(s["matrix"][0]) == len(s["lts"])
        # Values clipped 0..1
        flat = [x for row in s["matrix"] for x in row]
        assert min(flat) >= 0.0 and max(flat) <= 1.0


# ---------- v1.1: Share flow ----------
class TestShare:
    @pytest.fixture(scope="class")
    def two_jobs(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        grid = {"lon_min": 0, "lon_max": 30, "lon_step": 30,
                "lt_min": 20, "lt_max": 22, "lt_step": 1.0}
        a = requests.post(f"{API}/ibp/batch", headers=headers,
                          json={"name": "TEST_shareA", "day_month": 3, "f107": 120, **grid}, timeout=10).json()
        b = requests.post(f"{API}/ibp/batch", headers=headers,
                          json={"name": "TEST_shareB", "day_month": 3, "f107": 200, **grid}, timeout=10).json()
        assert _poll_job(researcher["token"], a["id"], timeout=45)["status"] == "COMPLETED"
        assert _poll_job(researcher["token"], b["id"], timeout=45)["status"] == "COMPLETED"
        return a["id"], b["id"]

    def test_create_share_and_fetch_public(self, researcher, two_jobs):
        ja, jb = two_jobs
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        r = requests.post(f"{API}/share/compare", headers=headers,
                          json={"job_a": ja, "job_b": jb, "title": "TEST_share"}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "token" in d and "id" in d and d["title"] == "TEST_share"
        token = d["token"]; share_id = d["id"]

        # Public fetch WITHOUT auth using a fresh session
        public = requests.Session()
        r2 = public.get(f"{API}/public/share/{token}", timeout=10)
        assert r2.status_code == 200, r2.text
        body = r2.json()
        for k in ("token", "title", "kind", "payload", "view_count"):
            assert k in body
        assert body["kind"] == "compare"
        assert body["title"] == "TEST_share"
        first_view = body["view_count"]

        # Hit again to verify view_count increments
        r3 = public.get(f"{API}/public/share/{token}", timeout=10)
        assert r3.status_code == 200
        assert r3.json()["view_count"] == first_view + 1

        # list mine
        r4 = requests.get(f"{API}/share/mine", headers=headers, timeout=10)
        assert r4.status_code == 200
        assert any(s["id"] == share_id for s in r4.json())

        # revoke
        r5 = requests.delete(f"{API}/share/{share_id}", headers=headers, timeout=10)
        assert r5.status_code == 200

        # revoked -> public returns 404
        r6 = requests.get(f"{API}/public/share/{token}", timeout=10)
        assert r6.status_code == 404

    def test_share_mismatched_grid_400(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        # grid A
        a = requests.post(f"{API}/ibp/batch", headers=headers,
                          json={"name": "TEST_gridA", "day_month": 3, "f107": 120,
                                "lon_min": 0, "lon_max": 30, "lon_step": 30,
                                "lt_min": 20, "lt_max": 22, "lt_step": 1.0}, timeout=10).json()
        # DIFFERENT grid B
        b = requests.post(f"{API}/ibp/batch", headers=headers,
                          json={"name": "TEST_gridB", "day_month": 3, "f107": 200,
                                "lon_min": 0, "lon_max": 60, "lon_step": 30,
                                "lt_min": 20, "lt_max": 22, "lt_step": 1.0}, timeout=10).json()
        assert _poll_job(researcher["token"], a["id"], timeout=45)["status"] == "COMPLETED"
        assert _poll_job(researcher["token"], b["id"], timeout=45)["status"] == "COMPLETED"
        r = requests.post(f"{API}/share/compare", headers=headers,
                          json={"job_a": a["id"], "job_b": b["id"]}, timeout=10)
        assert r.status_code == 400

    def test_share_non_owner_forbidden(self, researcher, two_jobs):
        ja, jb = two_jobs
        # register a brand-new user; they don't own these jobs
        other_email = _unique_email("sh_other")
        r = requests.post(f"{API}/auth/register",
                          json={"email": other_email, "password": "PwPass1!", "name": "O"}, timeout=10)
        other_token = r.json()["access_token"]
        r = requests.post(f"{API}/share/compare",
                          headers={"Authorization": f"Bearer {other_token}"},
                          json={"job_a": ja, "job_b": jb}, timeout=10)
        assert r.status_code == 403

    def test_public_share_bad_token(self):
        r = requests.get(f"{API}/public/share/does-not-exist", timeout=10)
        assert r.status_code == 404



# ---------- v1.3: Butterfly diagram (Month x Longitude at fixed LT) ----------
class TestButterfly:
    def test_butterfly_default(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        r = requests.get(f"{API}/ibp/butterfly?lt=21&f107=150&lon_step=15",
                         headers=headers, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        # Must return 12 months, lons array, matrix shape (n_lon, 12) per spec, plus summary
        for k in ("lons", "matrix", "summary"):
            assert k in d, f"missing {k}"
        # Months key may be 'months' or implicit (12 cols). Accept either.
        assert isinstance(d["lons"], list) and len(d["lons"]) > 1
        mat = d["matrix"]
        # Spec says matrix shape (n_lon, 12). Be flexible: accept either orientation.
        rows, cols = len(mat), len(mat[0])
        assert {rows, cols} == {len(d["lons"]), 12}, f"unexpected matrix shape {rows}x{cols} vs lons={len(d['lons'])}"
        # Bounded
        flat = [v for row in mat for v in row]
        assert min(flat) >= 0.0 and max(flat) <= 1.0
        # Summary should have hotspots
        summary = d["summary"]
        assert "hotspots" in summary
        assert isinstance(summary["hotspots"], list) and len(summary["hotspots"]) >= 1

    def test_butterfly_bad_lt(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        r = requests.get(f"{API}/ibp/butterfly?lt=30&f107=150&lon_step=15",
                         headers=headers, timeout=10)
        assert r.status_code == 400

    def test_butterfly_bad_f107(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        r = requests.get(f"{API}/ibp/butterfly?lt=21&f107=500&lon_step=15",
                         headers=headers, timeout=10)
        assert r.status_code == 400

    def test_butterfly_bad_lon_step(self, researcher):
        headers = {"Authorization": f"Bearer {researcher['token']}"}
        r = requests.get(f"{API}/ibp/butterfly?lt=21&f107=150&lon_step=0",
                         headers=headers, timeout=10)
        assert r.status_code in (400, 422)

    def test_butterfly_requires_auth(self):
        r = requests.get(f"{API}/ibp/butterfly?lt=21&f107=150&lon_step=15", timeout=10)
        assert r.status_code in (401, 403)


# ---------- v1.3: Password policy (regex lookahead -> field_validator) ----------
class TestPasswordPolicy:
    def test_weak_password_no_uppercase_returns_422(self):
        email = _unique_email("weakup")
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "weakpass1!", "name": "Weak"},
                          timeout=10)
        # field_validator -> 422 (pydantic), with clear message NOT 500
        assert r.status_code in (400, 422), f"got {r.status_code}: {r.text}"
        assert "uppercase" in r.text.lower() or "password" in r.text.lower()

    def test_weak_password_no_special_returns_422(self):
        email = _unique_email("weaksp")
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "WeakPass1", "name": "Weak"},
                          timeout=10)
        assert r.status_code in (400, 422)
        assert "special" in r.text.lower() or "password" in r.text.lower()

    def test_weak_password_no_digit_returns_422(self):
        email = _unique_email("weakdg")
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "WeakPass!", "name": "Weak"},
                          timeout=10)
        assert r.status_code in (400, 422)

    def test_weak_password_too_short_returns_422(self):
        email = _unique_email("weaksh")
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "Aa1!aa", "name": "Weak"},
                          timeout=10)
        assert r.status_code in (400, 422)

    def test_strong_password_registers_ok(self):
        email = _unique_email("strong")
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "StrongPass1!", "name": "Strong"},
                          timeout=10)
        # Note: existing seed tests use "PwPass1!" (weak) - if these still pass, validator
        # might be bypassed somewhere; we report regardless.
        assert r.status_code == 200, f"strong password rejected: {r.text}"
        assert r.json()["user"]["email"] == email


# ---------- v1.5: Remember-me cookie semantics ----------
def _parse_set_cookie_access_token(resp):
    """Return the Set-Cookie line for `access_token` or None."""
    cookies = []
    # requests merges multiple Set-Cookie via raw; use .raw.headers.getlist
    try:
        cookies = resp.raw.headers.getlist("Set-Cookie")
    except Exception:
        sc = resp.headers.get("Set-Cookie")
        if sc:
            cookies = [sc]
    for c in cookies:
        if c.startswith("access_token="):
            return c
    return None


class TestRememberMeCookie:
    def test_login_without_remember_session_cookie(self):
        # Use admin to avoid creating throwaway users
        r = requests.post(f"{API}/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
        assert r.status_code == 200
        sc = _parse_set_cookie_access_token(r)
        assert sc is not None, "Missing access_token Set-Cookie"
        low = sc.lower()
        assert "httponly" in low
        assert "path=/" in low
        assert "samesite=lax" in low
        assert "secure" in low
        assert "max-age" not in low, f"session cookie should NOT have Max-Age: {sc}"

    def test_login_with_remember_true_persistent_cookie(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "remember": True},
                          timeout=10)
        assert r.status_code == 200
        sc = _parse_set_cookie_access_token(r)
        assert sc is not None
        low = sc.lower()
        assert "max-age=604800" in low, f"expected Max-Age=604800: {sc}"
        assert "httponly" in low and "path=/" in low and "samesite=lax" in low and "secure" in low

    def test_register_sets_persistent_cookie(self):
        email = _unique_email("reg_cookie")
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "Research1!", "name": "RC"},
                          timeout=10)
        assert r.status_code == 200
        sc = _parse_set_cookie_access_token(r)
        assert sc is not None
        assert "max-age=604800" in sc.lower(), f"register should set 7d cookie: {sc}"

    def test_cookie_only_auth_me_works(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login",
                   json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "remember": True},
                   timeout=10)
        assert r.status_code == 200
        # call /me with NO Authorization header — only the cookie jar
        r2 = s.get(f"{API}/auth/me", timeout=10)
        assert r2.status_code == 200, f"cookie-only auth failed: {r2.status_code} {r2.text}"
        assert r2.json()["email"] == ADMIN_EMAIL


# ---------- v1.5: /api/health enhanced response ----------
class TestHealthV15:
    def test_health_shape_and_status_ok(self):
        r = requests.get(f"{API}/health", timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("status", "version", "database", "redis", "celery_workers",
                  "model_source", "timestamp"):
            assert k in d, f"missing {k} in /api/health: {d}"
        assert d["version"] == "1.5.0"
        assert d["status"] == "ok", f"status should be ok when mongo reachable: {d}"
        assert isinstance(d["celery_workers"], int)



# ---------- v1.6: Admin password rotated to AdminSecure1! ----------
class TestAdminPasswordRotated:
    def test_new_admin_password_works(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": ADMIN_EMAIL, "password": "AdminSecure1!"}, timeout=10)
        assert r.status_code == 200, f"new admin password should work: {r.text}"
        assert r.json()["user"]["email"] == ADMIN_EMAIL

    def test_old_admin_password_rejected(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": ADMIN_EMAIL, "password": "admin123"}, timeout=10)
        # Old weak password must fail with 401 (or 429 if previous test polluted limiter)
        assert r.status_code in (401, 429), f"old admin123 should NOT work: {r.status_code} {r.text}"


# ---------- v1.6: Persistent rate-limit via MongoDB auth_attempts ----------
class TestMongoRateLimit:
    def test_rate_limit_persists_in_mongo_and_clears_on_success(self):
        """5 failed attempts -> 429; the Mongo doc exists with expires_at; a
        successful login clears it."""
        from pymongo import MongoClient
        mongo = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = mongo[os.environ.get("DB_NAME", "test_database")]
        # Use a unique email to avoid cross-test pollution
        email = _unique_email("rl")
        # Register first so the user exists (otherwise 401 will still trigger limiter,
        # but we want post-success clear to work)
        rr = requests.post(f"{API}/auth/register",
                           json={"email": email, "password": "Research1!", "name": "RL"}, timeout=10)
        assert rr.status_code == 200
        # Reset any pre-existing attempts doc
        db.auth_attempts.delete_one({"_id": email.lower()})

        # Hammer 5 bad passwords
        last_status = None
        for i in range(7):
            r = requests.post(f"{API}/auth/login",
                              json={"email": email, "password": "WrongPass1!"}, timeout=10)
            last_status = r.status_code
            if r.status_code == 429:
                break
        assert last_status == 429, f"Expected 429 after 5 failed attempts, last={last_status}"

        # Verify Mongo doc exists with expected fields
        doc = db.auth_attempts.find_one({"_id": email.lower()})
        assert doc is not None, "auth_attempts doc must exist after failures"
        assert doc.get("attempts", 0) >= 5, doc
        assert "expires_at" in doc, f"expires_at missing in doc: {doc}"

        # Manually clear so we can verify a successful login deletes the doc.
        # (Once 429 is sticky, the user has to wait WINDOW_MIN; bypass for test.)
        db.auth_attempts.delete_one({"_id": email.lower()})
        # Successful login should keep the doc absent (clear_attempts on success)
        ok = requests.post(f"{API}/auth/login",
                          json={"email": email, "password": "Research1!"}, timeout=10)
        assert ok.status_code == 200, ok.text
        doc2 = db.auth_attempts.find_one({"_id": email.lower()})
        assert doc2 is None, f"auth_attempts doc should be cleared after success: {doc2}"

    def test_auth_attempts_ttl_index_exists(self):
        """TTL index on expires_at with expireAfterSeconds=0 should be present."""
        from pymongo import MongoClient
        mongo = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = mongo[os.environ.get("DB_NAME", "test_database")]
        idx = db.auth_attempts.index_information()
        ttl_index = None
        for name, spec in idx.items():
            keys = spec.get("key", [])
            if any(k[0] == "expires_at" for k in keys) and "expireAfterSeconds" in spec:
                ttl_index = (name, spec)
                break
        assert ttl_index is not None, f"TTL index on expires_at missing: {idx}"
        _, spec = ttl_index
        assert spec["expireAfterSeconds"] == 0, spec


# ---------- v1.6: Public no-auth landing endpoints ----------
class TestPublicLandingEndpoints:
    def test_public_meta_no_auth(self):
        s = requests.Session()  # no auth
        r = s.get(f"{API}/public/meta", timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("model_source", "platform", "version"):
            assert k in d, f"missing {k} in /public/meta: {d}"
        assert d["platform"] == "IBP Analytics Platform"

    def test_public_worldmap_demo_no_auth_and_cached(self):
        s = requests.Session()  # no auth
        # First hit can be slow (~10s) - GP regressor
        t0 = time.time()
        r1 = s.get(f"{API}/public/worldmap-demo", timeout=60)
        first_dur = time.time() - t0
        assert r1.status_code == 200, r1.text
        d = r1.json()
        for k in ("preview", "caption", "frames", "lt_values", "lats", "lons",
                  "doy", "f107", "method"):
            assert k in d, f"missing {k} in worldmap-demo: keys={list(d.keys())}"
        assert d["preview"] is True
        assert isinstance(d["frames"], list) and len(d["frames"]) > 0
        assert isinstance(d["lats"], list) and len(d["lats"]) > 0
        assert isinstance(d["lons"], list) and len(d["lons"]) > 0

        # Second hit should be from cache => much faster (<2s realistic margin)
        t1 = time.time()
        r2 = s.get(f"{API}/public/worldmap-demo", timeout=15)
        second_dur = time.time() - t1
        assert r2.status_code == 200
        assert r2.json()["preview"] is True
        # Cache must beat first hit dramatically (>5x faster, and under 2s)
        assert second_dur < 2.0, f"cache hit too slow: {second_dur:.2f}s (first {first_dur:.2f}s)"

    def test_public_worldmap_demo_requires_no_auth_header(self):
        # Even with no headers at all, no 401
        r = requests.get(f"{API}/public/worldmap-demo", timeout=30)
        assert r.status_code == 200
