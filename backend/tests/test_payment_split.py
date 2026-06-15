"""Regression: commission split must be present for manual & Stripe payment flows
even when booking was created without snapshot fields (older data / legacy)."""
import os
import uuid
import asyncio
import requests
import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

API_URL = os.environ.get("PUBLIC_API_URL", "https://payout-hub-20.preview.emergentagent.com")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


def _login(email, password):
    r = requests.post(f"{API_URL}/api/auth/login", json={"email": email, "password": password}, timeout=10)
    r.raise_for_status()
    return r.json()["session_token"]


async def _create_broken_booking(executor_price: float = 20.0, category_id: str = "assembly"):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    provider = await db.users.find_one({"email": "provider@handyhub.com"}, {"_id": 0, "user_id": 1})
    customer = await db.users.find_one({"email": "client@handyhub.com"}, {"_id": 0, "user_id": 1})
    assert provider and customer, "test users missing"
    # ensure category has 15% commission
    await db.categories.update_one(
        {"category_id": category_id},
        {"$set": {"category_id": category_id, "name": "Збірка меблів", "commission_rate": 15.0, "is_active": True}},
        upsert=True,
    )
    # ensure zelle is enabled with a platform handle
    await db.integration_keys.update_one(
        {"_id": "main"},
        {"$set": {"enable_zelle": True, "zelle_platform_handle": "test-platform@handyhub.com"}},
        upsert=True,
    )
    bid = f"booking_split_test_{uuid.uuid4().hex[:8]}"
    await db.bookings.insert_one({
        "booking_id": bid,
        "client_id": customer["user_id"],
        "provider_id": provider["user_id"],
        "category": category_id,
        "title": "Test",
        "description": "test",
        "address": "Test",
        "date": "2026-02-15",
        "time": "12:00",
        "status": "pending_acceptance",
        "estimated_price": executor_price,
        "total_price": executor_price,  # NOT marked up — legacy data
        "provider_hourly_rate": executor_price,
        # platform_take / executor_take intentionally missing
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    })
    return bid


@pytest.mark.asyncio
async def test_manual_instructions_recomputes_commission_when_missing():
    bid = await _create_broken_booking(20.0, "assembly")
    token = _login("client@handyhub.com", "Client2024!")
    r = requests.get(
        f"{API_URL}/api/payments/manual-instructions",
        params={"booking_id": bid, "method": "zelle"},
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    # 20 / (1 - 0.15) = 23.53
    assert abs(data["total"] - 23.53) < 0.01
    assert data["commission_rate"] == 15.0
    splits = {s["to"]: s for s in data["splits"]}
    assert abs(splits["platform"]["amount"] - 3.53) < 0.01
    assert abs(splits["executor"]["amount"] - 20.0) < 0.01

    # ensure the booking was backfilled in DB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    bk = await db.bookings.find_one({"booking_id": bid}, {"_id": 0})
    assert abs(bk["platform_take"] - 3.53) < 0.01
    assert abs(bk["executor_take"] - 20.0) < 0.01
    assert abs(bk["total_price"] - 23.53) < 0.01
    # cleanup
    await db.bookings.delete_one({"booking_id": bid})
