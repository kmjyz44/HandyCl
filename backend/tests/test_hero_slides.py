# Hero slides (Seasonal Slides) feature: public list, image serving, admin CRUD, validation, auth
import base64
import os
import datetime as dt
import pytest
import requests

BASE = os.environ.get("HERO_TEST_API", "http://localhost:8001/api")
IMG_PATH = "/app/assets/images/hero/plumbing.jpg"


def _img():
    with open(IMG_PATH, "rb") as f:
        return "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()


def _login(email, pw):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": pw})
    if r.status_code != 200:
        pytest.skip(f"login failed {email}")
    return {"Authorization": f"Bearer {r.json()['session_token']}"}


@pytest.fixture(scope="module")
def admin():
    return _login("admin@handyhub.com", "Admin2024!")


@pytest.fixture(scope="module")
def client_h():
    return _login("client@handyhub.com", "Client2024!")


@pytest.fixture(scope="module")
def created(admin):
    ids = []
    yield ids
    for i in ids:
        requests.delete(f"{BASE}/admin/hero-slides/{i}", headers=admin)


def _today():
    return dt.datetime.now(dt.timezone.utc).date()


def _public_ids():
    r = requests.get(f"{BASE}/hero-slides")
    assert r.status_code == 200
    return [s["slide_id"] for s in r.json()["slides"]]


class TestAuth:
    def test_no_auth(self):
        assert requests.get(f"{BASE}/admin/hero-slides").status_code in (401, 403)
        assert requests.post(f"{BASE}/admin/hero-slides", json={}).status_code in (401, 403)
        assert requests.put(f"{BASE}/admin/hero-slides/x", json={}).status_code in (401, 403)
        assert requests.delete(f"{BASE}/admin/hero-slides/x").status_code in (401, 403)

    def test_client_forbidden(self, client_h):
        assert requests.get(f"{BASE}/admin/hero-slides", headers=client_h).status_code in (401, 403)
        r = requests.post(f"{BASE}/admin/hero-slides", headers=client_h, json={"title": "x", "image_base64": _img()})
        assert r.status_code in (401, 403)


class TestValidation:
    def test_missing_image(self, admin):
        r = requests.post(f"{BASE}/admin/hero-slides", headers=admin, json={"title": "TEST_x"})
        assert r.status_code == 422

    def test_missing_title(self, admin):
        r = requests.post(f"{BASE}/admin/hero-slides", headers=admin, json={"title": "  ", "image_base64": _img()})
        assert r.status_code == 422

    def test_bad_mime(self, admin):
        r = requests.post(f"{BASE}/admin/hero-slides", headers=admin,
                          json={"title": "TEST_x", "image_base64": "data:application/pdf;base64,AAAA"})
        assert r.status_code == 422

    def test_bad_date(self, admin):
        r = requests.post(f"{BASE}/admin/hero-slides", headers=admin,
                          json={"title": "TEST_x", "image_base64": _img(), "start_date": "2026-13-45"})
        assert r.status_code == 422

    def test_end_before_start(self, admin):
        r = requests.post(f"{BASE}/admin/hero-slides", headers=admin,
                          json={"title": "TEST_x", "image_base64": _img(), "start_date": "2026-05-01", "end_date": "2026-04-01"})
        assert r.status_code == 422

    def test_update_unknown(self, admin):
        assert requests.put(f"{BASE}/admin/hero-slides/hero_nope", headers=admin, json={"title": "a"}).status_code == 404
        assert requests.delete(f"{BASE}/admin/hero-slides/hero_nope", headers=admin).status_code == 404


class TestCRUD:
    def test_create_live_and_public(self, admin, created):
        r = requests.post(f"{BASE}/admin/hero-slides", headers=admin,
                          json={"title": "TEST_Live", "tag": "TEST", "accent": "acc", "order": 5, "image_base64": _img()})
        assert r.status_code == 200, r.text
        d = r.json()
        created.append(d["slide_id"])
        assert d["title"] == "TEST_Live" and d["active"] is True and d["start_date"] is None
        assert d["image_url"].endswith("?v=1")
        assert d["slide_id"] in _public_ids()
        lst = requests.get(f"{BASE}/admin/hero-slides", headers=admin).json()["slides"]
        assert any(s["slide_id"] == d["slide_id"] for s in lst)
        img = requests.get(f"{BASE}/hero-slides/image/{d['slide_id']}")
        assert img.status_code == 200 and img.headers["content-type"].startswith("image/")
        assert len(img.content) > 1000

    def test_date_filters(self, admin, created):
        t = _today()
        cases = {
            "future": (str(t + dt.timedelta(days=5)), str(t + dt.timedelta(days=10)), False),
            "past": (str(t - dt.timedelta(days=10)), str(t - dt.timedelta(days=1)), False),
            "today": (str(t), str(t), True),
            "open_end": (str(t - dt.timedelta(days=1)), None, True),
        }
        ids = {}
        for k, (s, e, _) in cases.items():
            r = requests.post(f"{BASE}/admin/hero-slides", headers=admin,
                              json={"title": f"TEST_{k}", "image_base64": _img(), "start_date": s, "end_date": e})
            assert r.status_code == 200, r.text
            ids[k] = r.json()["slide_id"]
            created.append(ids[k])
        pub = _public_ids()
        for k, (_, _, live) in cases.items():
            assert (ids[k] in pub) == live, k

    def test_toggle_update_image_and_delete(self, admin, created):
        r = requests.post(f"{BASE}/admin/hero-slides", headers=admin, json={"title": "TEST_Upd", "image_base64": _img()})
        sid = r.json()["slide_id"]
        created.append(sid)
        r = requests.put(f"{BASE}/admin/hero-slides/{sid}", headers=admin, json={"active": False})
        assert r.status_code == 200 and r.json()["active"] is False
        assert sid not in _public_ids()
        r = requests.put(f"{BASE}/admin/hero-slides/{sid}", headers=admin,
                         json={"active": True, "title": "TEST_Upd2", "image_base64": _img()})
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_Upd2" and r.json()["image_url"].endswith("?v=2")
        lst = requests.get(f"{BASE}/admin/hero-slides", headers=admin).json()["slides"]
        assert next(s for s in lst if s["slide_id"] == sid)["title"] == "TEST_Upd2"
        r = requests.put(f"{BASE}/admin/hero-slides/{sid}", headers=admin, json={"end_date": "2020-01-01", "start_date": None})
        assert r.status_code == 200
        assert sid not in _public_ids()
        assert requests.delete(f"{BASE}/admin/hero-slides/{sid}", headers=admin).status_code == 200
        lst = requests.get(f"{BASE}/admin/hero-slides", headers=admin).json()["slides"]
        assert all(s["slide_id"] != sid for s in lst)
        assert requests.get(f"{BASE}/hero-slides/image/{sid}").status_code == 404
        assert requests.put(f"{BASE}/admin/hero-slides/{sid}", headers=admin, json={"title": "x"}).status_code == 404

    def test_image_404(self):
        assert requests.get(f"{BASE}/hero-slides/image/hero_unknown").status_code == 404

    def test_non_numeric_order(self, admin, created):
        r = requests.post(f"{BASE}/admin/hero-slides", headers=admin,
                          json={"title": "TEST_ord", "image_base64": _img(), "order": "abc"})
        if r.status_code == 200:
            created.append(r.json()["slide_id"])
        assert r.status_code in (200, 422), f"got {r.status_code}"
