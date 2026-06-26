"""
Backend verification for the duplicate-email 400 detail used by the new
frontend error banner. Covers:
 1) Fresh unique email -> 200 + session_token + user (role=provider, phone all digits).
 2) Same email again -> 400 'Email already registered'.
 3) Same email different case -> 400 'Email already registered' (case-insensitive).
 4) accepted_terms=false -> 400 mentioning Terms.
 5) Role 'provider' works (covered by #1).
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://payment-flow-test-39.preview.emergentagent.com").rstrip("/")
REGISTER_URL = f"{BASE_URL}/api/auth/register"


@pytest.fixture(scope="module")
def fresh_email():
    return f"fresh_{int(time.time())}_{os.getpid()}@example.com"


@pytest.fixture(scope="module")
def cleanup_emails():
    emails = []
    yield emails
    # Best-effort cleanup via direct mongo (skipped if pymongo not available)
    try:
        from pymongo import MongoClient
        import re
        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME")
        if not mongo_url or not db_name:
            # try reading backend/.env
            from pathlib import Path
            envp = Path("/app/backend/.env")
            if envp.exists():
                for line in envp.read_text().splitlines():
                    if line.startswith("MONGO_URL=") and not mongo_url:
                        mongo_url = line.split("=", 1)[1].strip()
                    if line.startswith("DB_NAME=") and not db_name:
                        db_name = line.split("=", 1)[1].strip()
        if mongo_url and db_name:
            client = MongoClient(mongo_url)
            db = client[db_name]
            for em in emails:
                rx = {"$regex": f"^{re.escape(em)}$", "$options": "i"}
                db.users.delete_many({"email": rx})
                db.email_verifications.delete_many({"email": rx})
                db.user_sessions.delete_many({})  # safe; will be recreated
    except Exception as e:
        print(f"Cleanup skipped: {e}")


def _payload(email, accepted_terms=True, role="provider"):
    return {
        "email": email,
        "password": "Test1234",
        "name": "Fresh",
        "role": role,
        "phone": "3317713444",
        "accepted_terms": accepted_terms,
    }


# Test 1 & 5: Fresh registration with provider role
def test_register_fresh_unique_email_returns_200(fresh_email, cleanup_emails):
    cleanup_emails.append(fresh_email)
    r = requests.post(REGISTER_URL, json=_payload(fresh_email), timeout=30)
    assert r.status_code == 200, f"Expected 200 got {r.status_code}: {r.text}"
    data = r.json()
    assert "session_token" in data and isinstance(data["session_token"], str) and len(data["session_token"]) > 0
    assert "user" in data
    user = data["user"]
    assert user["email"] == fresh_email.lower()
    assert user["name"] == "Fresh"
    assert user["role"] == "provider"
    assert user["phone"] == "3317713444"
    assert user.get("email_verified") is False


# Test 2: Duplicate same case -> 400 'Email already registered'
def test_register_duplicate_same_case_returns_400(fresh_email):
    r = requests.post(REGISTER_URL, json=_payload(fresh_email), timeout=30)
    assert r.status_code == 400, f"Expected 400 got {r.status_code}: {r.text}"
    data = r.json()
    assert data.get("detail") == "Email already registered", f"Got detail: {data.get('detail')}"


# Test 3: Duplicate different case -> 400 'Email already registered'
def test_register_duplicate_uppercase_returns_400(fresh_email):
    upper = fresh_email.upper()
    r = requests.post(REGISTER_URL, json=_payload(upper), timeout=30)
    assert r.status_code == 400, f"Expected 400 got {r.status_code}: {r.text}"
    data = r.json()
    assert data.get("detail") == "Email already registered", f"Got detail: {data.get('detail')}"


# Test 4: accepted_terms=false -> 400 with Terms message
def test_register_without_accepted_terms_returns_400(cleanup_emails):
    em = f"noterms_{int(time.time())}_{os.getpid()}@example.com"
    cleanup_emails.append(em)
    r = requests.post(REGISTER_URL, json=_payload(em, accepted_terms=False), timeout=30)
    assert r.status_code == 400, f"Expected 400 got {r.status_code}: {r.text}"
    detail = (r.json().get("detail") or "")
    assert "Terms" in detail or "terms" in detail.lower(), f"Got detail: {detail}"
