"""
Test Notifications and Conversations API - P0 Features
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def admin_token():
    """Login as admin and get token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@handyhub.com",
        "password": "admin123"
    })
    assert response.status_code == 200
    return response.json()["session_token"]

@pytest.fixture(scope="module")
def provider_token():
    """Login as provider and get token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "provider.test@handyhub.com",
        "password": "test123"
    })
    assert response.status_code == 200
    return response.json()["session_token"]

@pytest.fixture(scope="module")
def client_token():
    """Login as client and get token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@example.com",
        "password": "test123"
    })
    assert response.status_code == 200
    return response.json()["session_token"]


class TestNotificationsAPI:
    """Test Notifications API endpoints"""
    
    def test_get_notifications_as_admin(self, admin_token):
        """GET /api/notifications returns notifications list"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_get_notifications_as_provider(self, provider_token):
        """Provider can get notifications"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {provider_token}"}
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_get_notifications_as_client(self, client_token):
        """Client can get notifications"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_get_unread_count_as_admin(self, admin_token):
        """GET /api/notifications/unread-count returns count"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "unread_count" in data
        assert isinstance(data["unread_count"], int)
        assert data["unread_count"] >= 0
    
    def test_get_unread_count_as_provider(self, provider_token):
        """Provider can get unread count"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {provider_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "unread_count" in data
    
    def test_get_unread_count_as_client(self, client_token):
        """Client can get unread count"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "unread_count" in data
    
    def test_mark_all_read(self, admin_token):
        """PUT /api/notifications/read-all marks all as read"""
        response = requests.put(
            f"{BASE_URL}/api/notifications/read-all",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        assert "message" in response.json()
    
    def test_notifications_require_auth(self):
        """Notifications endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/notifications")
        assert response.status_code in [401, 403]


class TestConversationsAPI:
    """Test Conversations/Chat API endpoints"""
    
    def test_get_conversations_as_admin(self, admin_token):
        """GET /api/conversations returns conversations list"""
        response = requests.get(
            f"{BASE_URL}/api/conversations",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_get_conversations_as_provider(self, provider_token):
        """Provider can get conversations"""
        response = requests.get(
            f"{BASE_URL}/api/conversations",
            headers={"Authorization": f"Bearer {provider_token}"}
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_get_conversations_as_client(self, client_token):
        """Client can get conversations"""
        response = requests.get(
            f"{BASE_URL}/api/conversations",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_conversations_require_auth(self):
        """Conversations endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/conversations")
        assert response.status_code in [401, 403]


class TestMessagesAPI:
    """Test Messages API endpoints"""
    
    def test_get_messages_as_admin(self, admin_token):
        """GET /api/messages returns messages"""
        response = requests.get(
            f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
    
    def test_messages_require_auth(self):
        """Messages endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/messages")
        assert response.status_code in [401, 403]


class TestUserCredentials:
    """Test all user credentials work correctly"""
    
    def test_admin_login(self):
        """Admin can login with provided credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@handyhub.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "admin"
        assert "session_token" in data
    
    def test_provider_login(self):
        """Provider can login with provided credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "provider.test@handyhub.com",
            "password": "test123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "provider"
        assert "session_token" in data
    
    def test_client_login(self):
        """Client can login with provided credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "test123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "client"
        assert "session_token" in data
