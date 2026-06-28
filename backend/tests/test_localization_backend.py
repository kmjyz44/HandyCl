"""Backend regression tests after Ukrainian->English localization of server.py.

Focus:
 1. Core auth still works for admin/client/provider seeded accounts.
 2. Help Center FAQ / support-info / support-request endpoints return English content.
 3. Community Blog CRUD (list, create, get, like, comment, delete) by client.
 4. Payment methods endpoint returns English labels.
 5. Admin Category CRUD + seeded category names are English.
 6. Earnings PDF report endpoint (reportlab) generates without errors (monthly/yearly/tax).
 7. Card validation error message returns English text.
"""
import os
import re
import io
import time
import pytest
import requests

def _load_backend_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v.rstrip("/")
    # Fallback: read from frontend/.env
    try:
        with open("/app/frontend/.env", "r") as f:
            for line in f:
                if line.strip().startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except FileNotFoundError:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL is not set")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@handyhub.com"
ADMIN_PASS = "Admin2024!"
CLIENT_EMAIL = "client@handyhub.com"
CLIENT_PASS = "Client2024!"
PROVIDER_EMAIL = "provider@handyhub.com"
PROVIDER_PASS = "Provider2024!"


# Cyrillic detection — any user-facing string should NOT contain Ukrainian/Russian chars.
CYRILLIC_RE = re.compile(r"[А-Яа-яЇїІіЄєҐґЁё]")


def _is_english(s):
    if not isinstance(s, str):
        return True
    return not CYRILLIC_RE.search(s)


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text[:200]}"
    body = r.json()
    token = body.get("session_token") or body.get("token") or body.get("access_token")
    assert token, f"No token in login response: {list(body.keys())}"
    return token, body


@pytest.fixture(scope="session")
def admin_token():
    t, _ = _login(ADMIN_EMAIL, ADMIN_PASS)
    return t


@pytest.fixture(scope="session")
def client_token():
    t, _ = _login(CLIENT_EMAIL, CLIENT_PASS)
    return t


@pytest.fixture(scope="session")
def provider_token():
    t, _ = _login(PROVIDER_EMAIL, PROVIDER_PASS)
    return t


def _h(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------------- AUTH ----------------------
class TestAuth:
    def test_admin_login(self):
        token, body = _login(ADMIN_EMAIL, ADMIN_PASS)
        assert token and len(token) >= 10
        user = body.get("user") or {}
        assert (user.get("email") or "").lower() == ADMIN_EMAIL

    def test_client_login(self):
        token, body = _login(CLIENT_EMAIL, CLIENT_PASS)
        assert token

    def test_provider_login(self):
        token, body = _login(PROVIDER_EMAIL, PROVIDER_PASS)
        assert token


# ---------------------- HELP CENTER ----------------------
class TestHelpCenter:
    def test_faq_english(self):
        r = requests.get(f"{API}/help/faq", timeout=15)
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        # Could be {categories:[...]} or list directly
        text_blob = repr(data)
        assert _is_english(text_blob), "Cyrillic detected in FAQ response"
        # Sanity: 'HandyHub' or expected English phrase
        assert "HandyHub" in text_blob or "handyhub" in text_blob.lower()

    def test_support_info(self):
        r = requests.get(f"{API}/help/support-info", timeout=15)
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        # Should contain email and/or phone
        assert any(k in data for k in ("email", "support_email", "phone", "support_phone")), data
        assert _is_english(repr(data))

    def test_support_request_create(self):
        payload = {
            "name": "TEST_Localization Bot",
            "email": "TEST_loc@example.com",
            "subject": "TEST_Support subject",
            "message": "Testing that english support request flow works after localization.",
            "category": "general",
        }
        r = requests.post(f"{API}/help/support-request", json=payload, timeout=20)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text[:300]}"
        body = r.json()
        assert _is_english(repr(body))


# ---------------------- BLOG ----------------------
class TestBlog:
    created_post_id = None

    def test_list_posts(self):
        r = requests.get(f"{API}/blog/posts", timeout=15)
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        # accepted shapes: list or {posts:[...]}
        posts = data if isinstance(data, list) else data.get("posts", [])
        assert isinstance(posts, list)

    def test_create_get_like_comment_delete(self, client_token):
        # Create
        payload = {
            "title": "TEST_Localization smoke post",
            "description": "Verifying english blog flow.",
            "images": [],
            "tags": ["test", "localization"],
        }
        r = requests.post(f"{API}/blog/posts", json=payload, headers=_h(client_token), timeout=20)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text[:300]}"
        body = r.json()
        # Find the id
        post_id = (
            body.get("post_id") or body.get("id") or (body.get("post") or {}).get("post_id") or (body.get("post") or {}).get("id")
        )
        assert post_id, f"No id in create response: {body}"
        TestBlog.created_post_id = post_id

        # GET single
        r2 = requests.get(f"{API}/blog/posts/{post_id}", timeout=15)
        assert r2.status_code == 200, r2.text[:200]
        gbody = r2.json()
        assert _is_english(repr(gbody))

        # Like (toggle)
        r3 = requests.post(f"{API}/blog/posts/{post_id}/like", headers=_h(client_token), timeout=15)
        assert r3.status_code in (200, 201), r3.text[:200]

        # Comment
        r4 = requests.post(
            f"{API}/blog/posts/{post_id}/comments",
            json={"text": "TEST_english comment"},
            headers=_h(client_token),
            timeout=15,
        )
        assert r4.status_code in (200, 201), r4.text[:200]

        # Delete
        r5 = requests.delete(f"{API}/blog/posts/{post_id}", headers=_h(client_token), timeout=15)
        assert r5.status_code in (200, 204), r5.text[:200]


