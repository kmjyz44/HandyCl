"""
Backend API tests for Language & Payment Settings Features
Tests: Multi-language support, Payment methods (Stripe, Zelle, Venmo), Firebase push notifications
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestPublicSettingsAPI:
    """Test the public settings endpoint GET /api/settings/public"""
    
    def test_get_public_settings_no_auth_required(self):
        """Public settings should be accessible without authentication"""
        response = requests.get(f"{BASE_URL}/api/settings/public")
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields exist
        assert 'default_language' in data
        assert 'available_languages' in data
        assert 'enable_geolocation_language' in data
        assert 'payment_methods' in data
        assert 'push_notifications_enabled' in data
    
    def test_public_settings_language_fields(self):
        """Public settings should return language configuration"""
        response = requests.get(f"{BASE_URL}/api/settings/public")
        data = response.json()
        
        # Verify language settings
        assert data['default_language'] in ['en', 'es', 'uk']
        assert isinstance(data['available_languages'], list)
        assert len(data['available_languages']) > 0
        assert isinstance(data['enable_geolocation_language'], bool)
    
    def test_public_settings_payment_methods(self):
        """Public settings should return payment method configuration"""
        response = requests.get(f"{BASE_URL}/api/settings/public")
        data = response.json()
        
        # Verify payment methods structure
        assert 'payment_methods' in data
        payment_methods = data['payment_methods']
        assert 'stripe' in payment_methods
        assert 'zelle' in payment_methods
        assert 'venmo' in payment_methods
        
        # Each should be boolean
        assert isinstance(payment_methods['stripe'], bool)
        assert isinstance(payment_methods['zelle'], bool)
        assert isinstance(payment_methods['venmo'], bool)
    
    def test_public_settings_zelle_instructions_when_enabled(self):
        """Zelle instructions should be returned when Zelle is enabled"""
        response = requests.get(f"{BASE_URL}/api/settings/public")
        data = response.json()
        
        # If Zelle is enabled, instructions should be present (even if null)
        assert 'zelle_instructions' in data
        
    def test_public_settings_venmo_instructions_when_enabled(self):
        """Venmo instructions should be returned when Venmo is enabled"""
        response = requests.get(f"{BASE_URL}/api/settings/public")
        data = response.json()
        
        # If Venmo is enabled, instructions should be present (even if null)
        assert 'venmo_instructions' in data


class TestAdminSettingsAPI:
    """Test admin settings endpoints"""
    
    @pytest.fixture
    def admin_session(self):
        """Login as admin and return session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@handyhub.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json().get('session_token')
    
    def test_get_admin_settings_requires_auth(self):
        """Admin settings should require authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/settings")
        assert response.status_code == 401
    
    def test_get_admin_settings_with_auth(self, admin_session):
        """Admin settings should be accessible with valid token"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        response = requests.get(f"{BASE_URL}/api/admin/settings", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'setting_id' in data
    
    def test_update_settings_requires_auth(self):
        """Update settings should require authentication"""
        response = requests.put(f"{BASE_URL}/api/settings", json={
            "default_language": "en"
        })
        assert response.status_code == 401
    
    def test_update_language_settings(self, admin_session):
        """Admin should be able to update language settings"""
        headers = {
            "Authorization": f"Bearer {admin_session}",
            "Content-Type": "application/json"
        }
        
        # Update language settings
        test_data = {
            "default_language": "es",
            "available_languages": ["en", "es"],
            "enable_geolocation_language": True
        }
        
        response = requests.put(f"{BASE_URL}/api/settings", 
                                json=test_data, headers=headers)
        assert response.status_code == 200
        
        # Verify changes persisted
        public_response = requests.get(f"{BASE_URL}/api/settings/public")
        public_data = public_response.json()
        assert public_data['default_language'] == "es"
        assert public_data['enable_geolocation_language'] == True
        
        # Reset to default
        reset_data = {
            "default_language": "en",
            "available_languages": ["en", "es", "uk"],
            "enable_geolocation_language": False
        }
        requests.put(f"{BASE_URL}/api/settings", json=reset_data, headers=headers)
    
    def test_update_payment_methods_stripe(self, admin_session):
        """Admin should be able to enable/disable Stripe"""
        headers = {
            "Authorization": f"Bearer {admin_session}",
            "Content-Type": "application/json"
        }
        
        # Enable Stripe with keys
        test_data = {
            "payment_methods_enabled": {"stripe": True, "zelle": False, "venmo": False},
            "stripe_public_key": "pk_test_12345",
            "stripe_secret_key": "sk_test_12345"
        }
        
        response = requests.put(f"{BASE_URL}/api/settings", 
                                json=test_data, headers=headers)
        assert response.status_code == 200
        
        # Verify Stripe is enabled in public settings
        public_response = requests.get(f"{BASE_URL}/api/settings/public")
        public_data = public_response.json()
        assert public_data['payment_methods']['stripe'] == True
        assert public_data['stripe_public_key'] == "pk_test_12345"
        
        # Reset
        reset_data = {
            "payment_methods_enabled": {"stripe": False, "zelle": True, "venmo": False}
        }
        requests.put(f"{BASE_URL}/api/settings", json=reset_data, headers=headers)
    
    def test_update_payment_methods_zelle(self, admin_session):
        """Admin should be able to enable Zelle with instructions"""
        headers = {
            "Authorization": f"Bearer {admin_session}",
            "Content-Type": "application/json"
        }
        
        # Enable Zelle with instructions
        test_instructions = f"TEST_ZELLE_{uuid.uuid4().hex[:8]}: Send payment to test@zelle.com"
        test_data = {
            "payment_methods_enabled": {"stripe": False, "zelle": True, "venmo": False},
            "zelle_instructions": test_instructions
        }
        
        response = requests.put(f"{BASE_URL}/api/settings", 
                                json=test_data, headers=headers)
        assert response.status_code == 200
        
        # Verify Zelle is enabled and instructions are saved
        public_response = requests.get(f"{BASE_URL}/api/settings/public")
        public_data = public_response.json()
        assert public_data['payment_methods']['zelle'] == True
        assert public_data['zelle_instructions'] == test_instructions
    
    def test_update_payment_methods_venmo(self, admin_session):
        """Admin should be able to enable Venmo with instructions"""
        headers = {
            "Authorization": f"Bearer {admin_session}",
            "Content-Type": "application/json"
        }
        
        # Enable Venmo with instructions
        test_instructions = f"TEST_VENMO_{uuid.uuid4().hex[:8]}: @testvenmo"
        test_data = {
            "payment_methods_enabled": {"stripe": False, "zelle": False, "venmo": True},
            "venmo_instructions": test_instructions
        }
        
        response = requests.put(f"{BASE_URL}/api/settings", 
                                json=test_data, headers=headers)
        assert response.status_code == 200
        
        # Verify Venmo is enabled
        public_response = requests.get(f"{BASE_URL}/api/settings/public")
        public_data = public_response.json()
        assert public_data['payment_methods']['venmo'] == True
        assert public_data['venmo_instructions'] == test_instructions
        
        # Reset
        reset_data = {
            "payment_methods_enabled": {"stripe": False, "zelle": True, "venmo": False}
        }
        requests.put(f"{BASE_URL}/api/settings", json=reset_data, headers=headers)
    
    def test_update_firebase_settings(self, admin_session):
        """Admin should be able to update Firebase push notification settings"""
        headers = {
            "Authorization": f"Bearer {admin_session}",
            "Content-Type": "application/json"
        }
        
        # Enable push notifications with Firebase settings
        test_data = {
            "send_push_notifications": True,
            "firebase_project_id": "test-project-123",
            "firebase_server_key": "AAAA_test_key_12345"
        }
        
        response = requests.put(f"{BASE_URL}/api/settings", 
                                json=test_data, headers=headers)
        assert response.status_code == 200
        
        # Verify push notifications enabled in public settings
        public_response = requests.get(f"{BASE_URL}/api/settings/public")
        public_data = public_response.json()
        assert public_data['push_notifications_enabled'] == True
        
        # Note: Firebase keys should NOT be exposed in public settings
        assert 'firebase_server_key' not in public_data
        
        # Reset
        reset_data = {"send_push_notifications": False}
        requests.put(f"{BASE_URL}/api/settings", json=reset_data, headers=headers)
    
    def test_update_all_settings_combined(self, admin_session):
        """Admin should be able to update all settings in one request"""
        headers = {
            "Authorization": f"Bearer {admin_session}",
            "Content-Type": "application/json"
        }
        
        # Update all settings at once
        test_data = {
            "default_language": "uk",
            "available_languages": ["en", "uk"],
            "enable_geolocation_language": False,
            "payment_methods_enabled": {"stripe": True, "zelle": True, "venmo": False},
            "stripe_public_key": "pk_combined_test",
            "zelle_instructions": "Combined test instructions",
            "send_push_notifications": True,
            "firebase_project_id": "combined-test-project"
        }
        
        response = requests.put(f"{BASE_URL}/api/settings", 
                                json=test_data, headers=headers)
        assert response.status_code == 200
        
        # Verify all changes persisted
        public_response = requests.get(f"{BASE_URL}/api/settings/public")
        public_data = public_response.json()
        
        assert public_data['default_language'] == "uk"
        assert "en" in public_data['available_languages']
        assert "uk" in public_data['available_languages']
        assert public_data['payment_methods']['stripe'] == True
        assert public_data['payment_methods']['zelle'] == True
        assert public_data['payment_methods']['venmo'] == False
        assert public_data['push_notifications_enabled'] == True
        
        # Reset to defaults
        reset_data = {
            "default_language": "en",
            "available_languages": ["en", "es", "uk"],
            "enable_geolocation_language": False,
            "payment_methods_enabled": {"stripe": False, "zelle": True, "venmo": False},
            "send_push_notifications": False
        }
        requests.put(f"{BASE_URL}/api/settings", json=reset_data, headers=headers)


