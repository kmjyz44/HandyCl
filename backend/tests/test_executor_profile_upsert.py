"""
Tests for the upsert behavior of PUT /api/profile/executor.

Covers:
1. A freshly-promoted provider with NO executor_profile can save via PUT and
   the profile is created (upsert). Verified with a follow-up GET.
2. Regression: existing seeded provider (provider@handyhub.com) can still
   PUT their profile and values persist, without creating duplicates.
3. Regression: minimum_hours saves and reads back correctly.

Uses local MongoDB (same DB the backend is bound to) for setup/cleanup
of the throwaway user's executor_profile document, per test request.
"""
import os
import uuid
import time
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

PROVIDER_EMAIL = "provider@handyhub.com"
PROVIDER_PASSWORD = "Provider2024!"


# ---------- fixtures ----------

@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(api, email, password):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    body = r.json()
    return body["session_token"], body["user"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Test 1: fresh provider upsert ----------

@pytest.fixture(scope="module")
def fresh_provider(api, mongo_db):
    """Register a throwaway provider, then delete any executor_profile for
    them to simulate an admin-promoted user with no profile yet."""
    unique = uuid.uuid4().hex[:8]
    email = f"TEST_upsert_{unique}@example.com"
    password = "TestUpsert2024!"

    reg_payload = {
        "email": email,
        "password": password,
        "name": "TEST Upsert Provider",
        "role": "provider",
        "accepted_terms": True,
    }
    r = api.post(f"{BASE_URL}/api/auth/register", json=reg_payload)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    body = r.json()
    token = body["session_token"]
    user = body["user"]
    user_id = user["user_id"]

    # Simulate freshly-promoted provider: remove any auto-created executor_profile
    mongo_db.executor_profiles.delete_many({"user_id": user_id})
    # sanity
    assert mongo_db.executor_profiles.find_one({"user_id": user_id}) is None

    yield {"email": email, "password": password, "token": token, "user_id": user_id}

    # teardown
    mongo_db.executor_profiles.delete_many({"user_id": user_id})
    mongo_db.users.delete_many({"user_id": user_id})
    mongo_db.users.delete_many({"email": email})


class TestFreshProviderUpsert:
    def test_put_creates_profile_on_first_save(self, api, fresh_provider, mongo_db):
        payload = {
            "service_radius_km": 24,
            "latitude": 42.0334,
            "longitude": -87.9073,
            "hourly_rate": 30,
        }
        r = api.put(
            f"{BASE_URL}/api/profile/executor",
            json=payload,
            headers=_auth_headers(fresh_provider["token"]),
        )
        assert r.status_code == 200, f"PUT should return 200, got {r.status_code}: {r.text}"

        body = r.json()
        # Response should contain the persisted values
        assert body.get("service_radius_km") == 24
        assert body.get("hourly_rate") == 30
        assert body.get("latitude") == 42.0334
        assert body.get("longitude") == -87.9073
        assert body.get("user_id") == fresh_provider["user_id"]
        assert "created_at" in body  # setOnInsert wrote created_at
        assert "updated_at" in body

        # DB check: exactly one profile exists for this user
        count = mongo_db.executor_profiles.count_documents({"user_id": fresh_provider["user_id"]})
        assert count == 1, f"expected 1 profile after upsert, got {count}"

    def test_get_returns_saved_values(self, api, fresh_provider):
        r = api.get(
            f"{BASE_URL}/api/profile/executor",
            headers=_auth_headers(fresh_provider["token"]),
        )
        assert r.status_code == 200, f"GET after upsert should return 200, got {r.status_code}: {r.text}"
        body = r.json()
        assert body.get("service_radius_km") == 24
        assert body.get("hourly_rate") == 30
        assert body.get("latitude") == 42.0334
        assert body.get("longitude") == -87.9073

    def test_second_put_updates_without_duplicating(self, api, fresh_provider, mongo_db):
        payload = {"service_radius_km": 33, "hourly_rate": 45}
        r = api.put(
            f"{BASE_URL}/api/profile/executor",
            json=payload,
            headers=_auth_headers(fresh_provider["token"]),
        )
        assert r.status_code == 200
        body = r.json()
        assert body.get("service_radius_km") == 33
        assert body.get("hourly_rate") == 45
        # previous fields should still be present
        assert body.get("latitude") == 42.0334
        assert body.get("longitude") == -87.9073

        count = mongo_db.executor_profiles.count_documents({"user_id": fresh_provider["user_id"]})
        assert count == 1, f"upsert must not duplicate, got {count} profiles"


# ---------- Test 2: existing provider regression ----------

class TestExistingProviderRegression:
    def test_existing_provider_can_update(self, api, mongo_db):
        token, user = _login(api, PROVIDER_EMAIL, PROVIDER_PASSWORD)
        user_id = user["user_id"]

        # Snapshot current values so we don't leave the seed data mangled
        before = mongo_db.executor_profiles.find_one({"user_id": user_id}) or {}
        before_radius = before.get("service_radius_km")
        before_rate = before.get("hourly_rate")

        # Pick distinct values
        new_radius = 42
        new_rate = 55.0
        r = api.put(
            f"{BASE_URL}/api/profile/executor",
            json={"service_radius_km": new_radius, "hourly_rate": new_rate},
            headers=_auth_headers(token),
        )
        assert r.status_code == 200, f"PUT for existing provider failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("service_radius_km") == new_radius
        assert body.get("hourly_rate") == new_rate

        # No duplicates
        count = mongo_db.executor_profiles.count_documents({"user_id": user_id})
        assert count == 1, f"regression: duplicate profile created ({count})"

        # GET reflects update
        r2 = api.get(f"{BASE_URL}/api/profile/executor", headers=_auth_headers(token))
        assert r2.status_code == 200
        b2 = r2.json()
        assert b2.get("service_radius_km") == new_radius
        assert b2.get("hourly_rate") == new_rate

        # Restore original values (best-effort) so we don't corrupt seed data
        restore = {}
        if before_radius is not None:
            restore["service_radius_km"] = before_radius
        if before_rate is not None:
            restore["hourly_rate"] = before_rate
        if restore:
            api.put(
                f"{BASE_URL}/api/profile/executor",
                json=restore,
                headers=_auth_headers(token),
            )


# ---------- Test 3: minimum_hours regression ----------

class TestMinimumHoursRegression:
    def test_minimum_hours_saves_and_reads_back(self, api, mongo_db):
        token, user = _login(api, PROVIDER_EMAIL, PROVIDER_PASSWORD)
        user_id = user["user_id"]

        before = mongo_db.executor_profiles.find_one({"user_id": user_id}) or {}
        before_min_hours = before.get("minimum_hours")

        r = api.put(
            f"{BASE_URL}/api/profile/executor",
            json={"minimum_hours": 1.5},
            headers=_auth_headers(token),
        )
        assert r.status_code == 200, f"PUT minimum_hours failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("minimum_hours") == 1.5

        r2 = api.get(f"{BASE_URL}/api/profile/executor", headers=_auth_headers(token))
        assert r2.status_code == 200
        assert r2.json().get("minimum_hours") == 1.5

        # restore
        if before_min_hours is not None:
            api.put(
                f"{BASE_URL}/api/profile/executor",
                json={"minimum_hours": before_min_hours},
                headers=_auth_headers(token),
            )
