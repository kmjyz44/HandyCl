"""Tests for the new PUT /api/admin/users/{user_id}/role endpoint + SUPPORT role gating."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://payment-flow-test-39.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@handyhub.com"
ADMIN_PASSWORD = "Admin2024!"
CLIENT_EMAIL = "client@handyhub.com"
CLIENT_PASSWORD = "Admin2024!"

EXPECTED_MODULES = {"tasks", "bookings", "users", "payments", "reviews",
                    "messages", "services", "analytics", "settings"}


# ---------- helpers ----------
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("session_token") or data.get("access_token") or data.get("token")
    assert token, f"no token in login resp: {data}"
    return token, data


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _register(email, password="Test1234", role="client"):
    payload = {
        "email": email,
        "password": password,
        "name": "TEST User",
        "phone": f"+3805{uuid.uuid4().int % 10**8:08d}",
        "role": role,
        "accepted_terms": True,
    }
    r = requests.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("session_token") or data.get("access_token") or data.get("token")
    user = data.get("user") or {}
    uid = user.get("user_id") or user.get("id") or data.get("user_id")
    return token, uid, data


def _me(tok):
    r = requests.get(f"{API}/auth/me", headers=_hdr(tok), timeout=30)
    assert r.status_code == 200, f"/auth/me failed: {r.status_code} {r.text}"
    return r.json()


def _admin_get_user_role(admin_tok, user_id):
    """Try several admin endpoints to fetch a user's record."""
    # Try direct user endpoint
    for path in (f"/admin/users/{user_id}", f"/admin/users"):
        r = requests.get(f"{API}{path}", headers=_hdr(admin_tok), timeout=30)
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, dict) and "items" in data:
                for u in data["items"]:
                    if u.get("user_id") == user_id or u.get("id") == user_id:
                        return u
            elif isinstance(data, list):
                for u in data:
                    if u.get("user_id") == user_id or u.get("id") == user_id:
                        return u
            elif isinstance(data, dict) and (data.get("user_id") == user_id or data.get("id") == user_id):
                return data
    return None


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    tok, _ = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    return tok


@pytest.fixture(scope="module")
def admin_user(admin_token):
    return _me(admin_token)


@pytest.fixture
def fresh_user():
    """Register a throwaway client user and return (token, user_id, email)."""
    email = f"test_role_{uuid.uuid4().hex[:10]}@example.com"
    tok, uid, _ = _register(email, "Test1234", "client")
    if not uid:
        # fall back via /auth/me
        me = _me(tok)
        uid = me.get("user_id") or me.get("id")
    return tok, uid, email


