import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def admin_session():
    """Login as admin and return session token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@handyhub.com", "password": "admin123"}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    data = response.json()
    return data["session_token"]

@pytest.fixture(scope="module")
def provider_session():
    """Login as provider and return session token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "provider@example.com", "password": "provider123"}
    )
    assert response.status_code == 200, f"Provider login failed: {response.text}"
    data = response.json()
    return data["session_token"]

@pytest.fixture
def admin_headers(admin_session):
    return {"Authorization": f"Bearer {admin_session}", "Content-Type": "application/json"}

@pytest.fixture
def provider_headers(provider_session):
    return {"Authorization": f"Bearer {provider_session}", "Content-Type": "application/json"}


class TestCommissionRulesAPI:
    """Test Commission Rules CRUD operations"""
    
    created_rule_id = None
    
    def test_get_commission_rules_empty(self, admin_headers):
        """Test getting commission rules when none exist"""
        response = requests.get(f"{BASE_URL}/api/admin/commission-rules", headers=admin_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_create_commission_rule(self, admin_headers):
        """Test creating a new commission rule"""
        unique_name = f"TEST_Rule_{uuid.uuid4().hex[:8]}"
        data = {
            "name": unique_name,
            "commission_type": "percentage",
            "commission_value": 10.0,
            "is_global": False,
            "category": "cleaning_regular",
            "priority": 1
        }
        response = requests.post(f"{BASE_URL}/api/admin/commission-rules", json=data, headers=admin_headers)
        assert response.status_code == 200, f"Create commission rule failed: {response.text}"
        
        rule = response.json()
        assert rule["name"] == unique_name
        assert rule["commission_type"] == "percentage"
        assert rule["commission_value"] == 10.0
        assert rule["category"] == "cleaning_regular"
        assert "rule_id" in rule
        
        TestCommissionRulesAPI.created_rule_id = rule["rule_id"]
    
    def test_get_commission_rules_after_create(self, admin_headers):
        """Test getting commission rules after creating one"""
        response = requests.get(f"{BASE_URL}/api/admin/commission-rules", headers=admin_headers)
        assert response.status_code == 200
        rules = response.json()
        assert isinstance(rules, list)
        # Should have at least the one we created
        assert len(rules) >= 1
    
    def test_update_commission_rule(self, admin_headers):
        """Test updating a commission rule"""
        if not TestCommissionRulesAPI.created_rule_id:
            pytest.skip("No rule created to update")
        
        data = {
            "name": f"TEST_Updated_Rule_{uuid.uuid4().hex[:8]}",
            "commission_type": "percentage",
            "commission_value": 15.0,
            "is_global": False,
            "category": "cleaning_deep",
            "priority": 2
        }
        response = requests.put(
            f"{BASE_URL}/api/admin/commission-rules/{TestCommissionRulesAPI.created_rule_id}",
            json=data,
            headers=admin_headers
        )
        assert response.status_code == 200, f"Update commission rule failed: {response.text}"
        
        rule = response.json()
        assert rule["commission_value"] == 15.0
        assert rule["category"] == "cleaning_deep"
    
    def test_delete_commission_rule(self, admin_headers):
        """Test deleting a commission rule"""
        if not TestCommissionRulesAPI.created_rule_id:
            pytest.skip("No rule created to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/admin/commission-rules/{TestCommissionRulesAPI.created_rule_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        
        # Verify it's deleted
        response = requests.get(f"{BASE_URL}/api/admin/commission-rules", headers=admin_headers)
        rules = response.json()
        assert all(r["rule_id"] != TestCommissionRulesAPI.created_rule_id for r in rules)


class TestCommissionCalculation:
    """Test commission calculation endpoint"""
    
    def test_calculate_commission(self, admin_headers):
        """Test calculating commission for a given price"""
        response = requests.get(
            f"{BASE_URL}/api/commission/calculate",
            params={"base_price": 100},
            headers=admin_headers
        )
        assert response.status_code == 200, f"Commission calculation failed: {response.text}"
        
        result = response.json()
        assert "base_price" in result
        assert "commission_percent" in result
        assert "commission_amount" in result
        assert "service_fee" in result
        assert "total_client_pays" in result
        assert "tasker_payout" in result
        assert result["base_price"] == 100
    
    def test_calculate_commission_with_category(self, admin_headers):
        """Test calculating commission with category"""
        response = requests.get(
            f"{BASE_URL}/api/commission/calculate",
            params={"base_price": 150, "category": "cleaning_regular"},
            headers=admin_headers
        )
        assert response.status_code == 200
        result = response.json()
        assert result["base_price"] == 150


class TestTaskerSearchAPI:
    """Test Tasker Search API with scoring algorithm"""
    
    def test_search_taskers_basic(self, admin_headers):
        """Test basic tasker search"""
        response = requests.get(f"{BASE_URL}/api/taskers/search", headers=admin_headers)
        assert response.status_code == 200, f"Tasker search failed: {response.text}"
        
        result = response.json()
        assert "taskers" in result
        assert isinstance(result["taskers"], list)
    
    def test_search_taskers_with_filters(self, admin_headers):
        """Test tasker search with filters"""
        response = requests.get(
            f"{BASE_URL}/api/taskers/search",
            params={"min_rating": 3.0, "limit": 10},
            headers=admin_headers
        )
        assert response.status_code == 200
        result = response.json()
        assert "taskers" in result
    
    def test_search_taskers_verified_only(self, admin_headers):
        """Test tasker search with verified_only filter"""
        response = requests.get(
            f"{BASE_URL}/api/taskers/search",
            params={"verified_only": True},
            headers=admin_headers
        )
        assert response.status_code == 200
        result = response.json()
        assert "taskers" in result
    
    def test_search_taskers_by_city(self, admin_headers):
        """Test tasker search by city"""
        response = requests.get(
            f"{BASE_URL}/api/taskers/search",
            params={"city": "Kyiv"},
            headers=admin_headers
        )
        assert response.status_code == 200
        result = response.json()
        assert "taskers" in result
    
    def test_search_taskers_sort_by_rating(self, admin_headers):
        """Test tasker search sorted by rating"""
        response = requests.get(
            f"{BASE_URL}/api/taskers/search",
            params={"sort_by": "rating"},
            headers=admin_headers
        )
        assert response.status_code == 200
        result = response.json()
        assert "taskers" in result


class TestCMSContentAPI:
    """Test CMS Content CRUD operations"""
    
    created_content_id = None
    
    def test_get_public_cms_content(self, admin_headers):
        """Test getting public CMS content"""
        response = requests.get(f"{BASE_URL}/api/cms/content")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_create_cms_content(self, admin_headers):
        """Test creating CMS content"""
        unique_slug = f"test-page-{uuid.uuid4().hex[:8]}"
        data = {
            "content_type": "page",
            "slug": unique_slug,
            "title": "Test Page Title",
            "content": "<p>Test content</p>",
            "is_published": True,
            "sort_order": 1
        }
        response = requests.post(f"{BASE_URL}/api/admin/cms/content", json=data, headers=admin_headers)
        assert response.status_code == 200, f"Create CMS content failed: {response.text}"
        
        content = response.json()
        assert content["title"] == "Test Page Title"
        assert content["slug"] == unique_slug
        assert "content_id" in content
        
        TestCMSContentAPI.created_content_id = content["content_id"]
    
    def test_get_cms_content_by_slug(self, admin_headers):
        """Test getting CMS content by slug"""
        if not TestCMSContentAPI.created_content_id:
            pytest.skip("No content created")
        
        # Get the created content first to know the slug
        response = requests.get(f"{BASE_URL}/api/admin/cms/content", headers=admin_headers)
        contents = response.json()
        test_content = next((c for c in contents if c["content_id"] == TestCMSContentAPI.created_content_id), None)
        
        if test_content:
            response = requests.get(f"{BASE_URL}/api/cms/content/{test_content['slug']}")
            assert response.status_code == 200
            content = response.json()
            assert content["title"] == test_content["title"]
    
    def test_admin_get_all_cms_content(self, admin_headers):
        """Test admin getting all CMS content including drafts"""
        response = requests.get(f"{BASE_URL}/api/admin/cms/content", headers=admin_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_update_cms_content(self, admin_headers):
        """Test updating CMS content"""
        if not TestCMSContentAPI.created_content_id:
            pytest.skip("No content created to update")
        
        data = {
            "title": "Updated Test Page Title",
            "content": "<p>Updated test content</p>"
        }
        response = requests.put(
            f"{BASE_URL}/api/admin/cms/content/{TestCMSContentAPI.created_content_id}",
            json=data,
            headers=admin_headers
        )
        assert response.status_code == 200, f"Update CMS content failed: {response.text}"
        
        content = response.json()
        assert content["title"] == "Updated Test Page Title"
    
    def test_delete_cms_content(self, admin_headers):
        """Test deleting CMS content"""
        if not TestCMSContentAPI.created_content_id:
            pytest.skip("No content created to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/admin/cms/content/{TestCMSContentAPI.created_content_id}",
            headers=admin_headers
        )
        assert response.status_code == 200


class TestFAQAPI:
    """Test FAQ CRUD operations"""
    
    created_faq_id = None
    
    def test_get_public_faqs(self):
        """Test getting public FAQs"""
        response = requests.get(f"{BASE_URL}/api/faq")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_create_faq(self, admin_headers):
        """Test creating FAQ"""
        data = {
            "question": f"Test Question {uuid.uuid4().hex[:8]}",
            "answer": "Test Answer content",
            "category": "general",
            "sort_order": 1,
            "is_published": True
        }
        response = requests.post(f"{BASE_URL}/api/admin/faq", json=data, headers=admin_headers)
        assert response.status_code == 200, f"Create FAQ failed: {response.text}"
        
        faq = response.json()
        assert "faq_id" in faq
        assert "question" in faq
        assert "answer" in faq
        
        TestFAQAPI.created_faq_id = faq["faq_id"]
    
    def test_admin_get_all_faqs(self, admin_headers):
        """Test admin getting all FAQs"""
        response = requests.get(f"{BASE_URL}/api/admin/faq", headers=admin_headers)
        assert response.status_code == 200
        faqs = response.json()
        assert isinstance(faqs, list)
        assert len(faqs) >= 1  # At least the one we created
    
    def test_update_faq(self, admin_headers):
        """Test updating FAQ"""
        if not TestFAQAPI.created_faq_id:
            pytest.skip("No FAQ created to update")
        
        data = {
            "question": "Updated Test Question",
            "answer": "Updated Test Answer"
        }
        response = requests.put(
            f"{BASE_URL}/api/admin/faq/{TestFAQAPI.created_faq_id}",
            json=data,
            headers=admin_headers
        )
        assert response.status_code == 200, f"Update FAQ failed: {response.text}"
        
        faq = response.json()
        assert faq["question"] == "Updated Test Question"
    
    def test_delete_faq(self, admin_headers):
        """Test deleting FAQ"""
        if not TestFAQAPI.created_faq_id:
            pytest.skip("No FAQ created to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/admin/faq/{TestFAQAPI.created_faq_id}",
            headers=admin_headers
        )
        assert response.status_code == 200


class TestPayoutAPI:
    """Test Payout endpoints"""
    
    def test_get_pending_payouts(self, admin_headers):
        """Test admin getting pending payouts"""
        response = requests.get(f"{BASE_URL}/api/admin/payouts/pending", headers=admin_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_get_my_payouts_as_provider(self, provider_headers):
        """Test provider getting their payouts"""
        response = requests.get(f"{BASE_URL}/api/tasker/payouts", headers=provider_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_get_payout_accounts(self, provider_headers):
        """Test provider getting their payout accounts"""
        response = requests.get(f"{BASE_URL}/api/tasker/payout-accounts", headers=provider_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestRefundAPI:
    """Test Refund endpoints"""
    
    def test_get_admin_refunds(self, admin_headers):
        """Test admin getting refunds"""
        response = requests.get(f"{BASE_URL}/api/admin/refunds", headers=admin_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_get_refunds_by_status(self, admin_headers):
        """Test getting refunds filtered by status"""
        response = requests.get(
            f"{BASE_URL}/api/admin/refunds",
            params={"status": "requested"},
            headers=admin_headers
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestTaskerVerificationAPI:
    """Test Tasker Verification endpoints"""
    
    def test_get_my_documents_as_provider(self, provider_headers):
        """Test provider getting their documents"""
        response = requests.get(f"{BASE_URL}/api/tasker/documents", headers=provider_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_get_pending_documents_admin(self, admin_headers):
        """Test admin getting pending documents"""
        response = requests.get(f"{BASE_URL}/api/admin/documents/pending", headers=admin_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_upload_document(self, provider_headers):
        """Test uploading a verification document"""
        data = {
            "document_type": "id_card",
            "file_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        }
        response = requests.post(f"{BASE_URL}/api/tasker/documents", json=data, headers=provider_headers)
        assert response.status_code == 200, f"Upload document failed: {response.text}"
        
        doc = response.json()
        assert "document_id" in doc
        assert doc["document_type"] == "id_card"
        assert doc["status"] == "pending"


class TestEscrowAPI:
    """Test Escrow hold/release/refund endpoints"""
    
    def test_get_escrow_status_nonexistent(self, admin_headers):
        """Test getting escrow status for non-existent booking"""
        response = requests.get(f"{BASE_URL}/api/escrow/status/nonexistent_booking", headers=admin_headers)
        # Should return 404 or empty status
        assert response.status_code in [200, 404]
    
    def test_escrow_hold_no_booking(self, admin_headers):
        """Test escrow hold for non-existent booking"""
        response = requests.post(
            f"{BASE_URL}/api/escrow/hold",
            params={"booking_id": "nonexistent"},
            headers=admin_headers
        )
        assert response.status_code == 404  # Booking not found