# ---------------------- PAYMENT METHODS ----------------------
class TestPaymentMethods:
    def test_methods_english(self, client_token):
        r = requests.get(f"{API}/payments/methods", headers=_h(client_token), timeout=15)
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        methods = data.get("methods", [])
        for m in methods:
            assert _is_english(m.get("label", "")), f"Non-english label: {m}"
        # If finix present, ensure US English label
        finix = next((m for m in methods if m.get("id") == "finix"), None)
        if finix:
            assert "Finix" in finix["label"]
            assert "Apple Pay" in finix["label"]
        bank = next((m for m in methods if m.get("id") == "bank_transfer"), None)
        if bank:
            assert "bank transfer" in bank["label"].lower()


# ---------------------- ADMIN CATEGORY CRUD ----------------------
class TestAdminCategories:
    def test_list_seed_english(self, admin_token):
        r = requests.get(f"{API}/admin/categories", headers=_h(admin_token), timeout=20)
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        cats = data if isinstance(data, list) else data.get("categories", [])
        assert len(cats) > 0, "No categories returned"
        names = [c.get("name", "") for c in cats]
        for n in names:
            assert _is_english(n), f"Non-english category name: {n!r}"
        # Sample: At least one of these English names should exist
        joined = " | ".join(names).lower()
        assert any(
            k in joined for k in ("furniture", "cleaning", "plumbing", "electric", "delivery", "moving")
        ), f"Expected English category among: {names[:30]}"

    def test_create_update_delete_category(self, admin_token):
        payload = {
            "name": "TEST_LocalizationCat",
            "description": "Test category for localization smoke",
            "commission_rate": 10.0,
            "recommended_price": 75.0,
        }
        r = requests.post(f"{API}/admin/categories", json=payload, headers=_h(admin_token), timeout=20)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text[:300]}"
        cat = r.json()
        cat_id = cat.get("category_id") or cat.get("id") or (cat.get("category") or {}).get("id")
        assert cat_id, f"no category id in {cat}"

        # Update
        r2 = requests.put(
            f"{API}/admin/categories/{cat_id}",
            json={"name": "TEST_LocalizationCat2", "commission_rate": 12.5},
            headers=_h(admin_token),
            timeout=20,
        )
        assert r2.status_code in (200, 204), r2.text[:200]

        # Delete (hard)
        r3 = requests.delete(
            f"{API}/admin/categories/{cat_id}?hard=true", headers=_h(admin_token), timeout=20
        )
        assert r3.status_code in (200, 204), r3.text[:200]


# ---------------------- EARNINGS PDF ----------------------
class TestEarningsPDF:
    def test_pdf_monthly(self, provider_token):
        month = time.strftime("%Y-%m")
        r = requests.get(
            f"{API}/earnings/report",
            params={"type": "monthly", "month": month},
            headers=_h(provider_token),
            timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        assert r.headers.get("content-type", "").startswith("application/pdf"), r.headers
        assert r.content[:4] == b"%PDF", "Body is not a valid PDF"

    def test_pdf_yearly(self, provider_token):
        year = time.strftime("%Y")
        r = requests.get(
            f"{API}/earnings/report",
            params={"type": "yearly", "year": year},
            headers=_h(provider_token),
            timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"

    def test_pdf_tax(self, provider_token):
        year = time.strftime("%Y")
        r = requests.get(
            f"{API}/earnings/report",
            params={"type": "tax", "year": year},
            headers=_h(provider_token),
            timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"


# ---------------------- CARD VALIDATION MESSAGE ----------------------
class TestCardValidation:
    def test_invalid_card_english(self, client_token):
        bad = {
            "card_number": "1234",
            "card_holder": "Test User",
            "card_exp_month": "12",
            "card_exp_year": "29",
            "card_cvc": "123",
        }
        r = requests.post(
            f"{API}/users/payment-methods", json=bad, headers=_h(client_token), timeout=15
        )
        # Should be a 4xx
        assert 400 <= r.status_code < 500, f"Expected 4xx, got {r.status_code}: {r.text[:200]}"
        body = r.json()
        detail = body.get("detail") or body.get("message") or repr(body)
        if isinstance(detail, list):  # pydantic validation error array
            detail = repr(detail)
        assert _is_english(detail), f"Non-English error message: {detail!r}"
        assert "card" in detail.lower() or "invalid" in detail.lower()
