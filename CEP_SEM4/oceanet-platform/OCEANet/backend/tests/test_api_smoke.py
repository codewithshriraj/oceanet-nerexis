import atexit
import os
import secrets
import shutil
import tempfile

from fastapi.testclient import TestClient

# Keep tests isolated from live workspace data and background refresh threads.
_TEST_DATA_ROOT = tempfile.mkdtemp(prefix="nerexis-test-data-")
os.environ["NEREXIS_DATA_ROOT"] = _TEST_DATA_ROOT
os.environ["NEREXIS_ENABLE_BACKGROUND_REFRESH"] = "0"
atexit.register(lambda: shutil.rmtree(_TEST_DATA_ROOT, ignore_errors=True))

from app.main import app

client = TestClient(app)


def _create_test_user_and_token() -> tuple[str, str]:
    unique = secrets.token_hex(4)
    email = f"test-{unique}@example.com"
    password = "SecurePass123"

    signup = client.post(
        "/auth/signup",
        json={
            "name": "Test User",
            "email": email,
            "password": password,
            "login_type": "general",
        },
    )
    assert signup.status_code == 200, signup.text

    signin = client.post(
        "/auth/signin",
        json={
            "email": email,
            "password": password,
            "login_type": "general",
        },
    )
    assert signin.status_code == 200, signin.text
    payload = signin.json()
    assert "token" in payload
    return email, payload["token"]


def test_health_endpoint() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"


def test_ready_endpoint() -> None:
    response = client.get("/ready")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "degraded"}


def test_request_id_and_process_time_headers_present() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert "x-request-id" in response.headers
    assert "x-process-time-ms" in response.headers


def test_metrics_endpoint_exposes_prometheus_format() -> None:
    # Prime metrics with a standard endpoint call.
    health_response = client.get("/health")
    assert health_response.status_code == 200

    metrics_response = client.get("/metrics")
    assert metrics_response.status_code == 200
    content_type = metrics_response.headers.get("content-type", "")
    assert "text/plain" in content_type
    assert "oceanet_http_requests_total" in metrics_response.text


def test_auth_signup_and_signin() -> None:
    _email, token = _create_test_user_and_token()
    assert isinstance(token, str)
    assert token


def test_auth_me_and_signout_flow() -> None:
    email, token = _create_test_user_and_token()
    headers = {"Authorization": f"Bearer {token}"}

    me_response = client.get("/auth/me", headers=headers)
    assert me_response.status_code == 200, me_response.text
    me_payload = me_response.json()
    assert me_payload["user"]["email"] == email

    signout_response = client.post("/auth/signout", headers=headers)
    assert signout_response.status_code == 200, signout_response.text
    assert signout_response.json().get("ok") is True

    me_after_signout = client.get("/auth/me", headers=headers)
    assert me_after_signout.status_code == 401


def test_auth_me_requires_authorization_header() -> None:
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_validation_error_shape() -> None:
    response = client.post("/auth/signin", json={"email": "bad", "password": "123"})
    assert response.status_code == 422
    payload = response.json()
    assert payload["detail"] == "Validation failed"
    assert isinstance(payload["errors"], list)


def test_reports_list_endpoint() -> None:
    response = client.get("/reports/")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert isinstance(payload.get("reports"), list)
    assert "ml_overview" in payload


def test_reports_sync_status_endpoint() -> None:
    response = client.get("/reports/sync/status")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert "schedule_interval_seconds" in payload
    assert "thread_alive" in payload


def test_reports_not_found_endpoints() -> None:
    report_response = client.get("/reports/9999999")
    assert report_response.status_code == 404

    shared_response = client.get("/reports/shared/not-a-real-token")
    assert shared_response.status_code == 404


def test_reports_sync_trigger_requires_admin_authorization() -> None:
    response = client.post("/reports/sync/trigger")
    assert response.status_code == 401
