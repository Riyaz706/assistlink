"""
API integration test: health and auth contract (no real Supabase).
Purpose: Ensure app starts and public endpoints respond.
Run: cd backend && PYTHONPATH=. pytest tests/integration/test_api_health.py -v
Failure: App or routing broken.
"""
import pytest

pytest.importorskip("fastapi", reason="fastapi not installed")
pytest.importorskip("httpx", reason="httpx not installed")

from fastapi.testclient import TestClient

try:
    from app.main import app
except ImportError as e:
    pytest.skip(f"App not importable (missing deps or config): {e}", allow_module_level=True)

client = TestClient(app)


def test_root():
    r = client.get("/")
    assert r.status_code == 200
    data = r.json()
    assert "message" in data
    assert "AssistLink" in data.get("message", "")


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_health_db():
    r = client.get("/health/db")
    assert r.status_code == 200
    assert "status" in r.json()


def test_login_requires_body():
    r = client.post("/api/auth/login", json={})
    assert r.status_code == 422  # validation error


def test_login_rejects_invalid_email_format():
    r = client.post("/api/auth/login", json={"email": "not-an-email", "password": "somepass"})
    assert r.status_code == 422
