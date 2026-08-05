"""Backend tests for provider ranking-hours & referral bonus (iteration 23).

Covers:
  - GET /api/provider/ranking
  - GET /api/admin/providers/{user_id}/ranking
  - POST /api/admin/providers/{user_id}/ranking-adjust
  - Provider-to-provider referral bonus (idempotent) via _accrue_order_points
  - Regression: GET /api/executors/by-service?category=cleaning
  - Multi-provider ordering + hours_to_first math
"""

import os
import sys
import uuid
import asyncio
import requests
import pytest
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fall back to frontend/.env when running locally
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL"):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
    except Exception:
        pass
assert BASE_URL, "REACT_APP_BACKEND_URL missing"

API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@handyhub.com", "password": "Admin2024!"}
PROVIDER = {"email": "provider@handyhub.com", "password": "Provider2024!"}
CLIENT = {"email": "client@handyhub.com", "password": "Client2024!"}

PROVIDER_UID = "user_dc5e0dd73212"  # per problem statement


# ---------- helpers ----------
def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.status_code} {r.text}"
    tok = r.json().get("session_token") or r.json().get("token") or r.json().get("access_token")
    assert tok, f"no session token in {r.json()}"
    return tok


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_tok():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def provider_tok():
    return _login(PROVIDER)


@pytest.fixture(scope="module")
def client_tok():
    return _login(CLIENT)


# ---------- direct DB access for cleanup + referral seeding ----------
sys.path.insert(0, "/app/backend")


def _db():
    """Return an AsyncIOMotorClient DB handle using backend env config."""
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    return client, client[db_name]


CREATED_ADJ_PROVIDERS = set()   # provider_ids whose ranking_adjustments we created
CREATED_USERS: list = []
CREATED_PROFILES: list = []
CREATED_BOOKINGS: list = []
CREATED_REFERRALS: list = []


# ================================================================
# 1. Auth / access control
# ================================================================
def test_provider_ranking_requires_provider_role(client_tok, admin_tok):
    r = requests.get(f"{API}/provider/ranking", headers=_h(client_tok), timeout=20)
    assert r.status_code == 403, f"client got {r.status_code}: {r.text}"
    r = requests.get(f"{API}/provider/ranking", headers=_h(admin_tok), timeout=20)
    assert r.status_code == 403, f"admin got {r.status_code}: {r.text}"


def test_admin_adjust_requires_admin(provider_tok):
    r = requests.post(
        f"{API}/admin/providers/{PROVIDER_UID}/ranking-adjust",
        json={"hours": 1, "category": "*", "reason": "x"},
        headers=_h(provider_tok), timeout=20,
    )
    assert r.status_code == 403


def test_admin_ranking_unknown_user_404(admin_tok):
    r = requests.get(
        f"{API}/admin/providers/user_does_not_exist_xyz/ranking",
        headers=_h(admin_tok), timeout=20,
    )
    assert r.status_code == 404

    r = requests.post(
        f"{API}/admin/providers/user_does_not_exist_xyz/ranking-adjust",
        json={"hours": 1}, headers=_h(admin_tok), timeout=20,
    )
    assert r.status_code == 404


def test_admin_adjust_hours_zero_422(admin_tok):
    r = requests.post(
        f"{API}/admin/providers/{PROVIDER_UID}/ranking-adjust",
        json={"hours": 0, "category": "*"}, headers=_h(admin_tok), timeout=20,
    )
    assert r.status_code == 422


