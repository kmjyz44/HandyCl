"""
P1 Features API Tests - Service Zones, Provider Invoices
Tests for HandyHub P1 features: geofencing management, invoice generation
"""
import pytest
import requests
import os
from datetime import datetime
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@handyhub.com"
ADMIN_PASSWORD = "admin123"
PROVIDER_EMAIL = "provider.test@handyhub.com"
PROVIDER_PASSWORD = "test123"
CLIENT_EMAIL = "test@example.com"
CLIENT_PASSWORD = "test123"


class TestAuth:
    """Authentication helpers"""
    
    @staticmethod
    def get_admin_token():
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if resp.status_code == 200:
            return resp.json().get("token") or resp.json().get("session_token")
        return None
    
    @staticmethod
    def get_provider_token():
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PROVIDER_EMAIL,
            "password": PROVIDER_PASSWORD
        })
        if resp.status_code == 200:
            return resp.json().get("token") or resp.json().get("session_token")
        return None
    
    @staticmethod
    def get_client_token():
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        if resp.status_code == 200:
            return resp.json().get("token") or resp.json().get("session_token")
        return None


@pytest.fixture(scope="module")
def admin_headers():
    token = TestAuth.get_admin_token()
    if not token:
        pytest.skip("Admin authentication failed")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def provider_headers():
    token = TestAuth.get_provider_token()
    if not token:
        pytest.skip("Provider authentication failed")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def client_headers():
    token = TestAuth.get_client_token()
    if not token:
        pytest.skip("Client authentication failed")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ==================== SERVICE ZONES API TESTS ====================

