"""
Backend regression for the new "minimum billable hours" rule.

Covers:
  1) PUT /api/profile/executor persists minimum_hours (1, 1.5, 2)
     and both GET /api/profile/executor and public GET /api/profile/executor/{user_id}
     return it.
  2) GET /api/executors/by-service (listing/search) returns minimum_hours per provider,
     defaulting to 1.0.
  3) Task completion billing:
        labor_cost = max(provider.minimum_hours, actual_hours) * hourly_rate
        - short job (actual < min)  -> billable = min, labor = min*rate
        - long  job (actual > min)  -> billable = actual, labor = actual*rate
        Task doc gains billable_hours and minimum_hours.
  4) Regression: POST /api/bookings accepts state/unit/zip;
     POST /api/users/saved-addresses accepts label/street/city/state/unit/zip.
"""
import os
import uuid
import pytest
import requests

# Load REACT_APP_BACKEND_URL from /app/frontend/.env when not already exported
if "REACT_APP_BACKEND_URL" not in os.environ:
    try:
        with open("/app/frontend/.env") as _f:
            for _line in _f:
                _line = _line.strip()
                if _line.startswith("REACT_APP_BACKEND_URL="):
                    os.environ["REACT_APP_BACKEND_URL"] = _line.split("=", 1)[1].strip()
                    break
    except FileNotFoundError:
        pass

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("admin@handyhub.com", "Admin2024!")
CLIENT = ("client@handyhub.com", "Client2024!")
PROVIDER = ("provider@handyhub.com", "Provider2024!")

TIMEOUT = 30


