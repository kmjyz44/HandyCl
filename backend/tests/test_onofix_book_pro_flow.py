"""
Ono-Fix "Book this pro" flow — backend-only verification for iteration 15.

Covers:
1) POST /api/bookings with a specific provider_id (creates a task assigned to that pro)
2) GET /api/profile/executor/{user_id} returns 200 with a valid profile
   + confirms legacy paths /api/executors/{id}/profile and /api/executors/{id} are 404
3) GET /api/reviews/provider/{provider_id} returns 200 with reviews list

Run: pytest /app/backend/tests/test_onofix_book_pro_flow.py -v \
     --junitxml=/app/test_reports/pytest/onofix_book_pro_flow.xml
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fall back to reading /app/frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for ln in f:
                if ln.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = ln.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass

CLIENT_EMAIL = "client@handyhub.com"
CLIENT_PASSWORD = "Client2024!"
PROVIDER_EMAIL = "provider@handyhub.com"
PROVIDER_PASSWORD = "Provider2024!"


def _login(email: str, password: str) -> str:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text[:200]}"
    tok = r.json().get("session_token")
    assert tok, f"no session_token in {r.json()}"
    return tok


@pytest.fixture(scope="module")
def client_token():
    return _login(CLIENT_EMAIL, CLIENT_PASSWORD)


@pytest.fixture(scope="module")
def provider_token():
    return _login(PROVIDER_EMAIL, PROVIDER_PASSWORD)


@pytest.fixture(scope="module")
def executors_list(client_token):
    r = requests.get(
        f"{BASE_URL}/api/executors",
        headers={"Authorization": f"Bearer {client_token}"},
        timeout=30,
    )
    assert r.status_code == 200, f"/executors failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    assert isinstance(data, list) and len(data) > 0, "no executors returned"
    return data


# =========================================================================
# Feature 1: POST /api/bookings with a specific provider_id
# =========================================================================
class TestBookThisPro:
    def test_create_booking_assigned_to_specific_provider(self, client_token, executors_list):
        # Pick the seeded provider (provider@handyhub.com) if present, else first
        target = next(
            (e for e in executors_list if e.get("email") == PROVIDER_EMAIL),
            executors_list[0],
        )
        provider_id = target["user_id"]
        assert provider_id, f"executor missing user_id: {target}"

        payload = {
            "provider_id": provider_id,
            "category": "handyman_carpentry",  # backend ServiceCategory enum
            "title": "TEST_ Book-this-pro flow",
            "description": "TEST_ Booking created via automated test to verify provider assignment.",
            "address": "123 Test Street, San Francisco, CA",
            "city": "San Francisco",
            "date": "2026-02-01",
            "time": "10:00",
            "provider_hourly_rate": 50.0,
            "total_price": 100.0,
            "estimated_hours": 2.0,
        }
        r = requests.post(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {client_token}"},
            json=payload,
            timeout=30,
        )
        assert r.status_code in (200, 201), (
            f"POST /api/bookings failed {r.status_code}: {r.text[:400]}"
        )
        body = r.json()
        # Booking fields
        assert body.get("booking_id"), f"missing booking_id: {body}"
        assert body.get("provider_id") == provider_id, (
            f"provider_id not persisted correctly: got={body.get('provider_id')} expected={provider_id}"
        )
        assert body.get("status") == "pending_acceptance", (
            f"expected status=pending_acceptance when provider pre-selected, got {body.get('status')}"
        )
        assert body.get("title") == payload["title"]
        assert body.get("client_id"), "missing client_id"

        # Verify persistence via GET /api/bookings (client-scoped list)
        list_r = requests.get(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {client_token}"},
            timeout=30,
        )
        assert list_r.status_code == 200
        listing = list_r.json()
        found = next(
            (b for b in listing if b.get("booking_id") == body["booking_id"]), None
        )
        assert found is not None, "created booking not visible to client in GET /api/bookings"
        assert found.get("provider_id") == provider_id, (
            f"persisted provider_id mismatch: {found.get('provider_id')}"
        )

        # Stash for the next test — provider must see the pending task
        pytest.ono_booking_id = body["booking_id"]
        pytest.ono_provider_id = provider_id

    def test_provider_sees_pending_task(self, provider_token):
        # GET /api/bookings as the provider should surface the booking (or a related task)
        r = requests.get(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {provider_token}"},
            timeout=30,
        )
        assert r.status_code == 200
        listing = r.json()
        booking_id = getattr(pytest, "ono_booking_id", None)
        assert booking_id, "prior test did not set ono_booking_id"
        found = next((b for b in listing if b.get("booking_id") == booking_id), None)
        assert found is not None, (
            f"provider does NOT see the assigned booking {booking_id} — assignment failed"
        )
        assert found.get("status") == "pending_acceptance"


# =========================================================================
# Feature 2: GET /api/profile/executor/{user_id} (View profile fix)
# =========================================================================
class TestExecutorProfileEndpoints:
    def test_get_profile_by_user_id_returns_200(self, executors_list):
        # find a provider that HAS a profile if possible
        candidate = None
        for e in executors_list:
            if e.get("profile"):
                candidate = e
                break
        if candidate is None:
            candidate = executors_list[0]
        uid = candidate["user_id"]

        r = requests.get(f"{BASE_URL}/api/profile/executor/{uid}", timeout=30)
        assert r.status_code == 200, (
            f"/api/profile/executor/{uid} failed {r.status_code}: {r.text[:200]}"
        )
        body = r.json()
        # shape assertions
        assert "user" in body, f"missing user block: keys={list(body.keys())}"
        assert body["user"].get("user_id") == uid
        assert "average_rating" in body
        assert "total_reviews" in body

    def test_legacy_executors_id_profile_returns_404(self, executors_list):
        uid = executors_list[0]["user_id"]
        r = requests.get(f"{BASE_URL}/api/executors/{uid}/profile", timeout=30)
        assert r.status_code == 404, (
            f"/api/executors/{{id}}/profile should be 404 (legacy), got {r.status_code}: {r.text[:200]}"
        )

    def test_legacy_executors_id_returns_404(self, executors_list):
        uid = executors_list[0]["user_id"]
        r = requests.get(f"{BASE_URL}/api/executors/{uid}", timeout=30)
        assert r.status_code == 404, (
            f"/api/executors/{{id}} should be 404 (legacy), got {r.status_code}: {r.text[:200]}"
        )


# =========================================================================
# Feature 3: GET /api/reviews/provider/{provider_id}  (Show all reviews)
# =========================================================================
class TestProviderReviews:
    def test_reviews_endpoint_returns_200_shape(self, executors_list):
        # aggregate review counts for reporting
        counts = []
        for e in executors_list:
            uid = e["user_id"]
            r = requests.get(f"{BASE_URL}/api/reviews/provider/{uid}", timeout=30)
            assert r.status_code == 200, (
                f"/reviews/provider/{uid} failed {r.status_code}: {r.text[:200]}"
            )
            body = r.json()
            assert "reviews" in body and isinstance(body["reviews"], list)
            assert "average_rating" in body
            assert "total_reviews" in body
            assert body["total_reviews"] == len(body["reviews"])
            counts.append((e.get("email") or uid, body["total_reviews"], body["average_rating"]))
        # Print for report visibility
        print("\n=== Reviews per provider ===")
        for email, n, avg in counts:
            print(f"  {email}: total_reviews={n}, average_rating={avg}")
        # at least one provider should have reviews (nice-to-have — do not fail if 0)
        assert all(isinstance(n, int) and n >= 0 for _, n, _ in counts)