class TestSettingsValidation:
    """Test settings validation and edge cases"""
    
    @pytest.fixture
    def admin_session(self):
        """Login as admin and return session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@handyhub.com",
            "password": "admin123"
        })
        return response.json().get('session_token')
    
    def test_invalid_language_code_handled(self, admin_session):
        """Invalid language codes should be handled gracefully"""
        headers = {
            "Authorization": f"Bearer {admin_session}",
            "Content-Type": "application/json"
        }
        
        # Try setting an invalid language
        test_data = {
            "default_language": "invalid_lang"
        }
        
        response = requests.put(f"{BASE_URL}/api/settings", 
                                json=test_data, headers=headers)
        # Should accept (frontend will handle validation)
        assert response.status_code == 200
        
        # Reset
        reset_data = {"default_language": "en"}
        requests.put(f"{BASE_URL}/api/settings", json=reset_data, headers=headers)
    
    def test_empty_available_languages_allowed(self, admin_session):
        """Empty available languages list should be prevented by frontend"""
        headers = {
            "Authorization": f"Bearer {admin_session}",
            "Content-Type": "application/json"
        }
        
        # Backend accepts but frontend prevents this
        test_data = {
            "available_languages": []
        }
        
        response = requests.put(f"{BASE_URL}/api/settings", 
                                json=test_data, headers=headers)
        # Backend accepts the update
        assert response.status_code == 200
        
        # Reset
        reset_data = {"available_languages": ["en", "es", "uk"]}
        requests.put(f"{BASE_URL}/api/settings", json=reset_data, headers=headers)
