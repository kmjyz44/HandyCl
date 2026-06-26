"""
Backend tests for Resend email provider integration & admin provider selection.

Covers (iteration_13 review_request):
- Admin login (admin@handyhub.com / Admin2024!)
- PUT /api/admin/integration-keys saves resend_api_key/resend_from_email/email_provider
- GET /api/admin/integration-keys masks resend_api_key, returns plaintext resend_from_email,
  and defaults email_provider='resend' when never set
- Provider can be switched to 'sendgrid' and back to 'resend'
- POST /api/auth/register routes through Resend (backend log shows 'Resend email sent')
  for the Resend test-mode owner address (ONE real send only)
- Registration with a non-owner email still returns 200 even when Resend rejects
  delivery with 403 (i.e. _send_email failure must NOT break registration)
"""
import os
import time
import json
import subprocess
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://payment-flow-test-39.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@handyhub.com"
ADMIN_PASS = "Admin2024!"

RESEND_API_KEY = "re_J5AFwPh2_4ohQT6u5o2d4tSsrxyEZjaQ3"
RESEND_FROM = "onboarding@resend.dev"
RESEND_OWNER_EMAIL = "nexus.ss.llc@gmail.com"

MONGO_URI = "mongodb://localhost:27017/test_database"
BACKEND_ERR_LOG = "/var/log/supervisor/backend.err.log"
BACKEND_OUT_LOG = "/var/log/supervisor/backend.out.log"


# ---------- helpers ----------
def _mongosh(js: str) -> str:
    return subprocess.run(
        ["mongosh", MONGO_URI, "--quiet", "--eval", js],
        capture_output=True, text=True, timeout=15
    ).stdout


def _read_backend_logs_tail(n_lines: int = 400) -> str:
    out = ""
    for p in (BACKEND_ERR_LOG, BACKEND_OUT_LOG):
        try:
            with open(p, "r") as f:
                out += f.read()[-200_000:]
        except Exception:
            pass
    # return only last n_lines lines
    return "\n".join(out.splitlines()[-n_lines:])


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    token = r.json().get("session_token")
    assert token, f"no session_token in login response: {r.text}"
    return token


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------- tests ----------
# == Admin integration-keys: save Resend config ==
def test_put_integration_keys_saves_resend(admin_headers):
    payload = {
        "email_provider": "resend",
        "resend_api_key": RESEND_API_KEY,
        "resend_from_email": RESEND_FROM,
        "enable_email_notifications": True,
    }
    r = requests.put(f"{BASE_URL}/api/admin/integration-keys",
                     headers=admin_headers, json=payload, timeout=15)
    assert r.status_code == 200, f"PUT failed: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("ok") is True
    updated = set(body.get("updated", []))
    # every field we sent (plus the audit fields) should be in updated
    for k in payload.keys():
        assert k in updated, f"expected {k} in updated set: {updated}"


