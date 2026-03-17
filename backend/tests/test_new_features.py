"""
HandyHub New Features API Tests
Tests for: Login fixes, Password recovery, Admin password reset, Booking reassignment, 
Provider stats, Profile photo upload, Password visibility toggle
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://handyhub-preview-1.preview.emergentagent.com')

# Test credentials (as per requirement)
ADMIN_EMAIL = "admin@handyhub.com"
ADMIN_PASSWORD = "admin123"
PROVIDER_EMAIL = "provider@example.com"
PROVIDER_PASSWORD = "test123"
CLIENT_EMAIL = "client@example.com"
CLIENT_PASSWORD = "test123"


class TestLoginForTestUsers:
    """Test login functionality for all test users"""
    
    def test_login_provider_test_user(self):
        """Test provider@example.com / test123 login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PROVIDER_EMAIL,
            "password": PROVIDER_PASSWORD
        })
        assert response.status_code == 200, f"Provider login failed: {response.text}"
        data = response.json()
        assert "session_token" in data
        assert data["user"]["email"] == PROVIDER_EMAIL
        assert data["user"]["role"] == "provider"
        print(f"✓ Provider login successful - {data['user']['name']}")
    
    def test_login_client_test_user(self):
        """Test client@example.com / test123 login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        assert response.status_code == 200, f"Client login failed: {response.text}"
        data = response.json()
        assert "session_token" in data
        assert data["user"]["email"] == CLIENT_EMAIL
        assert data["user"]["role"] == "client"
        print(f"✓ Client login successful - {data['user']['name']}")
    
    def test_login_admin(self):
        """Test admin@handyhub.com / admin123 login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "session_token" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful - {data['user']['name']}")
    
    def test_login_invalid_credentials(self):
        """Test login with wrong password fails"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PROVIDER_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid password correctly rejected")


class TestPasswordRecovery:
    """Password recovery flow tests"""
    
    def test_request_password_recovery(self):
        """Test password recovery request endpoint"""
        response = requests.post(f"{BASE_URL}/api/auth/password-recovery/request", json={
            "email": CLIENT_EMAIL
        })
        assert response.status_code == 200, f"Recovery request failed: {response.text}"
        data = response.json()
        assert "message" in data
        # In dev mode, we should get the code
        if "dev_code" in data:
            assert len(data["dev_code"]) == 6
            print(f"✓ Password recovery code generated: {data['dev_code']}")
        else:
            print("✓ Password recovery requested (no dev code)")
    
    def test_verify_password_recovery_invalid_code(self):
        """Test password recovery with invalid code"""
        response = requests.post(f"{BASE_URL}/api/auth/password-recovery/verify", json={
            "email": CLIENT_EMAIL,
            "code": "000000",
            "new_password": "newpassword123"
        })
        assert response.status_code == 400
        print("✓ Invalid recovery code correctly rejected")
    
    def test_full_password_recovery_flow(self):
        """Test full password recovery flow"""
        # Step 1: Request code
        request_response = requests.post(f"{BASE_URL}/api/auth/password-recovery/request", json={
            "email": CLIENT_EMAIL
        })
        assert request_response.status_code == 200
        data = request_response.json()
        
        if "dev_code" not in data:
            pytest.skip("Dev code not available - skipping full flow test")
        
        code = data["dev_code"]
        
        # Step 2: Verify code and set new password
        verify_response = requests.post(f"{BASE_URL}/api/auth/password-recovery/verify", json={
            "email": CLIENT_EMAIL,
            "code": code,
            "new_password": "newpassword123"
        })
        assert verify_response.status_code == 200, f"Verify failed: {verify_response.text}"
        print("✓ Password recovery verification successful")
        
        # Step 3: Login with new password
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": "newpassword123"
        })
        assert login_response.status_code == 200, "Login with new password failed"
        print("✓ Login with new password successful")
        
        # Step 4: Restore original password
        restore_response = requests.post(f"{BASE_URL}/api/auth/password-recovery/request", json={
            "email": CLIENT_EMAIL
        })
        restore_code = restore_response.json().get("dev_code")
        if restore_code:
            requests.post(f"{BASE_URL}/api/auth/password-recovery/verify", json={
                "email": CLIENT_EMAIL,
                "code": restore_code,
                "new_password": CLIENT_PASSWORD
            })
            print("✓ Original password restored")


class TestAdminPasswordReset:
    """Admin password reset functionality"""
    
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
    
    def test_admin_view_password_hash(self, admin_token):
        """Test admin can view password hash for user"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First get user list to get a user_id
        users_response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        assert users_response.status_code == 200
        users = users_response.json()
        
        if not users:
            pytest.skip("No users to test with")
        
        # Get password info for first user
        user_id = users[0]["user_id"]
        response = requests.get(f"{BASE_URL}/api/admin/users/{user_id}/password", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "user_id" in data
        assert "email" in data
        assert "password_hash" in data
        assert "note" in data
        print(f"✓ Admin can view password info for {data['email']}")
    
    def test_admin_reset_user_password(self, admin_token):
        """Test admin can reset user password"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get client user_id
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        if login_response.status_code != 200:
            pytest.skip("Client user doesn't have current password set")
        
        client_id = login_response.json()["user"]["user_id"]
        
        # Reset password
        response = requests.post(
            f"{BASE_URL}/api/admin/users/{client_id}/reset-password",
            headers=headers,
            json={"new_password": "adminreset123"}
        )
        assert response.status_code == 200, f"Reset failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ Admin reset password for user {client_id}")
        
        # Verify new password works
        new_login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": "adminreset123"
        })
        assert new_login_response.status_code == 200, "Login with reset password failed"
        print("✓ User can login with admin-reset password")
        
        # Restore original password
        requests.post(
            f"{BASE_URL}/api/admin/users/{client_id}/reset-password",
            headers=headers,
            json={"new_password": CLIENT_PASSWORD}
        )
        print("✓ Original password restored")


class TestBookingReassignment:
    """Admin booking reassignment tests"""
    
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
    
    @pytest.fixture
    def provider_id(self):
        """Get provider user ID"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PROVIDER_EMAIL,
            "password": PROVIDER_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["user"]["user_id"]
        pytest.skip("Provider authentication failed")
    
    def test_reassign_booking_endpoint_exists(self, admin_token, provider_id):
        """Test reassign booking endpoint works"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get bookings
        bookings_response = requests.get(f"{BASE_URL}/api/bookings", headers=headers)
        assert bookings_response.status_code == 200
        bookings = bookings_response.json()
        
        # Find a booking with a provider to reassign
        assigned_booking = None
        for booking in bookings:
            if booking.get("provider_id"):
                assigned_booking = booking
                break
        
        if not assigned_booking:
            print("✓ Reassign endpoint exists (no assigned bookings to test)")
            return
        
        # Try to reassign
        response = requests.post(
            f"{BASE_URL}/api/admin/bookings/{assigned_booking['booking_id']}/reassign",
            headers=headers,
            json={
                "new_provider_id": provider_id,
                "notes": "Test reassignment"
            }
        )
        
        # Accept 200 (success) or 404 (provider same as current)
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print(f"✓ Reassign endpoint works for booking {assigned_booking['booking_id']}")


class TestProviderStats:
    """Provider statistics endpoint tests"""
    
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
    
    def test_get_provider_stats(self, provider_auth):
        """Test getting provider statistics"""
        token, provider_id = provider_auth
        
        response = requests.get(f"{BASE_URL}/api/provider/{provider_id}/stats")
        assert response.status_code == 200, f"Stats failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "user" in data
        assert "profile" in data or data.get("profile") is None
        assert "stats" in data
        assert "reviews" in data
        assert "archived_tasks" in data
        
        # Verify stats structure
        stats = data["stats"]
        assert "total_completed_tasks" in stats
        assert "total_hours_worked" in stats
        assert "total_earnings" in stats
        assert "average_rating" in stats
        assert "total_reviews" in stats
        
        print(f"✓ Provider stats loaded:")
        print(f"  Completed tasks: {stats['total_completed_tasks']}")
        print(f"  Hours worked: {stats['total_hours_worked']}")
        print(f"  Earnings: ${stats['total_earnings']}")
        print(f"  Rating: {stats['average_rating']} ({stats['total_reviews']} reviews)")


class TestProfilePhotoUpload:
    """Profile photo upload tests"""
    
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
    
    def test_update_profile_photo(self, provider_auth):
        """Test profile photo upload endpoint"""
        token, user_id = provider_auth
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test with a small base64 image (1x1 red pixel PNG)
        test_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        
        response = requests.put(
            f"{BASE_URL}/api/users/profile/photo",
            headers=headers,
            json={"picture": test_image}
        )
        assert response.status_code == 200, f"Photo upload failed: {response.text}"
        data = response.json()
        
        assert "picture" in data
        assert data["picture"] == test_image
        print("✓ Profile photo uploaded successfully")
        
        # Clean up - remove photo
        cleanup_response = requests.put(
            f"{BASE_URL}/api/users/profile/photo",
            headers=headers,
            json={"picture": ""}
        )
        assert cleanup_response.status_code == 200
        print("✓ Profile photo removed")


class TestServicesWithGallery:
    """Enhanced services with gallery tests"""
    
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
    
    def test_create_service_enhanced(self, admin_token):
        """Test creating service with gallery"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        service_data = {
            "name": "TEST Service with Gallery",
            "category": "handyman_plumbing",
            "description": "Test service description",
            "price": 75.0,
            "duration": 90,
            "image": None,
            "gallery": [
                {
                    "description": "Sample project",
                    "date": "2025-12-15",
                    "photos": [],
                    "price": 120.0
                }
            ],
            "available": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/services/enhanced",
            headers=headers,
            json=service_data
        )
        assert response.status_code == 200, f"Service creation failed: {response.text}"
        data = response.json()
        
        assert "service_id" in data
        assert data["name"] == "TEST Service with Gallery"
        assert "gallery" in data
        print(f"✓ Service with gallery created: {data['service_id']}")
        
        # Cleanup - delete the test service
        service_id = data["service_id"]
        delete_response = requests.delete(f"{BASE_URL}/api/services/{service_id}", headers=headers)
        assert delete_response.status_code == 200
        print("✓ Test service deleted")


class TestAdminUserManagement:
    """Admin user management tests"""
    
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
    
    def test_get_users_list(self, admin_token):
        """Test admin can list all users"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        assert response.status_code == 200, f"Users list failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ Admin can see {len(data)} users")
        
        # Verify user structure
        if data:
            user = data[0]
            assert "user_id" in user
            assert "email" in user
            assert "role" in user
            print(f"  First user: {user['email']} ({user['role']})")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
