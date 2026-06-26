"""
Backend tests for Admin DELETE /api/admin/users/{user_id} endpoint.

Verifies the fix to the "Delete button doesn't delete user" bug from the
backend side: confirms the endpoint correctly deletes users, enforces
admin auth, handles non-existent users, and prevents self-deletion.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to reading frontend/.env directly
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass

API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@handyhub.com"
ADMIN_PASSWORD = "Admin2024!"


# ---------- Fixtures ----------

@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_auth(http):
    """Login as admin and return (session_token, admin_user_id)."""
    r = http.post(f"{API}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
    }, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("session_token")
    user = data.get("user") or {}
    admin_id = user.get("user_id") or user.get("id")
    assert token, f"No session_token in login response: {data}"
    assert admin_id, f"No admin user_id in login response: {data}"
    return token, admin_id


@pytest.fixture(scope="module")
def admin_headers(admin_auth):
    token, _ = admin_auth
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _make_throwaway_user(http) -> str:
    """Register a throwaway user and return its user_id."""
    unique = uuid.uuid4().hex[:10]
    email = f"test_delete_{unique}@example.com"
    payload = {
        "email": email,
        "password": "TestPass2024!",
        "name": f"TEST Delete {unique}",
        "role": "client",
        "phone": "+10000000000",
        "accepted_terms": True,
    }
    r = http.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    body = r.json()
    user = body.get("user") or {}
    user_id = user.get("user_id") or user.get("id")
    assert user_id, f"No user_id returned by register: {body}"
    return user_id, email


# ---------- Tests ----------

class TestAdminDeleteUser:

    def test_admin_login_ok(self, admin_auth):
        token, admin_id = admin_auth
        assert isinstance(token, str) and token.startswith("session_")
        assert isinstance(admin_id, str) and len(admin_id) > 0

    def test_delete_without_auth_is_rejected(self, http):
        # No Authorization header => 401 or 403
        r = http.delete(f"{API}/admin/users/some_nonexistent_id_xyz", timeout=30)
        assert r.status_code in (401, 403), (
            f"Expected 401/403 without auth, got {r.status_code}: {r.text}"
        )

    def test_delete_nonexistent_user_returns_404(self, http, admin_headers):
        bogus_id = f"user_{uuid.uuid4().hex[:12]}_doesnotexist"
        r = http.delete(f"{API}/admin/users/{bogus_id}",
                        headers=admin_headers, timeout=30)
        assert r.status_code == 404, (
            f"Expected 404 for non-existent user, got {r.status_code}: {r.text}"
        )

    def test_admin_cannot_delete_self(self, http, admin_auth, admin_headers):
        _, admin_id = admin_auth
        r = http.delete(f"{API}/admin/users/{admin_id}",
                        headers=admin_headers, timeout=30)
        assert r.status_code == 400, (
            f"Expected 400 when admin deletes self, got {r.status_code}: {r.text}"
        )
        body = r.json()
        # Spec says detail "Cannot delete yourself"
        detail = (body.get("detail") or "").lower()
        assert "yourself" in detail or "self" in detail, (
            f"Unexpected error detail: {body}"
        )

    def test_create_then_delete_user_success(self, http, admin_headers):
        # Create
        user_id, email = _make_throwaway_user(http)

        # Confirm visible in admin listing
        list_r = http.get(f"{API}/admin/users", headers=admin_headers, timeout=30)
        assert list_r.status_code == 200, f"List users failed: {list_r.text[:200]}"
        users_before = list_r.json()
        # listing might be a list or {"users": [...]}
        if isinstance(users_before, dict) and "users" in users_before:
            users_before = users_before["users"]
        assert isinstance(users_before, list)
        ids_before = {u.get("user_id") or u.get("id") for u in users_before}
        assert user_id in ids_before, (
            f"Newly created user {user_id} not visible in /api/admin/users"
        )

        # Delete
        del_r = http.delete(f"{API}/admin/users/{user_id}",
                            headers=admin_headers, timeout=30)
        assert del_r.status_code == 200, (
            f"Delete failed: {del_r.status_code} {del_r.text}"
        )
        body = del_r.json()
        assert "message" in body, f"No message in delete response: {body}"
        assert "successfully" in body["message"].lower()
        assert body.get("user_id") == user_id
        assert body.get("deleted_user") == email

        # Verify it no longer appears in admin listing
        time.sleep(0.5)
        list_r2 = http.get(f"{API}/admin/users", headers=admin_headers, timeout=30)
        assert list_r2.status_code == 200
        users_after = list_r2.json()
        if isinstance(users_after, dict) and "users" in users_after:
            users_after = users_after["users"]
        ids_after = {u.get("user_id") or u.get("id") for u in users_after}
        assert user_id not in ids_after, (
            f"User {user_id} still present in /api/admin/users after delete"
        )

        # And a second DELETE on the same id should now 404
        del_r2 = http.delete(f"{API}/admin/users/{user_id}",
                             headers=admin_headers, timeout=30)
        assert del_r2.status_code == 404, (
            f"Expected 404 on re-delete, got {del_r2.status_code}: {del_r2.text}"
        )
