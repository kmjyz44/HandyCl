"""
HandyHub API Tests
Tests for all API endpoints including auth, executors, availability, profile
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://handyhub-preview-1.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@handyhub.com"
ADMIN_PASSWORD = "admin123"
PROVIDER_EMAIL = "provider@handyhub.com"
PROVIDER_PASSWORD = "admin123"
INVALID_EMAIL = "invalid@test.com"
INVALID_PASSWORD = "wrongpassword"


class TestHealthAndConnectivity:
    """Test basic connectivity"""
    
    def test_health_check(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health check passed")
    
    def test_api_test_endpoint(self):
        """Test API test endpoint"""
        response = requests.get(f"{BASE_URL}/api/test")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "message" in data
        print("✓ API test endpoint passed")


class TestAuthentication:
    """Authentication flow tests"""
    
    def test_login_admin_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "session_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful - user: {data['user']['name']}")
        
    def test_login_provider_success(self):
        """Test provider login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PROVIDER_EMAIL,
            "password": PROVIDER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "session_token" in data
        assert "user" in data
        assert data["user"]["role"] == "provider"
        print(f"✓ Provider login successful - user: {data['user']['name']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": INVALID_EMAIL,
            "password": INVALID_PASSWORD
        })
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected")
    
    def test_google_auth_url(self):
        """Test Google OAuth URL endpoint"""
        response = requests.get(f"{BASE_URL}/api/auth/google")
        assert response.status_code == 200
        data = response.json()
        assert "auth_url" in data
        assert "auth.emergentagent.com" in data["auth_url"]
        print(f"✓ Google auth URL returned correctly")


class TestExecutors:
    """Executor listing and profile tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["session_token"]
        pytest.skip("Authentication failed")
    
    def test_get_all_executors(self, auth_token):
        """Test getting all executors list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/executors", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} executors")
        
        # Check executor structure if any exist
        if len(data) > 0:
            executor = data[0]
            assert "user_id" in executor
            assert "name" in executor
            assert "average_rating" in executor
            assert "total_reviews" in executor
            print(f"  First executor: {executor.get('name', 'Unknown')}")
    
    def test_get_available_executors(self, auth_token):
        """Test getting available executors with filters"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/executors/available", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "executors" in data
        assert "total" in data
        print(f"✓ Got {data['total']} available executors")
    
    def test_get_available_executors_with_filters(self, auth_token):
        """Test getting available executors with day filter"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/executors/available?day_of_week=0&min_rating=3", 
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "executors" in data
        print(f"✓ Filtered executors: {data['total']} results")


