"""Regression: manual-payment confirmation must
  1) Mirror payment_status onto the linked task (so UI hides green Pay button).
  2) Accept optional tip_amount and credit it to executor only.
  3) On admin approve, bump task.status to paid + mirror payment_status."""
import os
import uuid
import asyncio
import requests
import pytest
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

API_URL = os.environ.get("PUBLIC_API_URL", "https://payment-flow-test-39.preview.emergentagent.com")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


def _login(email, password):
    r = requests.post(f"{API_URL}/api/auth/login", json={"email": email, "password": password}, timeout=10)
    r.raise_for_status()
    return r.json()["session_token"]


async def _seed_completed_booking(executor_price=20.0):
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    prov = await db.users.find_one({"email": "provider@handyhub.com"}, {"_id": 0, "user_id": 1})
    cli = await db.users.find_one({"email": "client@handyhub.com"}, {"_id": 0, "user_id": 1})
    await db.categories.update_one(
        {"category_id": "assembly"},
        {"$set": {"category_id": "assembly", "name": "Збірка меблів", "commission_rate": 15.0, "is_active": True}},
        upsert=True,
    )
    await db.integration_keys.update_one(
        {"_id": "main"},
        {"$set": {"enable_zelle": True, "zelle_platform_handle": "platform@handyhub.com"}},
        upsert=True,
    )
    bid = f"booking_paytest_{uuid.uuid4().hex[:8]}"
    tid = f"task_paytest_{uuid.uuid4().hex[:8]}"
    total = round(executor_price / 0.85, 2)
    commission = round(total - executor_price, 2)
    now = datetime.now(timezone.utc)
    doc = {
        "booking_id": bid, "client_id": cli["user_id"], "provider_id": prov["user_id"],
        "category": "assembly", "title": "T", "description": "t", "address": "a",
        "date": "2026-02-15", "time": "12:00", "status": "completed_pending_payment",
        "total_price": total, "platform_take": commission, "executor_take": executor_price,
        "commission_amount": commission, "commission_rate_snapshot": 15.0,
        "created_at": now, "updated_at": now,
    }
    await db.bookings.insert_one(doc)
    await db.tasks.insert_one({
        "task_id": tid, "booking_id": bid,
        "client_id": cli["user_id"], "provider_id": prov["user_id"],
        "title": "T", "description": "t", "status": "completed_pending_payment",
        "total_price": total, "executor_take": executor_price, "platform_take": commission,
        "created_at": now, "updated_at": now,
    })
    return bid, tid


async def _cleanup(bid):
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    await db.bookings.delete_one({"booking_id": bid})
    await db.tasks.delete_many({"booking_id": bid})
    await db.payment_transactions.delete_many({"booking_id": bid})


@pytest.mark.asyncio
async def test_manual_confirm_mirrors_payment_status_onto_task():
    bid, tid = await _seed_completed_booking()
    token = _login("client@handyhub.com", "Client2024!")
    r = requests.post(
        f"{API_URL}/api/payments/manual-confirm",
        json={"booking_id": bid, "method": "zelle"},
        headers={"Authorization": f"Bearer {token}"}, timeout=10,
    )
    assert r.status_code == 200, r.text
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    task = await db.tasks.find_one({"task_id": tid}, {"_id": 0})
    assert task["payment_status"] == "pending_verification"
    assert task["payment_method"] == "zelle"
    # task.status MUST stay at completed_pending_payment until admin approves
    assert task["status"] == "completed_pending_payment"
    await _cleanup(bid)


@pytest.mark.asyncio
async def test_manual_confirm_with_tip_goes_to_executor_only():
    bid, tid = await _seed_completed_booking()
    token = _login("client@handyhub.com", "Client2024!")
    r = requests.post(
        f"{API_URL}/api/payments/manual-confirm",
        json={"booking_id": bid, "method": "zelle", "tip_amount": 100},
        headers={"Authorization": f"Bearer {token}"}, timeout=10,
    )
    assert r.status_code == 200, r.text
    txn_id = r.json()["transaction_id"]
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    txn = await db.payment_transactions.find_one({"transaction_id": txn_id}, {"_id": 0})
    # Total client must send = base 23.53 + tip 100 = 123.53
    assert abs(txn["amount"] - 123.53) < 0.01
    # Tip goes 100% to executor (executor_take = 20 + 100 = 120)
    assert abs(txn["metadata"]["executor_take"] - 120.0) < 0.01
    # Commission unchanged
    assert abs(txn["metadata"]["platform_take"] - 3.53) < 0.01
    assert abs(txn["metadata"]["tip_amount"] - 100.0) < 0.01
    booking = await db.bookings.find_one({"booking_id": bid}, {"_id": 0})
    assert booking.get("tip_amount") == 100.0
    await _cleanup(bid)


