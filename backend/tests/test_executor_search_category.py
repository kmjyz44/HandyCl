"""Regression: /executors/by-service must filter by category — an executor with
only `Збірка меблів` (assembly) skill must NOT appear when client searches
for `home_improvements` (Ремонт будинку)."""
import os
import asyncio
import requests
import pytest
from motor.motor_asyncio import AsyncIOMotorClient

API_URL = os.environ.get("PUBLIC_API_URL", "https://payment-flow-test-39.preview.emergentagent.com")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


async def _set_provider_skills(skills):
    db = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
    p = await db.users.find_one({"email": "provider@handyhub.com"}, {"_id": 0, "user_id": 1})
    await db.executor_profiles.update_one(
        {"user_id": p["user_id"]},
        {"$set": {"user_id": p["user_id"], "skills": skills, "hourly_rate": 25, "is_verified": True}},
        upsert=True,
    )


def _list_provider_emails(category):
    r = requests.get(f"{API_URL}/api/executors/by-service", params={"category": category} if category else {}, timeout=10)
    r.raise_for_status()
    d = r.json()
    items = d if isinstance(d, list) else d.get("executors", [])
    return [e.get("email") for e in items]


@pytest.mark.asyncio
async def test_category_filter_excludes_mismatched_provider():
    """Provider with only `Збірка меблів` must NOT appear under home_improvements."""
    await _set_provider_skills(["Збірка меблів"])
    home_repair = _list_provider_emails("home_improvements")
    assert "provider@handyhub.com" not in home_repair, f"Mismatched provider leaked into home_improvements: {home_repair}"


@pytest.mark.asyncio
async def test_category_filter_includes_matching_provider():
    """Provider with `Збірка меблів` skill MUST appear under assembly category."""
    await _set_provider_skills(["Збірка меблів"])
    assembly = _list_provider_emails("assembly")
    assert "provider@handyhub.com" in assembly, f"Matching provider missing from assembly: {assembly}"


@pytest.mark.asyncio
async def test_category_filter_with_skill_object():
    """Skill stored as object {category_id, name} must be matched correctly."""
    await _set_provider_skills([
        {"id": "s1", "category_id": "home_improvements", "name": "Сантехніка", "hourly_rate": 30, "status": "active"}
    ])
    home_repair = _list_provider_emails("home_improvements")
    assert "provider@handyhub.com" in home_repair, f"Home-improvements skill object not matched: {home_repair}"
    assembly = _list_provider_emails("assembly")
    assert "provider@handyhub.com" not in assembly, f"home_improvements provider leaked into assembly: {assembly}"


@pytest.mark.asyncio
async def test_no_category_returns_provider():
    """Without category filter, the provider should still appear."""
    await _set_provider_skills(["Збірка меблів"])
    all_providers = _list_provider_emails(None)
    assert "provider@handyhub.com" in all_providers
