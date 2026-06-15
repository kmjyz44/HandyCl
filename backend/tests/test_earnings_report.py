"""Regression tests for /api/earnings and /api/earnings/report endpoints."""
import os
import requests

API_URL = os.environ.get("PUBLIC_API_URL", "https://payout-hub-20.preview.emergentagent.com")
PROVIDER_EMAIL = "provider@handyhub.com"
PROVIDER_PASS = "Provider2024!"


def _login():
    r = requests.post(f"{API_URL}/api/auth/login", json={"email": PROVIDER_EMAIL, "password": PROVIDER_PASS}, timeout=10)
    r.raise_for_status()
    return r.json()["session_token"]


def test_earnings_summary():
    token = _login()
    r = requests.get(f"{API_URL}/api/earnings", headers={"Authorization": f"Bearer {token}"}, timeout=10)
    assert r.status_code == 200
    data = r.json()
    for k in ("total_earnings", "total_tips", "total_jobs", "total_hours", "pending_amount"):
        assert k in data, f"missing key {k}"


def test_earnings_history():
    token = _login()
    r = requests.get(f"{API_URL}/api/earnings/history?limit=50", headers={"Authorization": f"Bearer {token}"}, timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_report_monthly_pdf():
    token = _login()
    r = requests.get(
        f"{API_URL}/api/earnings/report?type=monthly&month=2025-03",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("application/pdf")
    assert r.content.startswith(b"%PDF"), "Response is not a PDF"
    assert len(r.content) > 1000


def test_report_yearly_pdf():
    token = _login()
    r = requests.get(
        f"{API_URL}/api/earnings/report?type=yearly&year=2025",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    assert r.status_code == 200
    assert r.content.startswith(b"%PDF")


def test_report_tax_pdf():
    token = _login()
    r = requests.get(
        f"{API_URL}/api/earnings/report?type=tax&year=2025",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    assert r.status_code == 200
    assert r.content.startswith(b"%PDF")
    assert "Content-Disposition" in r.headers


def test_report_invalid_type():
    token = _login()
    r = requests.get(
        f"{API_URL}/api/earnings/report?type=bogus",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    assert r.status_code in (400, 422)


def test_report_requires_auth():
    r = requests.get(f"{API_URL}/api/earnings/report?type=tax&year=2025", timeout=10)
    assert r.status_code in (401, 403)