@pytest.mark.asyncio
async def test_admin_verify_alone_does_not_mark_paid_executor_must_also_confirm():
    """Admin verify alone is no longer enough — task.status must stay
    `completed_pending_payment` until BOTH admin AND executor confirm."""
    bid, tid = await _seed_completed_booking()
    client_token = _login("client@handyhub.com", "Client2024!")
    r = requests.post(
        f"{API_URL}/api/payments/manual-confirm",
        json={"booking_id": bid, "method": "zelle"},
        headers={"Authorization": f"Bearer {client_token}"}, timeout=10,
    )
    txn_id = r.json()["transaction_id"]
    admin_token = _login("admin@handyhub.com", "Admin2024!")
    r2 = requests.post(
        f"{API_URL}/api/admin/payments/{txn_id}/verify",
        json={"action": "approve"},
        headers={"Authorization": f"Bearer {admin_token}"}, timeout=10,
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["payment_status"] == "admin_confirmed"
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    task = await db.tasks.find_one({"task_id": tid}, {"_id": 0})
    # Admin alone — task NOT yet paid (executor must also confirm)
    assert task["status"] == "completed_pending_payment"
    assert task.get("admin_confirmed") is True
    assert not task.get("executor_confirmed")
    await _cleanup(bid)


@pytest.mark.asyncio
async def test_executor_then_admin_marks_paid():
    """Executor confirms first, then admin confirms — task.status = paid."""
    bid, tid = await _seed_completed_booking()
    client_token = _login("client@handyhub.com", "Client2024!")
    r = requests.post(
        f"{API_URL}/api/payments/manual-confirm",
        json={"booking_id": bid, "method": "zelle"},
        headers={"Authorization": f"Bearer {client_token}"}, timeout=10,
    )
    txn_id = r.json()["transaction_id"]
    provider_token = _login("provider@handyhub.com", "Provider2024!")
    r2 = requests.post(
        f"{API_URL}/api/payments/executor-confirm",
        json={"booking_id": bid, "action": "confirm"},
        headers={"Authorization": f"Bearer {provider_token}"}, timeout=10,
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["payment_status"] == "executor_confirmed"
    # Now admin approves
    admin_token = _login("admin@handyhub.com", "Admin2024!")
    r3 = requests.post(
        f"{API_URL}/api/admin/payments/{txn_id}/verify",
        json={"action": "approve"},
        headers={"Authorization": f"Bearer {admin_token}"}, timeout=10,
    )
    assert r3.status_code == 200, r3.text
    assert r3.json()["payment_status"] == "paid"
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    task = await db.tasks.find_one({"task_id": tid}, {"_id": 0})
    assert task["status"] == "paid"
    assert task["payment_status"] == "paid"
    assert task.get("executor_confirmed") is True
    assert task.get("admin_confirmed") is True
    await _cleanup(bid)


@pytest.mark.asyncio
async def test_executor_rejects_marks_disputed():
    bid, tid = await _seed_completed_booking()
    client_token = _login("client@handyhub.com", "Client2024!")
    requests.post(
        f"{API_URL}/api/payments/manual-confirm",
        json={"booking_id": bid, "method": "zelle"},
        headers={"Authorization": f"Bearer {client_token}"}, timeout=10,
    )
    provider_token = _login("provider@handyhub.com", "Provider2024!")
    r = requests.post(
        f"{API_URL}/api/payments/executor-confirm",
        json={"booking_id": bid, "action": "reject"},
        headers={"Authorization": f"Bearer {provider_token}"}, timeout=10,
    )
    assert r.status_code == 200, r.text
    assert r.json()["payment_status"] == "disputed"
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    task = await db.tasks.find_one({"task_id": tid}, {"_id": 0})
    assert task["payment_status"] == "disputed"
    assert task["status"] == "completed_pending_payment"  # not auto-paid
    await _cleanup(bid)


@pytest.mark.asyncio
async def test_executor_confirm_requires_provider_role():
    """A random client cannot call executor-confirm for someone else's booking."""
    bid, _ = await _seed_completed_booking()
    client_token = _login("client@handyhub.com", "Client2024!")
    requests.post(
        f"{API_URL}/api/payments/manual-confirm",
        json={"booking_id": bid, "method": "zelle"},
        headers={"Authorization": f"Bearer {client_token}"}, timeout=10,
    )
    # client tries to call executor-confirm
    r = requests.post(
        f"{API_URL}/api/payments/executor-confirm",
        json={"booking_id": bid, "action": "confirm"},
        headers={"Authorization": f"Bearer {client_token}"}, timeout=10,
    )
    assert r.status_code == 403, r.text
    await _cleanup(bid)