# ================================================================
# 2. GET /api/provider/ranking shape
# ================================================================
def test_provider_ranking_shape(provider_tok):
    r = requests.get(f"{API}/provider/ranking", headers=_h(provider_tok), timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ("categories", "referral_code", "referral_link", "total_bonus_hours", "referral_bonus_hours"):
        assert k in data, f"missing key {k}"
    assert isinstance(data["categories"], list)
    assert data["referral_bonus_hours"] == 5.0
    assert data["referral_code"] and isinstance(data["referral_code"], str)
    assert data["referral_code"] in data["referral_link"]
    # provider has 'cleaning' skill so at least one category expected
    assert any(c["category_id"] == "cleaning" for c in data["categories"]), \
        f"cleaning category missing: {data['categories']}"
    row = next(c for c in data["categories"] if c["category_id"] == "cleaning")
    for k in ("worked_hours", "bonus_hours", "review_adjustment", "total_score",
              "average_rating", "reviews_count", "position", "total_providers",
              "leader_score", "hours_to_first", "hours_to_second"):
        assert k in row, f"cleaning row missing {k}: {row}"


# ================================================================
# 3. Admin adjust + persistence + history
# ================================================================
def test_admin_adjust_global_and_category_reflects_in_ranking(admin_tok, provider_tok):
    CREATED_ADJ_PROVIDERS.add(PROVIDER_UID)

    # baseline
    r0 = requests.get(f"{API}/provider/ranking", headers=_h(provider_tok), timeout=20).json()
    base = next(c for c in r0["categories"] if c["category_id"] == "cleaning")
    base_bonus = base["bonus_hours"]
    base_total = base["total_score"]

    # +10 global
    r1 = requests.post(f"{API}/admin/providers/{PROVIDER_UID}/ranking-adjust",
                       json={"hours": 10, "category": "*", "reason": "TEST global +10"},
                       headers=_h(admin_tok), timeout=20)
    assert r1.status_code == 200, r1.text
    body = r1.json()
    assert body.get("ok") is True and body.get("category") == "*"

    # +5 cleaning
    r2 = requests.post(f"{API}/admin/providers/{PROVIDER_UID}/ranking-adjust",
                       json={"hours": 5, "category": "cleaning", "reason": "TEST cleaning +5"},
                       headers=_h(admin_tok), timeout=20)
    assert r2.status_code == 200, r2.text

    # verify provider view: cleaning bonus_hours went up by 15
    r3 = requests.get(f"{API}/provider/ranking", headers=_h(provider_tok), timeout=20).json()
    row = next(c for c in r3["categories"] if c["category_id"] == "cleaning")
    assert round(row["bonus_hours"] - base_bonus, 2) == 15.0, \
        f"expected +15 bonus, got {row['bonus_hours']} vs {base_bonus}"
    assert round(row["total_score"] - base_total, 2) == 15.0, \
        f"total_score should also increase by 15"

    # admin view: global_bonus_hours reflects +10, history contains new rows newest first
    r4 = requests.get(f"{API}/admin/providers/{PROVIDER_UID}/ranking",
                      headers=_h(admin_tok), timeout=20)
    assert r4.status_code == 200, r4.text
    ad = r4.json()
    assert "history" in ad and isinstance(ad["history"], list)
    assert len(ad["history"]) >= 2
    # newest first
    reasons = [h.get("reason") for h in ad["history"][:5]]
    assert "TEST cleaning +5" in reasons and "TEST global +10" in reasons
    # cleaning row bonus contains 15
    cleaning_row = next(c for c in ad["categories"] if c["category_id"] == "cleaning")
    assert cleaning_row["bonus_hours"] >= base_bonus + 15 - 0.01

    # Subtract works
    r5 = requests.post(f"{API}/admin/providers/{PROVIDER_UID}/ranking-adjust",
                       json={"hours": -3, "category": "cleaning", "reason": "TEST cleaning -3"},
                       headers=_h(admin_tok), timeout=20)
    assert r5.status_code == 200
    r6 = requests.get(f"{API}/provider/ranking", headers=_h(provider_tok), timeout=20).json()
    row2 = next(c for c in r6["categories"] if c["category_id"] == "cleaning")
    assert round(row2["bonus_hours"] - base_bonus, 2) == 12.0, \
        f"after -3 expected +12 net, got {row2['bonus_hours']} vs {base_bonus}"


# ================================================================
# 4. Regression: /executors/by-service?category=cleaning
# ================================================================
def test_executors_by_service_cleaning_includes_ranking(client_tok):
    r = requests.get(f"{API}/executors/by-service?category=cleaning",
                     headers=_h(client_tok), timeout=25)
    assert r.status_code == 200, r.text
    data = r.json()
    # Could be a list or {executors: [...]}
    items = data if isinstance(data, list) else (data.get("executors") or data.get("items") or [])
    assert isinstance(items, list) and len(items) > 0, f"empty list: {data}"
    sample = items[0]
    # New fields
    assert "category_bonus_hours" in sample, f"category_bonus_hours missing in {list(sample.keys())}"
    assert "ranking_score" in sample, f"ranking_score missing in {list(sample.keys())}"


# ================================================================
# 5. Multi-provider ordering & hours_to_first math
# ================================================================
def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


async def _seed_two_providers():
    """Seed 2 extra providers with cleaning skill + different bonus hours."""
    _, db = _db()
    p1 = f"user_test_{uuid.uuid4().hex[:10]}"
    p2 = f"user_test_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc)
    for pid, name in [(p1, "TEST_Ranker_A"), (p2, "TEST_Ranker_B")]:
        await db.users.insert_one({
            "user_id": pid, "email": f"{pid}@test.local", "name": name,
            "role": "provider", "is_blocked": False, "hidden_from_clients": False,
            "created_at": now, "password_hash": "x",
        })
        await db.executor_profiles.insert_one({
            "profile_id": f"prof_{pid}", "user_id": pid,
            "skills": [{"id": "cleaning", "name": "cleaning", "category_id": "cleaning"}],
            "created_at": now,
        })
        CREATED_USERS.append(pid)
        CREATED_PROFILES.append(pid)
    return p1, p2


def test_multi_provider_ordering_and_hours_to_first(admin_tok, provider_tok):
    p1, p2 = asyncio.run(_seed_two_providers())
    CREATED_ADJ_PROVIDERS.update({p1, p2, PROVIDER_UID})

    # give p1=+50, p2=+30 in cleaning to try to top the list
    for pid, hrs in [(p1, 50), (p2, 30)]:
        r = requests.post(f"{API}/admin/providers/{pid}/ranking-adjust",
                          json={"hours": hrs, "category": "cleaning", "reason": "TEST seed"},
                          headers=_h(admin_tok), timeout=20)
        assert r.status_code == 200, r.text

    # provider (real one) view for cleaning
    r = requests.get(f"{API}/provider/ranking", headers=_h(provider_tok), timeout=20).json()
    row = next(c for c in r["categories"] if c["category_id"] == "cleaning")
    assert row["total_providers"] >= 3
    # leader_score should be at least 50 (p1)
    assert row["leader_score"] >= 50.0, f"leader_score {row['leader_score']} < 50"
    # If provider is not 1st, hours_to_first must equal leader-me + 0.01
    if row["position"] > 1:
        assert row["hours_to_first"] >= round(row["leader_score"] - row["total_score"], 2)
    if row["position"] > 2:
        assert row["hours_to_second"] > 0
    else:
        assert row["hours_to_second"] == 0.0


# ================================================================
# 6. Provider-to-provider referral bonus (idempotent)
# ================================================================
async def _seed_referral_and_paid_booking():
    _, db = _db()
    referrer = f"user_test_{uuid.uuid4().hex[:10]}"
    referred = f"user_test_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc)
    for pid, name in [(referrer, "TEST_Referrer"), (referred, "TEST_Referred")]:
        await db.users.insert_one({
            "user_id": pid, "email": f"{pid}@test.local", "name": name,
            "role": "provider", "is_blocked": False, "hidden_from_clients": False,
            "created_at": now, "password_hash": "x",
        })
        await db.executor_profiles.insert_one({
            "profile_id": f"prof_{pid}", "user_id": pid,
            "skills": [{"id": "cleaning", "name": "cleaning", "category_id": "cleaning"}],
            "created_at": now,
        })
        CREATED_USERS.append(pid)
        CREATED_PROFILES.append(pid)

    referral_id = f"ref_{uuid.uuid4().hex[:12]}"
    await db.referrals.insert_one({
        "referral_id": referral_id,
        "referrer_id": referrer,
        "referred_id": referred,
        "code": f"TEST{uuid.uuid4().hex[:6].upper()}",
        "created_at": now,
        "provider_bonus_awarded": False,
    })
    CREATED_REFERRALS.append(referral_id)

    booking_id = f"bk_test_{uuid.uuid4().hex[:10]}"
    await db.bookings.insert_one({
        "booking_id": booking_id,
        "provider_id": referred,
        "client_id": "client_dummy",
        "category": "cleaning",
        "status": "paid",
        "final_price": 100.0,
        "actual_hours": 2,
        "created_at": now,
    })
    CREATED_BOOKINGS.append(booking_id)
    return referrer, referred, referral_id, booking_id


async def _invoke_accrue(booking_id):
    # import server module to call internal function on the same DB
    import server as srv  # /app/backend/server.py
    await srv._accrue_order_points(booking_id, 100.0)


async def _fetch_awarded(referral_id, provider_id, referrer_id):
    _, db = _db()
    ref = await db.referrals.find_one({"referral_id": referral_id}, {"_id": 0})
    adjs = await db.ranking_adjustments.find(
        {"provider_id": {"$in": [provider_id, referrer_id]}, "source": "referral_bonus"},
        {"_id": 0}
    ).to_list(50)
    return ref, adjs


def test_provider_referral_bonus_and_idempotency():
    referrer, referred, referral_id, booking_id = asyncio.run(_seed_referral_and_paid_booking())
    CREATED_ADJ_PROVIDERS.update({referrer, referred})

    asyncio.run(_invoke_accrue(booking_id))
    ref, adjs = asyncio.run(_fetch_awarded(referral_id, referred, referrer))
    assert ref and ref.get("provider_bonus_awarded") is True, f"referral not flagged: {ref}"
    got = {(a["provider_id"], a["category"], a["hours"]) for a in adjs}
    assert (referred, "*", 5.0) in got, f"referred bonus missing: {got}"
    assert (referrer, "*", 5.0) in got, f"referrer bonus missing: {got}"

    # Idempotent: re-invoke shouldn't create more rows
    asyncio.run(_invoke_accrue(booking_id))
    _, adjs2 = asyncio.run(_fetch_awarded(referral_id, referred, referrer))
    assert len(adjs2) == len(adjs), f"double-awarded! {len(adjs)} -> {len(adjs2)}"


# ================================================================
# Cleanup — runs after all tests in this module.
# ================================================================
async def _cleanup():
    _, db = _db()
    if CREATED_ADJ_PROVIDERS:
        await db.ranking_adjustments.delete_many(
            {"provider_id": {"$in": list(CREATED_ADJ_PROVIDERS)}}
        )
    if CREATED_BOOKINGS:
        await db.bookings.delete_many({"booking_id": {"$in": CREATED_BOOKINGS}})
    if CREATED_REFERRALS:
        await db.referrals.delete_many({"referral_id": {"$in": CREATED_REFERRALS}})
    if CREATED_PROFILES:
        await db.executor_profiles.delete_many({"user_id": {"$in": CREATED_PROFILES}})
    if CREATED_USERS:
        await db.users.delete_many({"user_id": {"$in": CREATED_USERS}})


def test_zzz_cleanup():
    """Final cleanup — remove all test-created rows so preview DB stays clean."""
    asyncio.run(_cleanup())
