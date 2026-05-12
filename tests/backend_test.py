import pytest
from fastapi.testclient import TestClient
from backend.server import app
from backend.app.db import get_db
from motor.motor_asyncio import AsyncIOMotorClient
import os

# Test client
client = TestClient(app)

# Mock database for tests
@pytest.fixture
async def mock_db():
    # Use a test database
    test_client = AsyncIOMotorClient("mongodb://localhost:27017")
    test_db = test_client.test_plasma_bubbles
    yield test_db
    # Cleanup
    await test_client.drop_database("test_plasma_bubbles")
    test_client.close()

def test_root_endpoint():
    response = client.get("/api/")
    assert response.status_code == 200
    assert response.json() == {"service": "IBP Analytics Platform", "status": "ok"}

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_register_user():
    user_data = {
        "email": "test@example.com",
        "password": "testpass123",
        "name": "Test User",
        "role": "researcher"
    }
    response = client.post("/api/auth/register", json=user_data)
    assert response.status_code == 201
    data = response.json()
    assert "user" in data
    assert "access_token" in data
    assert data["user"]["email"] == user_data["email"]

def test_login_user():
    # First register
    user_data = {
        "email": "login@example.com",
        "password": "testpass123",
        "name": "Login User",
        "role": "researcher"
    }
    client.post("/api/auth/register", json=user_data)

    # Then login
    login_data = {
        "email": "login@example.com",
        "password": "testpass123"
    }
    response = client.post("/api/auth/login", json=login_data)
    assert response.status_code == 200
    data = response.json()
    assert "user" in data
    assert "access_token" in data

def test_ibp_meta():
    response = client.get("/api/ibp/meta")
    assert response.status_code == 200
    data = response.json()
    assert "model_source" in data
    assert "grid_cap" in data

def test_ibp_calculate():
    # Register and login first
    user_data = {
        "email": "calc@example.com",
        "password": "testpass123",
        "name": "Calc User",
        "role": "researcher"
    }
    register_response = client.post("/api/auth/register", json=user_data)
    token = register_response.json()["access_token"]

    headers = {"Authorization": f"Bearer {token}"}
    calc_data = {
        "day_month": 180,
        "lon": -75.0,
        "lt": 20.0,
        "f107": 150.0
    }
    response = client.post("/api/ibp/calculate", json=calc_data, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "ibp" in data
    assert "confidence" in data
    assert "explanation" in data

def test_create_experiment():
    # Register and login
    user_data = {
        "email": "exp@example.com",
        "password": "testpass123",
        "name": "Exp User",
        "role": "researcher"
    }
    register_response = client.post("/api/auth/register", json=user_data)
    token = register_response.json()["access_token"]

    headers = {"Authorization": f"Bearer {token}"}
    exp_data = {
        "name": "Test Experiment",
        "description": "A test experiment",
        "params": {
            "day_month": 180,
            "f107": 150.0,
            "lon_range": {"min": -180, "max": 180, "step": 10},
            "lt_range": {"min": 18, "max": 6, "step": 1}
        }
    }
    response = client.post("/api/experiments", json=exp_data, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == exp_data["name"]
    assert "id" in data

def test_list_experiments():
    # Register and login
    user_data = {
        "email": "list@example.com",
        "password": "testpass123",
        "name": "List User",
        "role": "researcher"
    }
    register_response = client.post("/api/auth/register", json=user_data)
    token = register_response.json()["access_token"]

    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/experiments", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)