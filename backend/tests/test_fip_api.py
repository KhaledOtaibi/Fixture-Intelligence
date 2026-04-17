"""
Fixture Intelligence Platform - Backend API Tests
Tests: Auth, Recaps CRUD, Approvals, Comments, Stats, Seed, Role-based access
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data prefixes for cleanup
TEST_PREFIX = "TEST_"

class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_api_root(self):
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "Fixture Intelligence Platform"
        assert data["status"] == "ok"
        print("✓ Health check passed")


class TestAuth:
    """Authentication endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.test_email = f"test_{uuid.uuid4().hex[:8]}@test.com"
        self.test_password = "testpass123"
        self.test_name = f"{TEST_PREFIX}User"
    
    def test_register_chartering_user(self):
        """Register a new chartering user"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": self.test_password,
            "name": self.test_name,
            "role": "chartering"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == self.test_email.lower()
        assert data["user"]["role"] == "chartering"
        assert "id" not in data or "_id" not in str(data)  # No MongoDB _id leak
        print(f"✓ Registered chartering user: {self.test_email}")
    
    def test_register_operations_user(self):
        """Register a new operations user"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": self.test_password,
            "name": self.test_name,
            "role": "operations"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "operations"
        print(f"✓ Registered operations user: {self.test_email}")
    
    def test_register_legal_user(self):
        """Register a new legal user"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": self.test_password,
            "name": self.test_name,
            "role": "legal"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "legal"
        print(f"✓ Registered legal user: {self.test_email}")
    
    def test_register_duplicate_email(self):
        """Duplicate email should fail"""
        # First registration
        requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": self.test_password,
            "name": self.test_name,
            "role": "chartering"
        })
        # Second registration with same email
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": "different123",
            "name": "Different Name",
            "role": "operations"
        })
        assert response.status_code == 400
        assert "already registered" in response.json().get("detail", "").lower()
        print("✓ Duplicate email registration rejected")
    
    def test_login_success(self):
        """Login with valid credentials"""
        # Register first
        requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": self.test_password,
            "name": self.test_name,
            "role": "chartering"
        })
        # Login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.test_email,
            "password": self.test_password
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["email"] == self.test_email.lower()
        print("✓ Login successful")
    
    def test_login_invalid_credentials(self):
        """Login with invalid credentials should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print("✓ Invalid login rejected with 401")
    
    def test_me_endpoint(self):
        """Get current user info"""
        # Register and get token
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": self.test_password,
            "name": self.test_name,
            "role": "chartering"
        })
        token = reg_response.json()["token"]
        
        # Get /me
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == self.test_email.lower()
        assert "_id" not in str(data)  # No MongoDB _id leak
        print("✓ /me endpoint works")
    
    def test_unauthorized_without_token(self):
        """Endpoints should return 401 without token"""
        response = requests.get(f"{BASE_URL}/api/recaps")
        assert response.status_code in [401, 403]
        print("✓ Unauthorized access rejected")


