"""
Integration tests — FastAPI test client + in-memory MongoDB via mongomock.

Run with:  pytest tests/test_integration.py -v
"""
import pytest
import os

# Must set JWT_SECRET before importing the app
os.environ.setdefault("JWT_SECRET", "test-secret-key-integration")
os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017/ibp_test")

from httpx import AsyncClient, ASGITransport
from server import app


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture(scope="module")
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c


RESEARCHER = {
    "email": "integration@ibp-test.dev",
    "password": "Test@1234!",
    "name": "Integration Tester",
}


# ── Auth ──────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_register(client):
    r = await client.post("/api/auth/register", json=RESEARCHER)
    assert r.status_code == 200
    data = r.json()
    assert data["user"]["email"] == RESEARCHER["email"]
    assert "access_token" in data


@pytest.mark.anyio
async def test_login(client):
    r = await client.post("/api/auth/login", json={
        "email": RESEARCHER["email"],
        "password": RESEARCHER["password"],
    })
    assert r.status_code == 200


@pytest.mark.anyio
async def test_login_wrong_password(client):
    r = await client.post("/api/auth/login", json={
        "email": RESEARCHER["email"],
        "password": "Wrong@1234!",
    })
    assert r.status_code == 401


@pytest.mark.anyio
async def test_me_unauthenticated(client):
    r = await client.get("/api/auth/me")
    assert r.status_code == 401


@pytest.mark.anyio
async def test_me_authenticated(client):
    login = await client.post("/api/auth/login", json={
        "email": RESEARCHER["email"],
        "password": RESEARCHER["password"],
    })
    token = login.json()["access_token"]
    r = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["email"] == RESEARCHER["email"]


@pytest.mark.anyio
async def test_refresh_token_route(client):
    # Log in and confirm refresh works using the same client cookie jar.
    login = await client.post("/api/auth/login", json={
        "email": RESEARCHER["email"],
        "password": RESEARCHER["password"],
    })
    assert login.status_code == 200

    refresh = await client.post("/api/auth/refresh")
    assert refresh.status_code == 200
    assert "access_token" in refresh.json()


# ── IBP calculate ─────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_calculate_valid(client):
    login = await client.post("/api/auth/login", json={
        "email": RESEARCHER["email"],
        "password": RESEARCHER["password"],
    })
    token = login.json()["access_token"]
    r = await client.post(
        "/api/ibp/calculate",
        json={"day_month": 3, "lon": 0.0, "lt": 21.0, "f107": 150.0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert 0.0 <= data["ibp"] <= 1.0
    assert "explanation" in data


@pytest.mark.anyio
async def test_calculate_invalid_params(client):
    login = await client.post("/api/auth/login", json={
        "email": RESEARCHER["email"],
        "password": RESEARCHER["password"],
    })
    token = login.json()["access_token"]
    r = await client.post(
        "/api/ibp/calculate",
        json={"day_month": 999, "lon": 0.0, "lt": 21.0, "f107": 150.0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 422   # Pydantic validation error


# ── Jobs ──────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_list_jobs_empty(client):
    login = await client.post("/api/auth/login", json={
        "email": RESEARCHER["email"],
        "password": RESEARCHER["password"],
    })
    token = login.json()["access_token"]
    r = await client.get(
        "/api/ibp/jobs",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ── Experiments ───────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_experiment_create_and_list(client):
    login = await client.post("/api/auth/login", json={
        "email": RESEARCHER["email"],
        "password": RESEARCHER["password"],
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    create_r = await client.post(
        "/api/experiments",
        json={"name": "Test Experiment", "params": {"day_month": 3, "f107": 150}},
        headers=headers,
    )
    assert create_r.status_code == 200
    exp_id = create_r.json()["id"]

    list_r = await client.get("/api/experiments", headers=headers)
    assert list_r.status_code == 200
    ids = [e["id"] for e in list_r.json()]
    assert exp_id in ids


# ── Health ────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_health(client):
    r = await client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] in ("ok", "degraded")