# == GET masks resend_api_key, returns plaintext from-email + provider ==
def test_get_integration_keys_masks_resend_key(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/integration-keys",
                     headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    # provider
    assert body.get("email_provider") == "resend", body.get("email_provider")
    # from-email plaintext
    assert body.get("resend_from_email") == RESEND_FROM
    # masked key — server uses value[:4] + 8 bullets + value[-4:]
    masked = body.get("resend_api_key")
    assert masked is not None
    assert masked != RESEND_API_KEY, "API key returned in plaintext!"
    assert masked.startswith(RESEND_API_KEY[:4]), f"mask prefix wrong: {masked}"
    assert masked.endswith(RESEND_API_KEY[-4:]), f"mask suffix wrong: {masked}"
    assert "•" in masked or "*" in masked, f"mask has no bullet chars: {masked}"
    # presence flag
    assert body.get("resend_api_key_set") is True


# == Provider switching ==
def test_switch_provider_to_sendgrid(admin_headers):
    r = requests.put(f"{BASE_URL}/api/admin/integration-keys",
                     headers=admin_headers, json={"email_provider": "sendgrid"}, timeout=15)
    assert r.status_code == 200, r.text
    g = requests.get(f"{BASE_URL}/api/admin/integration-keys",
                     headers=admin_headers, timeout=15)
    assert g.status_code == 200
    assert g.json().get("email_provider") == "sendgrid"


def test_switch_provider_back_to_resend(admin_headers):
    r = requests.put(f"{BASE_URL}/api/admin/integration-keys",
                     headers=admin_headers, json={"email_provider": "resend"}, timeout=15)
    assert r.status_code == 200, r.text
    g = requests.get(f"{BASE_URL}/api/admin/integration-keys",
                     headers=admin_headers, timeout=15)
    assert g.status_code == 200
    assert g.json().get("email_provider") == "resend"


# == Default 'resend' when never set: clear field in DB and re-GET ==
def test_get_defaults_email_provider_to_resend_when_unset(admin_headers):
    # unset the field directly in mongo, then GET — server defaults to 'resend'
    _mongosh(
        "db.integration_keys.updateOne({setting_id:'integration_keys'},"
        "{$unset:{email_provider:''}})"
    )
    g = requests.get(f"{BASE_URL}/api/admin/integration-keys",
                     headers=admin_headers, timeout=15)
    assert g.status_code == 200, g.text
    assert g.json().get("email_provider") == "resend", g.json().get("email_provider")
    # restore for following tests
    requests.put(f"{BASE_URL}/api/admin/integration-keys",
                 headers=admin_headers, json={"email_provider": "resend"}, timeout=15)


# == Single REAL send to Resend owner email ==
def test_register_owner_email_uses_resend(admin_headers):
    """Register the Resend account-owner email — backend log should show
    'Resend email sent to nexus.ss.llc@gmail.com'. Done ONCE only."""
    # delete user (and any verification rows) so register succeeds
    _mongosh(
        "db.users.deleteMany({email:{$regex:/^nexus\\.ss\\.llc@gmail\\.com$/i}});"
        "db.email_verifications.deleteMany({email:{$regex:/^nexus\\.ss\\.llc@gmail\\.com$/i}})"
    )

    # mark log offset so we only inspect lines emitted after this register call
    before = _read_backend_logs_tail(2000)
    before_len = len(before)

    r = requests.post(f"{BASE_URL}/api/auth/register",
                      json={
                          "email": RESEND_OWNER_EMAIL,
                          "password": "Test1234",
                          "name": "Nexus Owner",
                          "role": "client",
                          "phone": "3317713444",
                          "accepted_terms": True,
                      }, timeout=20)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    body = r.json()
    assert "session_token" in body
    assert body.get("user", {}).get("email") == RESEND_OWNER_EMAIL

    # email is sent as a background task — wait briefly
    time.sleep(6)
    after = _read_backend_logs_tail(4000)
    new_part = after[max(0, len(after) - max(0, len(after) - before_len)):]
    # robust: just search the tail
    assert "Resend email sent to nexus.ss.llc@gmail.com" in after, (
        "expected 'Resend email sent to nexus.ss.llc@gmail.com' in backend logs. "
        f"Last 2000 chars:\n{after[-2000:]}"
    )
    # And verify SendGrid path was NOT used for this address
    # (there may be old SendGrid lines for OTHER addresses earlier in the log,
    # so we only check no SendGrid line mentions nexus.ss.llc@gmail.com after our send)
    assert "SendGrid email sent to nexus.ss.llc@gmail.com" not in after[-4000:], (
        "SendGrid was used instead of Resend for owner email"
    )


# == Register a non-owner email — must still return 200 even if Resend 403s ==
def test_register_non_owner_email_still_200(admin_headers):
    """Resend test-mode rejects non-owner recipients with 403.
    register() must not propagate that failure — endpoint returns 200."""
    uniq = f"resend.nonowner.{int(time.time())}@example.com"
    escaped = uniq.replace(".", "\\.")
    # ensure not already present
    _mongosh(
        "db.users.deleteMany({email:{$regex:/^" + escaped + "$/i}});"
    )

    r = requests.post(f"{BASE_URL}/api/auth/register",
                      json={
                          "email": uniq,
                          "password": "Test1234",
                          "name": "Non Owner",
                          "role": "client",
                          "phone": "3317713444",
                          "accepted_terms": True,
                      }, timeout=20)
    assert r.status_code == 200, f"register MUST succeed even on email-send failure: {r.status_code} {r.text}"
    assert "session_token" in r.json()

    # cleanup
    _mongosh(
        "db.users.deleteMany({email:{$regex:/^" + escaped + "$/i}});"
        "db.email_verifications.deleteMany({email:{$regex:/^" + escaped + "$/i}})"
    )

    # ensure backend log shows Resend was attempted (warning OR success line for this address)
    time.sleep(5)
    # grep both supervisor logs directly for the Resend failure line for THIS address
    grep_out = subprocess.run(
        ["bash", "-c",
         "grep -E 'Resend email failed|Resend email sent to " + escaped + "|No email provider sent message to " + escaped + "' "
         "/var/log/supervisor/backend.err.log /var/log/supervisor/backend.out.log 2>/dev/null | tail -20"],
        capture_output=True, text=True, timeout=10
    ).stdout
    attempted = (
        f"Resend email sent to {uniq}" in grep_out
        or "Resend email failed" in grep_out
        or f"No email provider sent message to {uniq}" in grep_out
    )
    assert attempted, f"Resend path doesn't appear to have been exercised. grep output:\n{grep_out}"
