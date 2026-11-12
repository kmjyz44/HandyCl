"""Unpaid-service blocking feature: reminders.blocked, 403 on new orders,
admin unpaid-clients / payment-unblock / mark-paid / paid-by-admin, regression spot checks.
Uses a dedicated TEST_ client (inserted in Mongo) for state-mutating tests so the
seeded client@handyhub.com state (blocked by booking_unpaidtest3) is preserved for UI tests."""
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://payment-flow-test-39.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
BLOCK_MSG_PART = "completed service that hasn't been paid yet"
SEEDED_CLIENT_ID = "user_c3d7650371c5"

db = MongoClient(MONGO_URL)[DB_NAME]


def _login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["session_token"]


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_tok():
    return _login("admin@handyhub.com", "Admin2024!")


@pytest.fixture(scope="module")
def client_tok():
    return _login("client@handyhub.com", "Client2024!")


@pytest.fixture(scope="module")
def provider_tok():
    return _login("provider@handyhub.com", "Provider2024!")


@pytest.fixture(scope="module")
def test_client():
    """A throwaway TEST_ client with its own session + overdue booking & standalone task."""
    uid = f"user_TEST_{uuid.uuid4().hex[:10]}"
    tok = f"session_TEST_{uuid.uuid4().hex}"
    now = datetime.now(timezone.utc)
    db.users.insert_one({"user_id": uid, "email": f"test_{uid.lower()}@example.com", "name": f"TEST_Unpaid {uid[-4:]}",
                         "role": "client", "created_at": now})
    db.user_sessions.insert_one({"user_id": uid, "session_token": tok, "expires_at": now + timedelta(days=1), "created_at": now})
    ids = {"uid": uid, "tok": tok, "bookings": [], "tasks": []}
    yield ids
    db.bookings.delete_many({"booking_id": {"$in": ids["bookings"]}})
    db.tasks.delete_many({"task_id": {"$in": ids["tasks"]}})
    db.user_sessions.delete_one({"session_token": tok})
    db.users.delete_one({"user_id": uid})


def _add_booking(tc, hours_ago, title, with_task=True, payment_status=None):
    bid = f"booking_TEST_{uuid.uuid4().hex[:8]}"
    doc = {"booking_id": bid, "client_id": tc["uid"], "title": title, "status": "completed_pending_payment",
           "total_price": 55.0, "completed_at": datetime.now(timezone.utc) - timedelta(hours=hours_ago),
           "created_at": datetime.now(timezone.utc) - timedelta(hours=hours_ago + 1)}
    if payment_status:
        doc["payment_status"] = payment_status
    db.bookings.insert_one(doc)
    tc["bookings"].append(bid)
    if with_task:
        tid = f"task_TEST_{uuid.uuid4().hex[:8]}"
        db.tasks.insert_one({"task_id": tid, "booking_id": bid, "client_id": tc["uid"], "title": title,
                             "status": "completed_pending_payment", "final_price": 60.0,
                             "completed_at": doc["completed_at"]})
        tc["tasks"].append(tid)
    return bid


def _add_task(tc, hours_ago, title):
    tid = f"task_TEST_{uuid.uuid4().hex[:8]}"
    db.tasks.insert_one({"task_id": tid, "client_id": tc["uid"], "title": title, "status": "completed_pending_payment",
                         "final_price": 33.0, "completed_at": datetime.now(timezone.utc) - timedelta(hours=hours_ago)})
    tc["tasks"].append(tid)
    return tid


VALID_BOOKING = {"title": "TEST_block check", "description": "test", "address": "1 Test St", "category": "plumbing",
                 "date": "2027-01-10", "time": "10:00"}
VALID_CLIENT_BOOKING = {"service_id": "svc_TEST_nonexistent", "date": "2027-01-10", "time": "10:00", "address": "1 Test St"}