# ─────────────────────────────── helpers ────────────────────────────────
def _login(email, password):
    r = requests.post(
        f"{API}/auth/login",
        json={"email": email, "password": password},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("session_token") or data.get("access_token")
    assert token, f"no session_token in login response: {data}"
    return token, data.get("user", {})


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ─────────────────────────────── fixtures ───────────────────────────────
@pytest.fixture(scope="module")
def admin_ctx():
    t, u = _login(*ADMIN)
    return {"token": t, "user": u}


@pytest.fixture(scope="module")
def client_ctx():
    t, u = _login(*CLIENT)
    return {"token": t, "user": u}


@pytest.fixture(scope="module")
def provider_ctx():
    t, u = _login(*PROVIDER)
    return {"token": t, "user": u}


@pytest.fixture(scope="module")
def original_minimum_hours(provider_ctx):
    """Snapshot provider's current minimum_hours so we can restore it in teardown."""
    r = requests.get(f"{API}/profile/executor", headers=_hdr(provider_ctx["token"]), timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    original = r.json().get("minimum_hours")
    yield original
    # Restore whatever the provider had before this test module ran
    restore_val = original if original is not None else 1.5
    requests.put(
        f"{API}/profile/executor",
        headers=_hdr(provider_ctx["token"]),
        json={"minimum_hours": restore_val},
        timeout=TIMEOUT,
    )


def _set_min_hours(provider_ctx, value):
    r = requests.put(
        f"{API}/profile/executor",
        headers=_hdr(provider_ctx["token"]),
        json={"minimum_hours": value},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, f"PUT minimum_hours={value} failed: {r.status_code} {r.text}"
    return r.json()


# ──────────────────────────── 1) profile persistence ────────────────────
class TestMinimumHoursProfilePersistence:
    """PUT /api/profile/executor persists minimum_hours & both GETs return it."""

    @pytest.mark.parametrize("value", [1.0, 1.5, 2.0])
    def test_put_and_get_my_profile(self, provider_ctx, original_minimum_hours, value):
        _set_min_hours(provider_ctx, value)

        # GET /api/profile/executor
        r = requests.get(
            f"{API}/profile/executor",
            headers=_hdr(provider_ctx["token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        assert float(r.json().get("minimum_hours")) == value

    @pytest.mark.parametrize("value", [1.0, 1.5, 2.0])
    def test_public_profile_returns_minimum_hours(
        self, provider_ctx, client_ctx, original_minimum_hours, value
    ):
        _set_min_hours(provider_ctx, value)
        provider_user_id = provider_ctx["user"]["user_id"]

        # Public endpoint (client fetches provider profile before booking)
        r = requests.get(
            f"{API}/profile/executor/{provider_user_id}",
            headers=_hdr(client_ctx["token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "minimum_hours" in body, f"public profile missing minimum_hours: {body.keys()}"
        assert float(body["minimum_hours"]) == value


# ──────────────────── 2) listing endpoint exposes minimum_hours ─────────
class TestExecutorListingMinimumHours:
    """GET /api/executors/by-service returns minimum_hours (default 1.0)."""

    def test_listing_returns_minimum_hours_field(
        self, provider_ctx, client_ctx, original_minimum_hours
    ):
        # Set provider's minimum to a distinct value
        _set_min_hours(provider_ctx, 1.5)

        r = requests.get(
            f"{API}/executors/by-service",
            headers=_hdr(client_ctx["token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        executors = r.json()
        assert isinstance(executors, list) and len(executors) > 0, "empty listing"

        # Every executor row must expose minimum_hours as a float ≥ 1.0
        for ex in executors:
            assert "minimum_hours" in ex, f"executor missing minimum_hours: {ex.get('user_id')}"
            mh = ex["minimum_hours"]
            assert isinstance(mh, (int, float)), f"minimum_hours must be numeric, got {type(mh)}"
            assert float(mh) >= 1.0, f"minimum_hours must default to ≥1.0, got {mh}"

        # Our provider specifically should reflect the value we set
        provider_uid = provider_ctx["user"]["user_id"]
        me = next((e for e in executors if e.get("user_id") == provider_uid), None)
        assert me is not None, "test provider not in listing"
        assert float(me["minimum_hours"]) == 1.5


# ─────────────────────── 3) task completion billing ─────────────────────
def _create_booking_assigned_to_provider(
    client_ctx, provider_user_id, hourly_rate=25.0, title_suffix=""
):
    """Client creates a booking pre-assigned to provider — task auto-created in pending_acceptance."""
    payload = {
        "title": f"TEST_min_hours_billing {title_suffix or uuid.uuid4().hex[:6]}",
        "description": "Automated billing regression test",
        "category": "handyman_carpentry",
        "date": "2026-02-15",
        "time": "10:00",
        "address": "123 Test Ln, Apt 1, Chicago, Illinois",
        "city": "Chicago",
        "state": "Illinois",
        "unit": "Apt 1",
        "zip": "60601",
        "provider_id": provider_user_id,
        "provider_hourly_rate": hourly_rate,
        "estimated_hours": 1,
    }
    r = requests.post(
        f"{API}/bookings",
        headers=_hdr(client_ctx["token"]),
        json=payload,
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, f"create booking failed: {r.status_code} {r.text}"
    body = r.json()
    booking_id = body["booking_id"]
    return booking_id


def _resolve_task_id_for_booking(provider_ctx, booking_id):
    """Task is created with a fresh task_id; find it via provider tasks."""
    r = requests.get(
        f"{API}/provider/tasks",
        headers=_hdr(provider_ctx["token"]),
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, r.text
    tasks = r.json() if isinstance(r.json(), list) else r.json().get("tasks", [])
    for t in tasks:
        if t.get("booking_id") == booking_id:
            return t["task_id"]
    # Fallback: _resolve_task in backend also allows using booking_id as task_id
    return booking_id


def _drive_to_complete(provider_ctx, task_id, actual_hours):
    """accept → start → complete(actual_hours=…). Returns the completed task doc."""
    tok = provider_ctx["token"]

    # accept
    r = requests.post(f"{API}/tasks/{task_id}/accept", headers=_hdr(tok), timeout=TIMEOUT)
    assert r.status_code == 200, f"accept failed: {r.status_code} {r.text}"
    # backend may return a fresh new_task_id (bookings-fallback path)
    body = r.json()
    task_id = body.get("task_id") or body.get("new_task_id") or task_id

    # start (task must be in progress to complete)
    r = requests.post(f"{API}/tasks/{task_id}/start", headers=_hdr(tok), timeout=TIMEOUT)
    assert r.status_code == 200, f"start failed: {r.status_code} {r.text}"

    # complete with explicit actual_hours
    r = requests.post(
        f"{API}/tasks/{task_id}/complete",
        headers=_hdr(tok),
        json={"actual_hours": actual_hours, "materials_cost": 0.0, "provider_notes": "auto-test"},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, f"complete failed: {r.status_code} {r.text}"

    # Read back the task to inspect billing fields
    r = requests.get(f"{API}/tasks/{task_id}", headers=_hdr(tok), timeout=TIMEOUT)
    assert r.status_code == 200, f"GET task failed: {r.status_code} {r.text}"
    return r.json(), task_id


class TestCompletionBilling:
    """labor_cost = max(min_hours, actual_hours) * hourly_rate; billable/min_hours stored."""

    HOURLY = 25.0

    def test_short_job_charges_full_minimum_15(
        self, provider_ctx, client_ctx, original_minimum_hours
    ):
        _set_min_hours(provider_ctx, 1.5)
        provider_uid = provider_ctx["user"]["user_id"]

        booking_id = _create_booking_assigned_to_provider(
            client_ctx, provider_uid, hourly_rate=self.HOURLY, title_suffix="short-15"
        )
        task_id = _resolve_task_id_for_booking(provider_ctx, booking_id)
        task, _ = _drive_to_complete(provider_ctx, task_id, actual_hours=0.25)

        # Very short job → billed at the minimum (1.5h)
        assert float(task.get("actual_hours")) == pytest.approx(0.25, abs=0.01)
        assert float(task.get("minimum_hours")) == pytest.approx(1.5, abs=0.01)
        assert float(task.get("billable_hours")) == pytest.approx(1.5, abs=0.01)
        # labor_cost = 1.5 * 25 = 37.50
        assert float(task.get("labor_cost")) == pytest.approx(37.50, abs=0.01)

    def test_short_job_charges_full_minimum_20(
        self, provider_ctx, client_ctx, original_minimum_hours
    ):
        _set_min_hours(provider_ctx, 2.0)
        provider_uid = provider_ctx["user"]["user_id"]

        booking_id = _create_booking_assigned_to_provider(
            client_ctx, provider_uid, hourly_rate=self.HOURLY, title_suffix="short-20"
        )
        task_id = _resolve_task_id_for_booking(provider_ctx, booking_id)
        task, _ = _drive_to_complete(provider_ctx, task_id, actual_hours=0.5)

        assert float(task.get("actual_hours")) == pytest.approx(0.5, abs=0.01)
        assert float(task.get("minimum_hours")) == pytest.approx(2.0, abs=0.01)
        assert float(task.get("billable_hours")) == pytest.approx(2.0, abs=0.01)
        # labor_cost = 2.0 * 25 = 50.00
        assert float(task.get("labor_cost")) == pytest.approx(50.00, abs=0.01)

    def test_long_job_bills_actual_hours(
        self, provider_ctx, client_ctx, original_minimum_hours
    ):
        _set_min_hours(provider_ctx, 1.0)
        provider_uid = provider_ctx["user"]["user_id"]

        booking_id = _create_booking_assigned_to_provider(
            client_ctx, provider_uid, hourly_rate=self.HOURLY, title_suffix="long-25"
        )
        task_id = _resolve_task_id_for_booking(provider_ctx, booking_id)
        task, _ = _drive_to_complete(provider_ctx, task_id, actual_hours=2.5)

        assert float(task.get("actual_hours")) == pytest.approx(2.5, abs=0.01)
        assert float(task.get("minimum_hours")) == pytest.approx(1.0, abs=0.01)
        assert float(task.get("billable_hours")) == pytest.approx(2.5, abs=0.01)
        # labor_cost = 2.5 * 25 = 62.50
        assert float(task.get("labor_cost")) == pytest.approx(62.50, abs=0.01)


# ─────────────────── 4) regression: booking + saved-address ─────────────
class TestBookingAndAddressRegression:
    def test_booking_persists_state_unit_zip(self, client_ctx):
        payload = {
            "title": f"TEST_regression_addr_{uuid.uuid4().hex[:6]}",
            "description": "Regression: state/unit/zip",
            "category": "handyman_carpentry",
            "address": "9701 Dee Road, Apt 4B, Niles, Illinois",
            "city": "Niles",
            "state": "Illinois",
            "unit": "Apt 4B",
            "zip": "60016",
            "date": "2026-02-20",
            "time": "09:00",
        }
        r = requests.post(
            f"{API}/bookings",
            headers=_hdr(client_ctx["token"]),
            json=payload,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, f"POST bookings failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("booking_id")
        # server stores extra fields even though they're not on the Booking model
        booking_id = body["booking_id"]

        # Verify persistence via GET /api/bookings/{id}
        r = requests.get(
            f"{API}/bookings/{booking_id}",
            headers=_hdr(client_ctx["token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        b = r.json()
        assert b.get("state") == "Illinois"
        assert b.get("unit") == "Apt 4B"
        assert b.get("zip") == "60016"
        assert b.get("city") == "Niles"

    def test_saved_address_accepts_all_fields(self, client_ctx):
        payload = {
            "label": f"TEST_home_{uuid.uuid4().hex[:6]}",
            "street": "9701 Dee Road",
            "city": "Niles",
            "state": "Illinois",
            "unit": "Apt 4B",
            "zip": "60016",
        }
        r = requests.post(
            f"{API}/users/saved-addresses",
            headers=_hdr(client_ctx["token"]),
            json=payload,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, f"POST saved-addresses failed: {r.status_code} {r.text}"
        addr = r.json()
        assert addr.get("id")
        assert addr.get("label") == payload["label"]
        assert addr.get("street") == payload["street"]
        assert addr.get("city") == payload["city"]
        assert addr.get("state") == payload["state"]
        assert addr.get("unit") == payload["unit"]
        assert addr.get("zip") == payload["zip"]

        # Verify via GET
        r = requests.get(
            f"{API}/users/saved-addresses",
            headers=_hdr(client_ctx["token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        listing = r.json()
        assert any(a.get("id") == addr["id"] for a in listing)

        # Cleanup: delete the address we created
        requests.delete(
            f"{API}/users/saved-addresses/{addr['id']}",
            headers=_hdr(client_ctx["token"]),
            timeout=TIMEOUT,
        )