# ---------- tests ----------
class TestAdminRoleChange:

    def test_admin_login(self, admin_token, admin_user):
        assert admin_user.get("role") == "admin"

    def test_change_role_to_support(self, admin_token, fresh_user):
        _utok, uid, email = fresh_user
        r = requests.put(f"{API}/admin/users/{uid}/role",
                         headers=_hdr(admin_token), json={"role": "support"}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("role") == "support"
        # verify via admin listing
        u = _admin_get_user_role(admin_token, uid)
        assert u is not None, "user not visible in admin listing"
        assert u.get("role") == "support"
        # verify the user themselves see updated role via /auth/me after re-login
        new_tok, _ = _login(email, "Test1234")
        me = _me(new_tok)
        assert me.get("role") == "support"

    def test_change_role_to_moderator_grants_modules(self, admin_token, fresh_user):
        _utok, uid, email = fresh_user
        r = requests.put(f"{API}/admin/users/{uid}/role",
                         headers=_hdr(admin_token), json={"role": "moderator"}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("role") == "moderator"
        mods = set(body.get("moderator_modules") or [])
        assert mods == EXPECTED_MODULES, f"unexpected modules: {mods}"
        # confirm persisted
        u = _admin_get_user_role(admin_token, uid)
        if u is not None and "moderator_modules" in u:
            assert set(u["moderator_modules"]) == EXPECTED_MODULES

    def test_change_role_to_admin_clears_modules(self, admin_token, fresh_user):
        _utok, uid, email = fresh_user
        # first set moderator (so modules are non-empty)
        r1 = requests.put(f"{API}/admin/users/{uid}/role",
                          headers=_hdr(admin_token), json={"role": "moderator"}, timeout=30)
        assert r1.status_code == 200
        # then promote to admin
        r = requests.put(f"{API}/admin/users/{uid}/role",
                        headers=_hdr(admin_token), json={"role": "admin"}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("role") == "admin"
        assert body.get("moderator_modules") == [] or body.get("moderator_modules") is None
        # verify via /auth/me of that user
        new_tok, _ = _login(email, "Test1234")
        me = _me(new_tok)
        assert me.get("role") == "admin"

    def test_change_role_to_provider(self, admin_token, fresh_user):
        _utok, uid, email = fresh_user
        r = requests.put(f"{API}/admin/users/{uid}/role",
                         headers=_hdr(admin_token), json={"role": "provider"}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("role") == "provider"
        new_tok, _ = _login(email, "Test1234")
        assert _me(new_tok).get("role") == "provider"

    def test_change_role_to_client(self, admin_token, fresh_user):
        _utok, uid, email = fresh_user
        # already client; move to provider then back to client to test transition
        requests.put(f"{API}/admin/users/{uid}/role",
                     headers=_hdr(admin_token), json={"role": "provider"}, timeout=30)
        r = requests.put(f"{API}/admin/users/{uid}/role",
                         headers=_hdr(admin_token), json={"role": "client"}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("role") == "client"

    def test_invalid_role_returns_400(self, admin_token, fresh_user):
        _utok, uid, _ = fresh_user
        r = requests.put(f"{API}/admin/users/{uid}/role",
                         headers=_hdr(admin_token), json={"role": "superuser"}, timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

    def test_admin_cannot_change_own_role(self, admin_token, admin_user):
        admin_uid = admin_user.get("user_id") or admin_user.get("id")
        r = requests.put(f"{API}/admin/users/{admin_uid}/role",
                         headers=_hdr(admin_token), json={"role": "client"}, timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

    def test_non_admin_cannot_change_role(self, fresh_user):
        # use a freshly created client to attempt to change another user's role
        client_tok, client_uid, _ = fresh_user
        # create a second throwaway user as target
        email2 = f"test_role_target_{uuid.uuid4().hex[:8]}@example.com"
        _, target_uid, _ = _register(email2)
        r = requests.put(f"{API}/admin/users/{target_uid}/role",
                         headers=_hdr(client_tok), json={"role": "provider"}, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_support_user_cannot_change_role(self, admin_token):
        # create user, promote to support, then attempt role change → should be 403
        email = f"test_supp_{uuid.uuid4().hex[:8]}@example.com"
        _, uid, _ = _register(email)
        r1 = requests.put(f"{API}/admin/users/{uid}/role",
                          headers=_hdr(admin_token), json={"role": "support"}, timeout=30)
        assert r1.status_code == 200
        # re-login to refresh role
        supp_tok, _ = _login(email, "Test1234")
        # create another user
        email2 = f"test_supp_target_{uuid.uuid4().hex[:8]}@example.com"
        _, uid2, _ = _register(email2)
        r = requests.put(f"{API}/admin/users/{uid2}/role",
                         headers=_hdr(supp_tok), json={"role": "provider"}, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"


class TestSupportRequestsGating:

    def test_support_can_list_support_requests(self, admin_token):
        email = f"test_supp_list_{uuid.uuid4().hex[:8]}@example.com"
        _, uid, _ = _register(email)
        r1 = requests.put(f"{API}/admin/users/{uid}/role",
                          headers=_hdr(admin_token), json={"role": "support"}, timeout=30)
        assert r1.status_code == 200
        supp_tok, _ = _login(email, "Test1234")
        r = requests.get(f"{API}/admin/support-requests",
                         headers=_hdr(supp_tok), timeout=30)
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
        body = r.json()
        assert "items" in body and "total" in body

    def test_support_can_update_support_request(self, admin_token):
        # create user, promote to support
        email = f"test_supp_upd_{uuid.uuid4().hex[:8]}@example.com"
        _, uid, _ = _register(email)
        requests.put(f"{API}/admin/users/{uid}/role",
                     headers=_hdr(admin_token), json={"role": "support"}, timeout=30)
        supp_tok, _ = _login(email, "Test1234")

        # update a non-existent request → should be 404 (NOT 403) – proves auth passed
        fake_id = f"req-nope-{uuid.uuid4().hex[:8]}"
        r = requests.put(f"{API}/admin/support-requests/{fake_id}",
                         headers=_hdr(supp_tok), json={"status": "resolved"}, timeout=30)
        assert r.status_code in (404, 200), f"unexpected: {r.status_code} {r.text}"
        # explicitly not 403 (would mean gating wrong)
        assert r.status_code != 403

    def test_plain_client_forbidden_on_support_requests(self):
        # register a fresh throwaway client (seeded client account may not exist)
        email = f"test_client_supp_{uuid.uuid4().hex[:8]}@example.com"
        client_tok, _, _ = _register(email)
        r = requests.get(f"{API}/admin/support-requests",
                         headers=_hdr(client_tok), timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

        fake_id = f"req-nope-{uuid.uuid4().hex[:8]}"
        r2 = requests.put(f"{API}/admin/support-requests/{fake_id}",
                          headers=_hdr(client_tok), json={"status": "resolved"}, timeout=30)
        assert r2.status_code == 403, f"expected 403, got {r2.status_code}: {r2.text}"

    def test_admin_can_list_support_requests(self, admin_token):
        r = requests.get(f"{API}/admin/support-requests",
                         headers=_hdr(admin_token), timeout=30)
        assert r.status_code == 200, r.text