# --- Seeded client (read-only checks) ---
class TestSeededClientBlocked:
    def test_reminders_blocked_true(self, client_tok):
        r = requests.get(f"{API}/payments/reminders", headers=H(client_tok), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "client"
        assert d["blocked"] is True
        assert d["needs_pay"] >= 1

    def test_post_bookings_403(self, client_tok):
        r = requests.post(f"{API}/bookings", json=VALID_BOOKING, headers=H(client_tok), timeout=15)
        assert r.status_code == 403, r.text
        assert BLOCK_MSG_PART in r.json()["detail"]

    def test_post_client_bookings_403(self, client_tok):
        r = requests.post(f"{API}/client/bookings", json=VALID_CLIENT_BOOKING, headers=H(client_tok), timeout=15)
        assert r.status_code == 403, r.text
        assert BLOCK_MSG_PART in r.json()["detail"]

    def test_post_client_tasks_403(self, client_tok):
        params = {"title": "TEST_t", "description": "d", "category": "handyman_plumbing", "address": "1 Test St",
                  "scheduled_date": "2027-01-10", "scheduled_time": "10:00"}
        r = requests.post(f"{API}/client/tasks", params=params, headers=H(client_tok), timeout=15)
        assert r.status_code == 403, r.text
        assert BLOCK_MSG_PART in r.json()["detail"]


# --- Role guards / non-client never blocked ---
class TestRoleGuards:
    def test_unpaid_clients_requires_admin(self, client_tok, provider_tok):
        assert requests.get(f"{API}/admin/unpaid-clients", timeout=15).status_code == 401
        assert requests.get(f"{API}/admin/unpaid-clients", headers=H(client_tok), timeout=15).status_code == 403
        assert requests.get(f"{API}/admin/unpaid-clients", headers=H(provider_tok), timeout=15).status_code == 403
        assert requests.get(f"{API}/admin/paid-by-admin", headers=H(client_tok), timeout=15).status_code == 403
        assert requests.post(f"{API}/admin/unpaid/mark-paid", json={"kind": "booking", "id": "x"}, headers=H(client_tok), timeout=15).status_code == 403
        assert requests.post(f"{API}/admin/users/{SEEDED_CLIENT_ID}/payment-unblock", headers=H(provider_tok), timeout=15).status_code == 403

    def test_admin_client_bookings_not_blocked(self, admin_tok):
        # admin passes guard -> reaches service lookup -> 404
        r = requests.post(f"{API}/client/bookings", json=VALID_CLIENT_BOOKING, headers=H(admin_tok), timeout=15)
        assert r.status_code == 404, r.text

    def test_provider_reminders_no_blocked(self, provider_tok):
        r = requests.get(f"{API}/payments/reminders", headers=H(provider_tok), timeout=15)
        assert r.status_code == 200
        assert r.json().get("blocked") in (None, False)


# --- Admin list for seeded client ---
class TestAdminUnpaidList:
    def test_seeded_client_listed_blocked(self, admin_tok):
        r = requests.get(f"{API}/admin/unpaid-clients", headers=H(admin_tok), timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["block_hours"] == 24
        c = next(c for c in d["clients"] if c["client_id"] == SEEDED_CLIENT_ID)
        assert c["blocked"] is True
        ids = {i["id"]: i for i in c["items"]}
        assert any(i["overdue"] for i in c["items"])
        if "booking_unpaidtest3" in ids:  # may already be marked paid by an earlier UI run
            assert ids["booking_unpaidtest3"]["overdue"] is True
        if "booking_unpaidtest2" in ids:
            assert ids["booking_unpaidtest2"]["overdue"] is False
        assert "booking_unpaidtest1" not in ids
        assert c["total_due"] == round(sum(float(i["amount"] or 0) for i in c["items"]), 2)
        # blocked clients sorted first
        flags = [x["blocked"] for x in d["clients"]]
        assert flags == sorted(flags, reverse=True)

    def test_paid_by_admin_has_seeded(self, admin_tok):
        r = requests.get(f"{API}/admin/paid-by-admin", headers=H(admin_tok), timeout=20)
        assert r.status_code == 200
        assert any(i["id"] == "booking_unpaidtest1" for i in r.json()["items"])

    def test_mark_paid_errors(self, admin_tok):
        r = requests.post(f"{API}/admin/unpaid/mark-paid", json={"kind": "booking", "id": "booking_nope_TEST"}, headers=H(admin_tok), timeout=15)
        assert r.status_code == 404
        r = requests.post(f"{API}/admin/unpaid/mark-paid", json={"kind": "task", "id": "task_nope_TEST"}, headers=H(admin_tok), timeout=15)
        assert r.status_code == 404
        r = requests.post(f"{API}/admin/unpaid/mark-paid", json={"kind": "foo", "id": "x"}, headers=H(admin_tok), timeout=15)
        assert r.status_code == 422
        r = requests.post(f"{API}/admin/unpaid/mark-paid", json={"kind": "booking", "id": "booking_unpaidtest1"}, headers=H(admin_tok), timeout=15)
        assert r.status_code == 400

    def test_unblock_unknown_404(self, admin_tok):
        r = requests.post(f"{API}/admin/users/user_TEST_nope/payment-unblock", headers=H(admin_tok), timeout=15)
        assert r.status_code == 404


# --- Full lifecycle on a TEST_ client ---
class TestLifecycle:
    def test_full_flow(self, admin_tok, test_client):
        tok, uid = test_client["tok"], test_client["uid"]
        rem = lambda: requests.get(f"{API}/payments/reminders", headers=H(tok), timeout=15).json()
        # no unpaid -> not blocked, guard passes (client/bookings -> 404 service)
        assert rem()["blocked"] is False
        assert requests.post(f"{API}/client/bookings", json=VALID_CLIENT_BOOKING, headers=H(tok), timeout=15).status_code == 404

        # recent (2h) unpaid -> not blocked
        recent = _add_booking(test_client, 2, "TEST_recent")
        assert rem()["blocked"] is False
        # pending_verification overdue -> not blocking (client reported payment)
        _add_booking(test_client, 60, "TEST_pv", payment_status="pending_verification")
        assert rem()["blocked"] is False

        # overdue (30h) -> blocked
        overdue = _add_booking(test_client, 30, "TEST_overdue")
        d = rem()
        assert d["blocked"] is True and d["needs_pay"] == 2
        assert requests.post(f"{API}/client/bookings", json=VALID_CLIENT_BOOKING, headers=H(tok), timeout=15).status_code == 403

        lst = requests.get(f"{API}/admin/unpaid-clients", headers=H(admin_tok), timeout=20).json()["clients"]
        c = next(c for c in lst if c["client_id"] == uid)
        assert c["blocked"] is True and c["unblocked_at"] is None
        assert {i["id"] for i in c["items"]} == {recent, overdue}  # linked tasks not double counted
        assert c["total_due"] == 120.0  # final_price of linked tasks (60+60)

        # unblock -> not blocked, items still unpaid, banner stays
        r = requests.post(f"{API}/admin/users/{uid}/payment-unblock", headers=H(admin_tok), timeout=15)
        assert r.status_code == 200 and r.json()["ok"] is True
        d = rem()
        assert d["blocked"] is False and d["needs_pay"] == 2
        assert requests.post(f"{API}/client/bookings", json=VALID_CLIENT_BOOKING, headers=H(tok), timeout=15).status_code == 404
        c = next(c for c in requests.get(f"{API}/admin/unpaid-clients", headers=H(admin_tok), timeout=20).json()["clients"] if c["client_id"] == uid)
        assert c["blocked"] is False and c["unblocked_at"]

        # a service that becomes overdue AFTER unblock -> blocks again (simulate: completed_at moved after unblock & >24h ago is impossible;
        # instead move unblocked_at back 10h, recent becomes "completed after unblock"; then push recent completed_at to 25h ago)
        db.users.update_one({"user_id": uid}, {"$set": {"payment_unblocked_at": datetime.now(timezone.utc) - timedelta(hours=26)}})
        db.bookings.update_one({"booking_id": recent}, {"$set": {"completed_at": datetime.now(timezone.utc) - timedelta(hours=25)}})
        assert rem()["blocked"] is True

        # mark-paid the re-blocking booking -> unblocked again
        r = requests.post(f"{API}/admin/unpaid/mark-paid", json={"kind": "booking", "id": recent, "note": "TEST cash"}, headers=H(admin_tok), timeout=15)
        assert r.status_code == 200
        b = db.bookings.find_one({"booking_id": recent})
        t = db.tasks.find_one({"booking_id": recent})
        assert b["status"] == "paid" and b["payment_status"] == "paid" and b["paid_by_admin"] is True
        assert t["status"] == "paid" and t["payment_status"] == "paid" and t["paid_by_admin"] is True
        d = rem()
        assert d["blocked"] is False and d["needs_pay"] == 1
        # second mark-paid -> 400
        assert requests.post(f"{API}/admin/unpaid/mark-paid", json={"kind": "booking", "id": recent}, headers=H(admin_tok), timeout=15).status_code == 400

        # standalone task overdue after unblock -> blocks; listed with kind task
        tid = _add_task(test_client, 25, "TEST_standalone")
        assert rem()["blocked"] is True
        assert requests.post(f"{API}/bookings", json=VALID_BOOKING, headers=H(tok), timeout=15).status_code == 403
        c = next(c for c in requests.get(f"{API}/admin/unpaid-clients", headers=H(admin_tok), timeout=20).json()["clients"] if c["client_id"] == uid)
        assert any(i["kind"] == "task" and i["id"] == tid and i["overdue"] for i in c["items"])
        r = requests.post(f"{API}/admin/unpaid/mark-paid", json={"kind": "task", "id": tid}, headers=H(admin_tok), timeout=15)
        assert r.status_code == 200
        assert rem()["blocked"] is False

        items = requests.get(f"{API}/admin/paid-by-admin", headers=H(admin_tok), timeout=20).json()["items"]
        got = {i["id"]: i for i in items}
        assert recent in got and got[recent]["note"] == "TEST cash" and got[recent]["kind"] == "booking"
        assert tid in got and got[tid]["kind"] == "task"
        assert got[recent]["client_name"].startswith("TEST_Unpaid")


# --- Regression spot checks ---
class TestRegression:
    def test_client_bookings_list(self, client_tok):
        r = requests.get(f"{API}/bookings", headers=H(client_tok), timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), (list, dict))

    def test_provider_tasks(self, provider_tok):
        r = requests.get(f"{API}/tasks", headers=H(provider_tok), timeout=20)
        assert r.status_code == 200

    def test_admin_tasks_and_bookings(self, admin_tok):
        r = requests.get(f"{API}/admin/tasks", headers=H(admin_tok), timeout=20)
        assert r.status_code == 200
        r = requests.get(f"{API}/bookings", headers=H(admin_tok), timeout=20)
        assert r.status_code == 200

    def test_admin_reminders(self, admin_tok):
        r = requests.get(f"{API}/payments/reminders", headers=H(admin_tok), timeout=15)
        assert r.status_code == 200 and r.json()["role"] == "admin"
