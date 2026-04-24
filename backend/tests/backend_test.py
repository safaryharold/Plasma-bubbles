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

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ibp-analytics.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@ibp.dev"
ADMIN_PASSWORD = "admin123"


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
                      json={"email": email, "password": "research123", "name": "Test Researcher"},
                      timeout=10)
    assert r.status_code == 200, f"Register failed: {r.text}"
    data = r.json()
    return {"email": email, "password": "research123", "token": data["access_token"], "user": data["user"]}


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
                          json={"email": email, "password": "pw123456", "name": "A B"}, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["user"]["email"] == email
        assert body["user"]["role"] == "researcher"
        assert body["access_token"]

        # login with same creds
        r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": "pw123456"}, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["access_token"]

    def test_register_duplicate(self, researcher):
        r = requests.post(f"{API}/auth/register",
                          json={"email": researcher["email"], "password": "research123", "name": "dup"}, timeout=10)
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
                          json={"email": other_email, "password": "pw123456", "name": "Other"}, timeout=10)
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