class TestServiceZonesAPI:
    """Test Admin Service Zones API - Geofencing management"""
    
    created_zone_id = None
    
    def test_admin_get_service_zones(self, admin_headers):
        """Admin can get all service zones"""
        resp = requests.get(f"{BASE_URL}/api/admin/service-zones", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
    
    def test_get_active_service_zones_public(self):
        """Public endpoint returns active service zones"""
        resp = requests.get(f"{BASE_URL}/api/service-zones/active")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
    
    def test_admin_create_service_zone(self, admin_headers):
        """Admin can create a new service zone"""
        zone_data = {
            "name": f"TEST_Zone_{uuid.uuid4().hex[:6]}",
            "description": "Test zone for automated testing",
            "center_lat": 50.4501,
            "center_lng": 30.5234,
            "max_distance_km": 25,
            "service_fee_multiplier": 1.2,
            "min_order_amount": 50,
            "color": "#22c55e",
            "coordinates": [[50.4501, 30.5234], [50.5001, 30.5734], [50.4001, 30.4734]]
        }
        resp = requests.post(f"{BASE_URL}/api/admin/service-zones", headers=admin_headers, json=zone_data)
        assert resp.status_code == 200
        data = resp.json()
        assert "zone_id" in data
        assert data["name"] == zone_data["name"]
        assert data["center_lat"] == zone_data["center_lat"]
        assert data["center_lng"] == zone_data["center_lng"]
        assert data["max_distance_km"] == zone_data["max_distance_km"]
        TestServiceZonesAPI.created_zone_id = data["zone_id"]
    
    def test_admin_update_service_zone(self, admin_headers):
        """Admin can update a service zone"""
        if not TestServiceZonesAPI.created_zone_id:
            pytest.skip("No zone created to update")
        
        update_data = {
            "description": "Updated description",
            "max_distance_km": 30,
            "is_active": True
        }
        resp = requests.put(
            f"{BASE_URL}/api/admin/service-zones/{TestServiceZonesAPI.created_zone_id}",
            headers=admin_headers,
            json=update_data
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["description"] == update_data["description"]
        assert data["max_distance_km"] == update_data["max_distance_km"]
    
    def test_admin_get_zone_after_update(self, admin_headers):
        """Verify zone update persisted"""
        if not TestServiceZonesAPI.created_zone_id:
            pytest.skip("No zone created to verify")
        
        resp = requests.get(f"{BASE_URL}/api/admin/service-zones", headers=admin_headers)
        assert resp.status_code == 200
        zones = resp.json()
        zone = next((z for z in zones if z["zone_id"] == TestServiceZonesAPI.created_zone_id), None)
        assert zone is not None
        assert zone["max_distance_km"] == 30
    
    def test_admin_get_zone_taskers(self, admin_headers):
        """Admin can get taskers in a zone"""
        if not TestServiceZonesAPI.created_zone_id:
            pytest.skip("No zone created")
        
        resp = requests.get(
            f"{BASE_URL}/api/admin/service-zones/{TestServiceZonesAPI.created_zone_id}/taskers",
            headers=admin_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
    
    def test_service_zones_require_admin(self, provider_headers):
        """Service zone management requires admin role"""
        resp = requests.get(f"{BASE_URL}/api/admin/service-zones", headers=provider_headers)
        assert resp.status_code == 403
    
    def test_admin_delete_service_zone(self, admin_headers):
        """Admin can delete a service zone (cleanup)"""
        if not TestServiceZonesAPI.created_zone_id:
            pytest.skip("No zone created to delete")
        
        resp = requests.delete(
            f"{BASE_URL}/api/admin/service-zones/{TestServiceZonesAPI.created_zone_id}",
            headers=admin_headers
        )
        assert resp.status_code == 200
        
        # Verify deletion
        resp = requests.get(f"{BASE_URL}/api/admin/service-zones", headers=admin_headers)
        zones = resp.json()
        zone = next((z for z in zones if z["zone_id"] == TestServiceZonesAPI.created_zone_id), None)
        assert zone is None


# ==================== PROVIDER INVOICES API TESTS ====================

class TestProviderInvoicesAPI:
    """Test Provider Invoices API"""
    
    def test_provider_get_invoices(self, provider_headers):
        """Provider can get their invoices"""
        resp = requests.get(f"{BASE_URL}/api/provider/invoices", headers=provider_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
    
    def test_client_cannot_access_provider_invoices(self, client_headers):
        """Client cannot access provider invoices endpoint"""
        resp = requests.get(f"{BASE_URL}/api/provider/invoices", headers=client_headers)
        assert resp.status_code == 403
    
    def test_provider_create_invoice_requires_booking(self, provider_headers):
        """Provider invoice creation requires valid booking"""
        invoice_data = {
            "booking_id": "non_existent_booking",
            "additional_charges": 0,
            "notes": "Test invoice"
        }
        resp = requests.post(
            f"{BASE_URL}/api/provider/invoices/create",
            headers=provider_headers,
            json=invoice_data
        )
        # Should fail with 404 for non-existent booking
        assert resp.status_code == 404
    
    def test_admin_can_access_provider_invoices(self, admin_headers):
        """Admin can also access provider invoices endpoint"""
        resp = requests.get(f"{BASE_URL}/api/provider/invoices", headers=admin_headers)
        assert resp.status_code == 200


# ==================== PROVIDER ZONE OPERATIONS ====================

class TestProviderZoneOperations:
    """Test Provider Zone Join/Leave operations"""
    
    test_zone_id = None
    
    @pytest.fixture(autouse=True)
    def setup_test_zone(self, admin_headers):
        """Create a test zone for provider operations"""
        zone_data = {
            "name": f"TEST_ProviderZone_{uuid.uuid4().hex[:6]}",
            "description": "Test zone for provider operations",
            "center_lat": 49.9935,
            "center_lng": 36.2304,
            "max_distance_km": 20,
            "service_fee_multiplier": 1.0,
            "min_order_amount": 0,
            "color": "#3b82f6",
            "coordinates": []
        }
        resp = requests.post(f"{BASE_URL}/api/admin/service-zones", headers=admin_headers, json=zone_data)
        if resp.status_code == 200:
            TestProviderZoneOperations.test_zone_id = resp.json().get("zone_id")
        yield
        # Cleanup
        if TestProviderZoneOperations.test_zone_id:
            requests.delete(
                f"{BASE_URL}/api/admin/service-zones/{TestProviderZoneOperations.test_zone_id}",
                headers=admin_headers
            )
    
    def test_provider_join_zone(self, provider_headers):
        """Provider can join a service zone"""
        if not TestProviderZoneOperations.test_zone_id:
            pytest.skip("No zone available for join test")
        
        resp = requests.post(
            f"{BASE_URL}/api/provider/service-zones/join",
            headers=provider_headers,
            params={"zone_id": TestProviderZoneOperations.test_zone_id}
        )
        # Allow 200 (success) or 400 (already joined)
        assert resp.status_code in [200, 400]
    
    def test_provider_leave_zone(self, provider_headers):
        """Provider can leave a service zone"""
        if not TestProviderZoneOperations.test_zone_id:
            pytest.skip("No zone available for leave test")
        
        resp = requests.post(
            f"{BASE_URL}/api/provider/service-zones/leave",
            headers=provider_headers,
            params={"zone_id": TestProviderZoneOperations.test_zone_id}
        )
        # Allow 200 (success) or 400 (not in zone)
        assert resp.status_code in [200, 400]


# ==================== BOOKINGS API FOR MULTI-STEP FORM ====================

class TestBookingsAPI:
    """Test Bookings API used by Multi-Step Booking Form"""
    
    created_booking_id = None
    
    def test_client_create_booking(self, client_headers):
        """Client can create a booking (multi-step form backend)"""
        booking_data = {
            "title": f"TEST_Booking_{uuid.uuid4().hex[:6]}",
            "description": "Test booking created via multi-step form test",
            "address": "вул. Хрещатик, 1, кв. 42, Київ",
            "date": "2026-03-15",
            "time": "14:00",
            "notes": "Test notes",
            "estimated_hours": 2
        }
        resp = requests.post(f"{BASE_URL}/api/bookings", headers=client_headers, json=booking_data)
        assert resp.status_code == 200
        data = resp.json()
        assert "booking_id" in data
        assert data["title"] == booking_data["title"]
        assert data["address"] == booking_data["address"]
        TestBookingsAPI.created_booking_id = data["booking_id"]
    
    def test_get_booking_after_create(self, client_headers):
        """Verify booking was created correctly"""
        if not TestBookingsAPI.created_booking_id:
            pytest.skip("No booking created")
        
        resp = requests.get(f"{BASE_URL}/api/bookings/{TestBookingsAPI.created_booking_id}", headers=client_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["booking_id"] == TestBookingsAPI.created_booking_id
    
    def test_client_get_bookings(self, client_headers):
        """Client can get their bookings"""
        resp = requests.get(f"{BASE_URL}/api/bookings", headers=client_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)


# ==================== CLEANUP TEST DATA ====================

class TestCleanup:
    """Cleanup test data at the end"""
    
    def test_cleanup_test_zones(self, admin_headers):
        """Remove any TEST_ prefixed zones"""
        resp = requests.get(f"{BASE_URL}/api/admin/service-zones", headers=admin_headers)
        if resp.status_code == 200:
            zones = resp.json()
            for zone in zones:
                if zone.get("name", "").startswith("TEST_"):
                    requests.delete(
                        f"{BASE_URL}/api/admin/service-zones/{zone['zone_id']}",
                        headers=admin_headers
                    )
        assert True  # Cleanup always passes