class TestAdminLogin:
    """Test admin login with known credentials"""
    
    def test_admin_login(self):
        """Login with admin credentials from test_credentials.md"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@fip.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "admin"
        print("✓ Admin login successful")
        return data["token"]


class TestRecapsCRUD:
    """Recap CRUD operations tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        # Try admin login first
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@fip.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["token"]
        
        # Register new user if admin doesn't exist
        email = f"test_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "testpass123",
            "name": f"{TEST_PREFIX}User",
            "role": "admin"
        })
        return response.json()["token"]
    
    def test_create_recap(self, auth_token):
        """Create a new recap"""
        response = requests.post(f"{BASE_URL}/api/recaps", 
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "raw_text": "TEST MV OCEAN STAR fixed Shell, 50k mts crude",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}OCEAN STAR",
                    "charterer": "Shell",
                    "cargo_type": "Crude Oil",
                    "cargo_quantity": "50,000 MT",
                    "load_port": "Rotterdam",
                    "discharge_port": "Singapore"
                }
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["vessel_name"] == f"{TEST_PREFIX}OCEAN STAR"
        assert data["status"] == "draft"
        assert len(data["versions"]) == 1
        assert data["versions"][0]["version_label"] == "Rev1"
        assert "_id" not in str(data)  # No MongoDB _id leak
        print(f"✓ Created recap: {data['id']}")
        return data["id"]
    
    def test_list_recaps(self, auth_token):
        """List all recaps"""
        response = requests.get(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} recaps")
    
    def test_filter_recaps_by_status(self, auth_token):
        """Filter recaps by status"""
        response = requests.get(f"{BASE_URL}/api/recaps?status_filter=draft",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        for recap in data:
            assert recap["status"] == "draft"
        print(f"✓ Filtered by status: {len(data)} draft recaps")
    
    def test_filter_recaps_by_vessel(self, auth_token):
        """Filter recaps by vessel name"""
        # Create a recap first
        requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "raw_text": "TEST vessel filter",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}FILTER_VESSEL",
                    "charterer": "TestCo"
                }
            }
        )
        
        response = requests.get(f"{BASE_URL}/api/recaps?vessel=FILTER_VESSEL",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        print(f"✓ Filtered by vessel: {len(data)} recaps")
    
    def test_get_single_recap(self, auth_token):
        """Get a single recap by ID"""
        # Create first
        create_response = requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "raw_text": "TEST single get",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}GET_TEST",
                    "charterer": "TestCo"
                }
            }
        )
        recap_id = create_response.json()["id"]
        
        # Get
        response = requests.get(f"{BASE_URL}/api/recaps/{recap_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == recap_id
        assert "_id" not in str(data)
        print(f"✓ Got single recap: {recap_id}")
    
    def test_patch_creates_new_version(self, auth_token):
        """PATCH should create a new version"""
        # Create
        create_response = requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "raw_text": "TEST version test",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}VERSION_TEST",
                    "charterer": "OriginalCo",
                    "freight": "WS 100"
                }
            }
        )
        recap_id = create_response.json()["id"]
        
        # Patch with new structured data
        patch_response = requests.patch(f"{BASE_URL}/api/recaps/{recap_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}VERSION_TEST",
                    "charterer": "UpdatedCo",
                    "freight": "WS 150"
                },
                "note": "Freight revised"
            }
        )
        assert patch_response.status_code == 200
        data = patch_response.json()
        assert len(data["versions"]) == 2
        assert data["versions"][1]["version_label"] == "Rev2"
        assert data["charterer"] == "UpdatedCo"
        print(f"✓ PATCH created Rev2 for recap: {recap_id}")
    
    def test_get_nonexistent_recap(self, auth_token):
        """Get nonexistent recap should return 404"""
        response = requests.get(f"{BASE_URL}/api/recaps/nonexistent-id",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404
        print("✓ Nonexistent recap returns 404")


class TestApprovalWorkflow:
    """Approval workflow tests: submit → approve → fix, reject path"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@fip.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["token"]
        # Register admin if not exists
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "admin@fip.com",
            "password": "admin123",
            "name": "Admin User",
            "role": "admin"
        })
        return response.json()["token"]
    
    @pytest.fixture
    def chartering_token(self):
        """Get chartering user token"""
        email = f"chartering_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "testpass123",
            "name": f"{TEST_PREFIX}Chartering",
            "role": "chartering"
        })
        return response.json()["token"]
    
    def test_submit_for_review(self, admin_token):
        """Submit draft for review"""
        # Create recap
        create_response = requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "raw_text": "TEST submit workflow",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}SUBMIT_TEST",
                    "charterer": "TestCo"
                }
            }
        )
        recap_id = create_response.json()["id"]
        
        # Submit for review
        response = requests.post(f"{BASE_URL}/api/recaps/{recap_id}/approvals",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"action": "submit"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "submitted"
        
        # Verify status changed
        get_response = requests.get(f"{BASE_URL}/api/recaps/{recap_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert get_response.json()["status"] == "under_review"
        print(f"✓ Submitted recap for review: {recap_id}")
        return recap_id
    
    def test_approve_recap(self, admin_token):
        """Approve a recap under review"""
        # Create and submit
        create_response = requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "raw_text": "TEST approve workflow",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}APPROVE_TEST",
                    "charterer": "TestCo"
                }
            }
        )
        recap_id = create_response.json()["id"]
        
        # Submit
        requests.post(f"{BASE_URL}/api/recaps/{recap_id}/approvals",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"action": "submit"}
        )
        
        # Approve
        response = requests.post(f"{BASE_URL}/api/recaps/{recap_id}/approvals",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"action": "approve", "comment": "Looks good"}
        )
        assert response.status_code == 200
        assert response.json()["action"] == "approved"
        
        # Verify status
        get_response = requests.get(f"{BASE_URL}/api/recaps/{recap_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert get_response.json()["status"] == "approved"
        print(f"✓ Approved recap: {recap_id}")
        return recap_id
    
    def test_reject_recap(self, admin_token):
        """Reject a recap under review"""
        # Create and submit
        create_response = requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "raw_text": "TEST reject workflow",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}REJECT_TEST",
                    "charterer": "TestCo"
                }
            }
        )
        recap_id = create_response.json()["id"]
        
        # Submit
        requests.post(f"{BASE_URL}/api/recaps/{recap_id}/approvals",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"action": "submit"}
        )
        
        # Reject
        response = requests.post(f"{BASE_URL}/api/recaps/{recap_id}/approvals",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"action": "reject", "comment": "Needs revision"}
        )
        assert response.status_code == 200
        assert response.json()["action"] == "rejected"
        
        # Verify status back to draft
        get_response = requests.get(f"{BASE_URL}/api/recaps/{recap_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert get_response.json()["status"] == "draft"
        print(f"✓ Rejected recap: {recap_id}")
    
    def test_mark_as_fixed(self, admin_token):
        """Mark approved recap as fixed"""
        # Create, submit, approve
        create_response = requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "raw_text": "TEST fix workflow",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}FIX_TEST",
                    "charterer": "TestCo"
                }
            }
        )
        recap_id = create_response.json()["id"]
        
        requests.post(f"{BASE_URL}/api/recaps/{recap_id}/approvals",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"action": "submit"}
        )
        requests.post(f"{BASE_URL}/api/recaps/{recap_id}/approvals",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"action": "approve"}
        )
        
        # Mark as fixed
        response = requests.post(f"{BASE_URL}/api/recaps/{recap_id}/approvals",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"action": "fix"}
        )
        assert response.status_code == 200
        assert response.json()["action"] == "fixed"
        
        # Verify status
        get_response = requests.get(f"{BASE_URL}/api/recaps/{recap_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert get_response.json()["status"] == "fixed"
        print(f"✓ Marked recap as fixed: {recap_id}")
    
    def test_chartering_cannot_approve(self, chartering_token):
        """Chartering role should not be able to approve"""
        # Create and submit
        create_response = requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {chartering_token}"},
            json={
                "raw_text": "TEST chartering approve",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}CHARTERING_APPROVE",
                    "charterer": "TestCo"
                }
            }
        )
        recap_id = create_response.json()["id"]
        
        # Submit
        requests.post(f"{BASE_URL}/api/recaps/{recap_id}/approvals",
            headers={"Authorization": f"Bearer {chartering_token}"},
            json={"action": "submit"}
        )
        
        # Try to approve (should fail with 403)
        response = requests.post(f"{BASE_URL}/api/recaps/{recap_id}/approvals",
            headers={"Authorization": f"Bearer {chartering_token}"},
            json={"action": "approve"}
        )
        assert response.status_code == 403
        print("✓ Chartering user correctly denied approval (403)")
    
    def test_list_approvals(self, admin_token):
        """List approvals for a recap"""
        # Create and submit
        create_response = requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "raw_text": "TEST list approvals",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}LIST_APPROVALS",
                    "charterer": "TestCo"
                }
            }
        )
        recap_id = create_response.json()["id"]
        
        requests.post(f"{BASE_URL}/api/recaps/{recap_id}/approvals",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"action": "submit"}
        )
        
        # List approvals
        response = requests.get(f"{BASE_URL}/api/recaps/{recap_id}/approvals",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "_id" not in str(data)
        print(f"✓ Listed {len(data)} approvals")


class TestComments:
    """Comments endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@fip.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["token"]
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "admin@fip.com",
            "password": "admin123",
            "name": "Admin User",
            "role": "admin"
        })
        return response.json()["token"]
    
    def test_create_comment(self, admin_token):
        """Create a comment on a recap"""
        # Create recap
        create_response = requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "raw_text": "TEST comment",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}COMMENT_TEST",
                    "charterer": "TestCo"
                }
            }
        )
        recap_id = create_response.json()["id"]
        
        # Create comment
        response = requests.post(f"{BASE_URL}/api/recaps/{recap_id}/comments",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"text": "This is a test comment"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["text"] == "This is a test comment"
        assert "_id" not in str(data)
        print(f"✓ Created comment on recap: {recap_id}")
    
    def test_list_comments(self, admin_token):
        """List comments for a recap"""
        # Create recap and comment
        create_response = requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "raw_text": "TEST list comments",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}LIST_COMMENTS",
                    "charterer": "TestCo"
                }
            }
        )
        recap_id = create_response.json()["id"]
        
        requests.post(f"{BASE_URL}/api/recaps/{recap_id}/comments",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"text": "Comment 1"}
        )
        requests.post(f"{BASE_URL}/api/recaps/{recap_id}/comments",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"text": "Comment 2"}
        )
        
        # List
        response = requests.get(f"{BASE_URL}/api/recaps/{recap_id}/comments",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
        print(f"✓ Listed {len(data)} comments")


class TestStats:
    """Stats endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@fip.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["token"]
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "admin@fip.com",
            "password": "admin123",
            "name": "Admin User",
            "role": "admin"
        })
        return response.json()["token"]
    
    def test_get_stats(self, admin_token):
        """Get dashboard stats"""
        response = requests.get(f"{BASE_URL}/api/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "by_status" in data
        assert "draft" in data["by_status"]
        assert "under_review" in data["by_status"]
        assert "approved" in data["by_status"]
        assert "fixed" in data["by_status"]
        print(f"✓ Stats: total={data['total']}, by_status={data['by_status']}")


class TestSeed:
    """Seed endpoint tests (admin only)"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@fip.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["token"]
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "admin@fip.com",
            "password": "admin123",
            "name": "Admin User",
            "role": "admin"
        })
        return response.json()["token"]
    
    @pytest.fixture
    def chartering_token(self):
        email = f"chartering_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "testpass123",
            "name": f"{TEST_PREFIX}Chartering",
            "role": "chartering"
        })
        return response.json()["token"]
    
    def test_seed_as_admin(self, admin_token):
        """Admin can seed demo data"""
        response = requests.post(f"{BASE_URL}/api/seed",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "seeded" in data
        assert data["seeded"] == 5
        print(f"✓ Seeded {data['seeded']} demo recaps")
    
    def test_seed_as_chartering_forbidden(self, chartering_token):
        """Non-admin cannot seed"""
        response = requests.post(f"{BASE_URL}/api/seed",
            headers={"Authorization": f"Bearer {chartering_token}"}
        )
        assert response.status_code == 403
        print("✓ Chartering user correctly denied seed (403)")


class TestAIParser:
    """AI Parser endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@fip.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["token"]
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "admin@fip.com",
            "password": "admin123",
            "name": "Admin User",
            "role": "admin"
        })
        return response.json()["token"]
    
    def test_parse_broker_text(self, admin_token):
        """Parse broker text with AI"""
        response = requests.post(f"{BASE_URL}/api/parse",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "raw_text": "MV SEA LION fixed BP, 80k mts crude oil, WS 145, laycan 10-12 Apr, Rotterdam/Houston"
            }
        )
        assert response.status_code == 200
        data = response.json()
        # Check that some fields are parsed
        assert "vessel_name" in data
        assert "charterer" in data
        print(f"✓ AI parsed: vessel={data.get('vessel_name')}, charterer={data.get('charterer')}")
    
    def test_parse_empty_text(self, admin_token):
        """Empty text should fail"""
        response = requests.post(f"{BASE_URL}/api/parse",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"raw_text": ""}
        )
        assert response.status_code == 400
        print("✓ Empty text parse rejected with 400")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