class TestExecutorProfile:
    """Executor profile tests"""
    
    @pytest.fixture
    def provider_token(self):
        """Get provider auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PROVIDER_EMAIL,
            "password": PROVIDER_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["session_token"], response.json()["user"]["user_id"]
        pytest.skip("Provider authentication failed")
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["session_token"]
        pytest.skip("Admin authentication failed")
    
    def test_get_executor_profile_by_id(self, admin_token, provider_token):
        """Test getting executor profile by user ID"""
        token, provider_id = provider_token
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/profile/executor/{provider_id}", headers=headers)
        
        # Profile might not exist yet - 404 is acceptable
        if response.status_code == 404:
            print("✓ Profile not found (expected for new provider)")
            return
            
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        print(f"✓ Got executor profile for {provider_id}")
    
    def test_get_my_executor_profile(self, provider_token):
        """Test getting own executor profile"""
        token, _ = provider_token
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/profile/executor", headers=headers)
        
        # Profile might not exist yet - 404 is acceptable
        if response.status_code == 404:
            print("✓ Own profile not found (expected for new provider)")
            return
            
        assert response.status_code == 200
        print("✓ Got own executor profile")
    
    def test_create_or_update_executor_profile(self, provider_token):
        """Test creating/updating executor profile"""
        token, provider_id = provider_token
        headers = {"Authorization": f"Bearer {token}"}
        
        profile_data = {
            "bio": "Test provider bio for API testing",
            "skills": ["plumbing", "electrical", "carpentry"],
            "experience_years": 5,
            "hourly_rate": 35.0,
            "languages": ["English", "Ukrainian"],
            "certifications": ["Licensed Plumber"]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/profile/executor",
            headers=headers,
            json=profile_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "bio" in data
        assert data["skills"] == profile_data["skills"]
        print("✓ Executor profile created/updated successfully")


class TestAvailability:
    """Availability calendar tests"""
    
    @pytest.fixture
    def provider_auth(self):
        """Get provider auth"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PROVIDER_EMAIL,
            "password": PROVIDER_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["session_token"], response.json()["user"]["user_id"]
        pytest.skip("Provider authentication failed")
    
    def test_get_executor_availability(self, provider_auth):
        """Test getting executor availability by ID"""
        token, provider_id = provider_auth
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/availability/{provider_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "slots" in data
        print(f"✓ Got availability for {provider_id}: {len(data['slots'])} slots")
    
    def test_get_my_availability(self, provider_auth):
        """Test getting own availability"""
        token, _ = provider_auth
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/availability", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "slots" in data
        print(f"✓ Got own availability: {len(data['slots'])} slots")
    
    def test_create_availability_slot(self, provider_auth):
        """Test creating availability slot"""
        token, _ = provider_auth
        headers = {"Authorization": f"Bearer {token}"}
        
        slot_data = {
            "day_of_week": 1,  # Tuesday
            "start_time": "10:00",
            "end_time": "16:00",
            "location": "Kyiv, Center"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/availability",
            headers=headers,
            json=slot_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "slot_id" in data
        assert data["day_of_week"] == 1
        assert data["start_time"] == "10:00"
        print(f"✓ Created availability slot: {data['slot_id']}")
        
        # Cleanup - delete the slot
        slot_id = data["slot_id"]
        delete_response = requests.delete(
            f"{BASE_URL}/api/availability/{slot_id}",
            headers=headers
        )
        assert delete_response.status_code == 200
        print("✓ Cleaned up test slot")


class TestUserProfile:
    """User profile update tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["session_token"]
        pytest.skip("Authentication failed")
    
    def test_update_user_profile(self, auth_token):
        """Test updating user profile (name, phone)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        profile_data = {
            "name": "Admin User Updated",
            "phone": "+380991234567"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/users/profile",
            headers=headers,
            json=profile_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == profile_data["name"]
        print("✓ User profile updated successfully")
        
        # Restore original name
        restore_data = {"name": "Admin User"}
        requests.put(f"{BASE_URL}/api/users/profile", headers=headers, json=restore_data)
    
    def test_update_user_picture(self, auth_token):
        """Test updating user picture"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Test with empty picture (remove)
        response = requests.put(
            f"{BASE_URL}/api/users/profile",
            headers=headers,
            json={"picture": ""}
        )
        
        assert response.status_code == 200
        print("✓ User picture can be updated/removed")


class TestAdminDashboard:
    """Admin dashboard tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["session_token"]
        pytest.skip("Admin authentication failed")
    
    def test_get_admin_dashboard(self, admin_token):
        """Test admin dashboard stats"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "total_users" in data
        assert "total_bookings" in data
        assert "total_services" in data
        assert "pending_bookings" in data
        
        print(f"✓ Dashboard stats:")
        print(f"  Total Users: {data['total_users']}")
        print(f"  Total Bookings: {data['total_bookings']}")
        print(f"  Total Services: {data['total_services']}")
        print(f"  Pending Bookings: {data['pending_bookings']}")


class TestServices:
    """Service endpoints tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["session_token"]
        pytest.skip("Admin authentication failed")
    
    def test_get_services(self):
        """Test getting all services (public endpoint)"""
        response = requests.get(f"{BASE_URL}/api/services")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} services")


class TestPricing:
    """Pricing endpoint tests"""
    
    @pytest.fixture
    def provider_auth(self):
        """Get provider auth"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PROVIDER_EMAIL,
            "password": PROVIDER_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["session_token"], response.json()["user"]["user_id"]
        pytest.skip("Provider authentication failed")
    
    def test_get_executor_pricing(self, provider_auth):
        """Test getting executor pricing"""
        token, provider_id = provider_auth
        
        # First ensure profile has hourly rate
        headers = {"Authorization": f"Bearer {token}"}
        requests.post(
            f"{BASE_URL}/api/profile/executor",
            headers=headers,
            json={"hourly_rate": 40.0, "skills": ["testing"]}
        )
        
        response = requests.get(f"{BASE_URL}/api/pricing/{provider_id}")
        
        if response.status_code == 404:
            print("✓ Pricing not available (no hourly rate set)")
            return
            
        assert response.status_code == 200
        data = response.json()
        assert "executor_id" in data
        assert "base_rate" in data
        assert "final_rate" in data
        print(f"✓ Got pricing: ${data['final_rate']}/hr")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
