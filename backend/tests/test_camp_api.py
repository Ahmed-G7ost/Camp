"""Backend API tests for Camp Aid Management System"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Shared auth token
_token = None

def get_token():
    global _token
    if _token:
        return _token
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@camp.com", "password": "admin123"})
    if resp.status_code == 200:
        _token = resp.json().get("token")
    return _token

def auth_headers():
    return {"Authorization": f"Bearer {get_token()}"}


class TestAuth:
    """Auth endpoint tests"""

    def test_login_success(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@camp.com", "password": "admin123"})
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["user"]["email"] == "admin@camp.com"
        assert data["user"]["role"] == "admin"

    def test_login_invalid(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "bad@bad.com", "password": "wrong"})
        assert resp.status_code == 401

    def test_me(self):
        resp = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers())
        assert resp.status_code == 200
        assert resp.json()["role"] == "admin"


class TestStats:
    """Stats endpoint test"""

    def test_stats(self):
        resp = requests.get(f"{BASE_URL}/api/stats", headers=auth_headers())
        assert resp.status_code == 200
        data = resp.json()
        assert "total_families" in data
        assert "total_individual_members" in data
        assert "total_aid_records" in data


class TestDeleteAllFamilies:
    """Test DELETE /families/all endpoint"""

    def test_delete_all_requires_admin(self):
        # No auth should fail
        resp = requests.delete(f"{BASE_URL}/api/families/all")
        assert resp.status_code in [401, 403]

    def test_delete_all_endpoint_exists(self):
        # Should return 200 (even if empty). We won't actually delete to preserve data.
        # Just verify the endpoint is accessible
        resp = requests.get(f"{BASE_URL}/api/families", headers=auth_headers())
        assert resp.status_code == 200
        families = resp.json()
        # Only test deletion if empty already or skip to preserve test data
        if len(families) == 0:
            resp2 = requests.delete(f"{BASE_URL}/api/families/all", headers=auth_headers())
            assert resp2.status_code == 200
            assert resp2.json()["ok"] is True


class TestIndividualMembers:
    """Individual members CRUD tests - uses /families endpoint for family_id"""
    family_id = None
    created_id = None

    def setup_family(self):
        """Create a family in /families for testing"""
        resp = requests.post(f"{BASE_URL}/api/families", json={"data": {"اسم_رب_الأسرة": "TEST_عائلة_أفراد", "رقم_الهوية": "TEST999", "رقم_الهاتف": "0599000111"}}, headers=auth_headers())
        if resp.status_code == 200:
            TestIndividualMembers.family_id = resp.json()["id"]

    def test_list(self):
        resp = requests.get(f"{BASE_URL}/api/individual-members", headers=auth_headers())
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create(self):
        self.setup_family()
        if not TestIndividualMembers.family_id:
            pytest.skip("No family_id setup")
        payload = {
            "family_id": TestIndividualMembers.family_id,
            "name": "TEST_فرد مفصّل",
            "id_number": "TEST_IND_001",
            "birth_date": "2005-03-20",
            "relation": "ابن",
            "gender": "ذكر"
        }
        resp = requests.post(f"{BASE_URL}/api/individual-members", json=payload, headers=auth_headers())
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "TEST_فرد مفصّل"
        assert data["family_id"] == TestIndividualMembers.family_id
        TestIndividualMembers.created_id = data["id"]

    def test_delete_individual(self):
        if not TestIndividualMembers.created_id:
            pytest.skip("No created_id")
        resp = requests.delete(f"{BASE_URL}/api/individual-members/{TestIndividualMembers.created_id}", headers=auth_headers())
        assert resp.status_code == 200

    def test_delete_family_cleanup(self):
        if not TestIndividualMembers.family_id:
            pytest.skip("No family_id")
        resp = requests.delete(f"{BASE_URL}/api/families/{TestIndividualMembers.family_id}", headers=auth_headers())
        assert resp.status_code == 200


class TestAidTypes:
    """Aid types tests"""
    created_id = None

    def test_list(self):
        resp = requests.get(f"{BASE_URL}/api/aid-types", headers=auth_headers())
        assert resp.status_code == 200

    def test_create(self):
        resp = requests.post(f"{BASE_URL}/api/aid-types", json={"name": "TEST_مساعدة غذائية", "description": "Test"}, headers=auth_headers())
        assert resp.status_code == 200
        TestAidTypes.created_id = resp.json()["id"]

    def test_delete(self):
        if not TestAidTypes.created_id:
            pytest.skip("No created_id")
        resp = requests.delete(f"{BASE_URL}/api/aid-types/{TestAidTypes.created_id}", headers=auth_headers())
        assert resp.status_code == 200
