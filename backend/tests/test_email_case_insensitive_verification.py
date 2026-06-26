"""
Backend tests for the email case-insensitivity fix on auth flows.

Bug fixed:
  Registration stored email AS-TYPED (mixed case e.g. "Nexus.ss.llc@gmail.com")
  while /auth/verify-email and /auth/resend-verification lowercased the email
  before exact lookup, so the docs never matched, causing "User not found"
  on resend.

Fix verified here:
  - register() now stores email lowercased.
  - login / verify-email / resend-verification use a case-insensitive regex
    match (_ci_email).
"""

import os
import time
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

API = f"{BASE_URL}/api"

# ---------- fixtures ----------

@pytest.fixture(scope="session")
def db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _unique_mixed_email():
    """Return an email with deliberately mixed-case local + host parts."""
    ts = int(time.time() * 1000)
    return f"TestUser_{ts}@Gmail.com"


# ---------- registration: stores lowercased ----------

class TestRegistrationLowercases:
    """Bug fix 1: register() must persist email as lowercase."""

    def test_register_mixed_case_email_stored_lowercased(self, http, db):
        mixed = _unique_mixed_email()
        lowered = mixed.lower()

        r = http.post(f"{API}/auth/register", json={
            "email": mixed,
            "password": "Test1234",
            "name": "Case Test User",
            "role": "client",
            "accepted_terms": True,
        })
        assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("session_token"), "no session_token in register response"
        user = body.get("user") or {}
        # API response itself should be lowercased
        assert user.get("email") == lowered, (
            f"API returned email '{user.get('email')}', expected lowercase '{lowered}'"
        )

        # DB persistence check: row must exist with lowercased email
        doc = db.users.find_one({"email": lowered})
        assert doc is not None, "user not found by lowercased email in DB"
        assert doc["email"] == lowered

        # And the mixed-case form must NOT exist as a separate doc
        same_mixed = db.users.find_one({"email": mixed})
        # case-sensitive default lookup on the lowercased field must fail to match the mixed form
        assert same_mixed is None, "DB contains mixed-case email row — registration did not lowercase"


# ---------- end-to-end: resend / verify / login / duplicate ----------

class TestCaseInsensitiveAuthFlow:
    """Bug fix 2-5: resend, verify, login, duplicate all case-insensitive."""

    @pytest.fixture
    def registered_user(self, http, db):
        mixed = _unique_mixed_email()
        password = "Test1234"
        r = http.post(f"{API}/auth/register", json={
            "email": mixed,
            "password": password,
            "name": "Flow Test",
            "role": "client",
            "accepted_terms": True,
        })
        assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
        return {"mixed": mixed, "lower": mixed.lower(), "upper": mixed.upper(), "password": password}

    def test_resend_verification_with_uppercase_email_does_not_404(self, http, registered_user):
        """The original bug: this returned 404 'User not found'. After fix it must
        return 200 OR 429 cooldown (since we just registered <60s ago)."""
        r = http.post(f"{API}/auth/resend-verification", json={"email": registered_user["upper"]})
        assert r.status_code in (200, 429), (
            f"Expected 200 or 429 (cooldown) for case-insensitive resend, got "
            f"{r.status_code}: {r.text}"
        )
        # Critical: it must NOT be 404 'User not found'
        assert r.status_code != 404, "REGRESSION: case-mismatch resend returns 404"
        if r.status_code == 429:
            assert "60" in r.text or "wait" in r.text.lower()

    def test_resend_verification_for_nonexistent_email_still_404(self, http):
        """Negative case must still 404."""
        r = http.post(f"{API}/auth/resend-verification",
                      json={"email": f"NoSuch_{int(time.time()*1000)}@Example.com"})
        assert r.status_code == 404, f"expected 404 for unknown email, got {r.status_code}: {r.text}"

    def test_verify_email_with_different_case_and_valid_code(self, http, db, registered_user):
        """Verify-email must succeed when email is sent in a different case but
        the 6-digit code matches, and the user row must flip email_verified=true."""
        # The code is keyed by lowercased email in DB
        rec = db.email_verifications.find_one({"email": registered_user["lower"]})
        assert rec and rec.get("code"), "no verification code row found in DB"
        code = rec["code"]

        # Use UPPER-cased email when posting verify
        r = http.post(f"{API}/auth/verify-email", json={
            "email": registered_user["upper"],
            "code": code,
        })
        assert r.status_code == 200, f"verify-email failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("verified") is True
        assert body.get("ok") is True

        # users.email_verified flipped
        u = db.users.find_one({"email": registered_user["lower"]})
        assert u is not None
        assert u.get("email_verified") is True, "email_verified was not set on user"
        # verification record consumed
        assert db.email_verifications.find_one({"email": registered_user["lower"]}) is None

    def test_resend_verification_after_already_verified(self, http, db, registered_user):
        """After verification, resend must return {already_verified: true} (200)."""
        # verify first
        rec = db.email_verifications.find_one({"email": registered_user["lower"]})
        assert rec, "missing verification code"
        http.post(f"{API}/auth/verify-email", json={
            "email": registered_user["lower"],
            "code": rec["code"],
        })
        # now resend on a different case
        r = http.post(f"{API}/auth/resend-verification",
                      json={"email": registered_user["mixed"]})
        assert r.status_code == 200, f"resend on verified user got {r.status_code}: {r.text}"
        assert r.json().get("already_verified") is True

    def test_login_with_original_mixed_case_email(self, http, registered_user):
        """Login must accept the user's original mixed-case email and password."""
        r = http.post(f"{API}/auth/login", json={
            "email": registered_user["mixed"],
            "password": registered_user["password"],
        })
        assert r.status_code == 200, f"login mixed-case failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("session_token")
        assert (body.get("user") or {}).get("email") == registered_user["lower"]

    def test_login_with_uppercase_email(self, http, registered_user):
        r = http.post(f"{API}/auth/login", json={
            "email": registered_user["upper"],
            "password": registered_user["password"],
        })
        assert r.status_code == 200, f"login upper-case failed: {r.status_code} {r.text}"

    def test_duplicate_registration_different_case_is_rejected(self, http, registered_user):
        """A second registration on the same email in a different case must be
        rejected with 400 'Email already registered'."""
        # Try registering with the all-uppercase form
        r = http.post(f"{API}/auth/register", json={
            "email": registered_user["upper"],
            "password": "Other1234",
            "name": "Duplicate Attempt",
            "role": "client",
            "accepted_terms": True,
        })
        assert r.status_code == 400, (
            f"Expected 400 duplicate, got {r.status_code}: {r.text}"
        )
        assert "already" in r.text.lower()


# ---------- cleanup ----------

@pytest.fixture(scope="session", autouse=True)
def _cleanup(db):
    yield
    # Delete TEST users created by this run (any case)
    db.users.delete_many({"email": {"$regex": "^testuser_", "$options": "i"}})
    db.email_verifications.delete_many({"email": {"$regex": "^testuser_", "$options": "i"}})
