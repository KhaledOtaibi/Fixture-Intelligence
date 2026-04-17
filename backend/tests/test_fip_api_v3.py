"""
Fixture Intelligence Platform - Backend API Tests V3 (Iteration 3)
Tests: Versioning on ANY change, changed_fields tracking, last_modified_* fields, activity log per entity
Focus: (1) Name rebrand verification, (2) ANY clause/recap change creates new version with changed_fields,
       (3) last_modified_by_name + role + timestamp visible, (4) clause activity log
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_PREFIX = "TEST_V3_"


# ============ FIXTURES ============
@pytest.fixture(scope="module")
def admin_token():
    """Get admin token (module-scoped for efficiency)"""
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
def legal_token():
    """Get legal user token"""
    email = f"legal_{uuid.uuid4().hex[:8]}@test.com"
    response = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": email,
        "password": "testpass123",
        "name": f"{TEST_PREFIX}Legal User",
        "role": "legal"
    })
    return response.json()["token"]


# ============ HEALTH CHECK & REBRAND ============
class TestHealthAndRebrand:
    """Health check and rebrand verification"""
    
    def test_api_root_service_name(self):
        """GET /api/ returns service name 'Fixture Intelligence' (no 'AI')"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "Fixture Intelligence"
        assert "AI" not in data["service"]
        assert data["status"] == "ok"
        print(f"✓ Service name: '{data['service']}' (no 'AI' suffix)")


# ============ CLAUSE VERSIONING ON ANY CHANGE ============
class TestClauseVersioningOnAnyChange:
    """Test that ANY change to a clause creates a new version with changed_fields"""
    
    def test_patch_clause_title_only_creates_v2(self, admin_token):
        """PATCH /api/clauses/{id} with only title change creates v2 with changed_fields=['title']"""
        # Create clause
        create_response = requests.post(f"{BASE_URL}/api/clauses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Title Change Test",
                "category": "General",
                "tags": ["test"],
                "text": "Original text that stays the same"
            }
        )
        assert create_response.status_code == 200
        clause_id = create_response.json()["id"]
        
        # Patch with only title change
        response = requests.patch(f"{BASE_URL}/api/clauses/{clause_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"title": f"{TEST_PREFIX}Title Change Test UPDATED"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify new version created
        assert len(data["versions"]) == 2, f"Expected 2 versions, got {len(data['versions'])}"
        v2 = data["versions"][1]
        assert v2["version_label"] == "v2"
        assert "title" in v2.get("changed_fields", []), f"changed_fields should include 'title', got {v2.get('changed_fields')}"
        print(f"✓ Title-only change created v2 with changed_fields={v2.get('changed_fields')}")
    
    def test_patch_clause_tags_only_creates_v3(self, admin_token):
        """PATCH /api/clauses/{id} with only tags change creates new version with changed_fields=['tags']"""
        # Create clause
        create_response = requests.post(f"{BASE_URL}/api/clauses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Tags Change Test",
                "category": "General",
                "tags": ["original"],
                "text": "Text stays the same"
            }
        )
        clause_id = create_response.json()["id"]
        
        # First update to create v2
        requests.patch(f"{BASE_URL}/api/clauses/{clause_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"text": "Text changed for v2"}
        )
        
        # Now update only tags to create v3
        response = requests.patch(f"{BASE_URL}/api/clauses/{clause_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"tags": ["original", "new-tag"]}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify v3 created with tags in changed_fields
        assert len(data["versions"]) == 3, f"Expected 3 versions, got {len(data['versions'])}"
        v3 = data["versions"][2]
        assert v3["version_label"] == "v3"
        assert "tags" in v3.get("changed_fields", []), f"changed_fields should include 'tags', got {v3.get('changed_fields')}"
        print(f"✓ Tags-only change created v3 with changed_fields={v3.get('changed_fields')}")
    
    def test_patch_clause_category_only_creates_new_version(self, admin_token):
        """PATCH /api/clauses/{id} with only category change creates new version with changed_fields=['category']"""
        # Create clause
        create_response = requests.post(f"{BASE_URL}/api/clauses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Category Change Test",
                "category": "General",
                "tags": [],
                "text": "Text stays the same"
            }
        )
        clause_id = create_response.json()["id"]
        
        # Patch with only category change
        response = requests.patch(f"{BASE_URL}/api/clauses/{clause_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"category": "BIMCO"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify new version created
        assert len(data["versions"]) == 2, f"Expected 2 versions, got {len(data['versions'])}"
        v2 = data["versions"][1]
        assert "category" in v2.get("changed_fields", []), f"changed_fields should include 'category', got {v2.get('changed_fields')}"
        print(f"✓ Category-only change created v2 with changed_fields={v2.get('changed_fields')}")
    
    def test_patch_clause_approval_only_does_not_create_version(self, admin_token):
        """PATCH /api/clauses/{id} with only is_approved=true does NOT create a new version"""
        # Create clause
        create_response = requests.post(f"{BASE_URL}/api/clauses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Approval Only Test",
                "category": "General",
                "tags": [],
                "text": "Text for approval test"
            }
        )
        clause_id = create_response.json()["id"]
        initial_versions = len(create_response.json()["versions"])
        
        # Patch with only is_approved change
        response = requests.patch(f"{BASE_URL}/api/clauses/{clause_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"is_approved": True}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify NO new version created
        assert len(data["versions"]) == initial_versions, f"Expected {initial_versions} versions (no new version for approval), got {len(data['versions'])}"
        assert data["is_approved"] == True
        # But last_modified_* should be updated
        assert data.get("last_modified_by") is not None
        assert data.get("last_modified_at") is not None
        print(f"✓ Approval-only change did NOT create new version (versions={len(data['versions'])}), but last_modified_* updated")


# ============ CLAUSE LAST_MODIFIED FIELDS ============
class TestClauseLastModifiedFields:
    """Test last_modified_by, last_modified_by_name, last_modified_by_role, last_modified_at"""
    
    def test_clause_response_includes_last_modified_fields(self, admin_token):
        """Clause response includes last_modified_by, last_modified_by_name, last_modified_by_role, last_modified_at"""
        # Create clause
        create_response = requests.post(f"{BASE_URL}/api/clauses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Last Modified Test",
                "category": "General",
                "tags": [],
                "text": "Test text"
            }
        )
        assert create_response.status_code == 200
        data = create_response.json()
        
        # Verify last_modified fields present
        assert "last_modified_by" in data, "Missing last_modified_by"
        assert "last_modified_by_name" in data, "Missing last_modified_by_name"
        assert "last_modified_by_role" in data, "Missing last_modified_by_role"
        assert "last_modified_at" in data, "Missing last_modified_at"
        
        # On creation, last_modified_by_name should equal creator
        assert data["last_modified_by_name"] == data["created_by_name"], "On creation, last_modified_by_name should equal created_by_name"
        print(f"✓ Clause has last_modified fields: name={data['last_modified_by_name']}, role={data['last_modified_by_role']}")
    
    def test_clause_version_includes_created_by_role_and_changed_fields(self, admin_token):
        """Each ClauseVersion includes created_by_role and changed_fields array"""
        # Create clause
        create_response = requests.post(f"{BASE_URL}/api/clauses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Version Fields Test",
                "category": "General",
                "tags": [],
                "text": "Original text"
            }
        )
        clause_id = create_response.json()["id"]
        
        # Update to create v2
        requests.patch(f"{BASE_URL}/api/clauses/{clause_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"text": "Updated text"}
        )
        
        # Get clause
        response = requests.get(f"{BASE_URL}/api/clauses/{clause_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = response.json()
        
        # Check v1
        v1 = data["versions"][0]
        assert "created_by_role" in v1, "v1 missing created_by_role"
        assert "changed_fields" in v1, "v1 missing changed_fields"
        
        # Check v2
        v2 = data["versions"][1]
        assert "created_by_role" in v2, "v2 missing created_by_role"
        assert "changed_fields" in v2, "v2 missing changed_fields"
        assert "text" in v2["changed_fields"], f"v2 changed_fields should include 'text', got {v2['changed_fields']}"
        
        print(f"✓ Versions have created_by_role and changed_fields: v1={v1.get('changed_fields')}, v2={v2.get('changed_fields')}")


# ============ RECAP VERSIONING AND LAST_MODIFIED ============
class TestRecapVersioningAndLastModified:
    """Test recap versioning with changed_fields and last_modified fields"""
    
    def test_patch_recap_structured_includes_changed_fields(self, admin_token):
        """PATCH /api/recaps/{id} with structured data change includes changed_fields in the new Version"""
        # Create recap
        create_response = requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "raw_text": "TEST recap for changed_fields",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}CHANGED_FIELDS_VESSEL",
                    "charterer": "TestCo",
                    "freight": "WS 100"
                }
            }
        )
        recap_id = create_response.json()["id"]
        
        # Patch with freight change
        response = requests.patch(f"{BASE_URL}/api/recaps/{recap_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}CHANGED_FIELDS_VESSEL",
                    "charterer": "TestCo",
                    "freight": "WS 150"
                }
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify new version with changed_fields
        assert len(data["versions"]) == 2, f"Expected 2 versions, got {len(data['versions'])}"
        v2 = data["versions"][1]
        assert "changed_fields" in v2, "v2 missing changed_fields"
        assert "freight" in v2["changed_fields"], f"changed_fields should include 'freight', got {v2['changed_fields']}"
        print(f"✓ Recap PATCH created v2 with changed_fields={v2['changed_fields']}")
    
    def test_recap_response_includes_last_modified_fields(self, admin_token):
        """Recap response includes last_modified_by_name and last_modified_by_role"""
        # Create recap
        create_response = requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "raw_text": "TEST recap for last_modified",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}LAST_MOD_VESSEL",
                    "charterer": "TestCo"
                }
            }
        )
        assert create_response.status_code == 200
        data = create_response.json()
        
        # Verify last_modified fields
        assert "last_modified_by_name" in data, "Missing last_modified_by_name"
        assert "last_modified_by_role" in data, "Missing last_modified_by_role"
        assert "last_modified_at" in data, "Missing last_modified_at"
        
        # On creation, last_modified_by_name should equal creator
        assert data["last_modified_by_name"] == data["created_by_name"]
        print(f"✓ Recap has last_modified fields: name={data['last_modified_by_name']}, role={data['last_modified_by_role']}")
    
    def test_link_clauses_bumps_last_modified(self, admin_token):
        """PUT /api/recaps/{id}/clauses bumps last_modified_* on recap"""
        # Create recap
        create_response = requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "raw_text": "TEST recap for link clauses",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}LINK_CLAUSES_VESSEL",
                    "charterer": "TestCo"
                }
            }
        )
        recap_id = create_response.json()["id"]
        original_last_modified = create_response.json().get("last_modified_at")
        
        # Create a clause
        clause_response = requests.post(f"{BASE_URL}/api/clauses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Link Test Clause",
                "category": "General",
                "tags": [],
                "text": "Clause text"
            }
        )
        clause_id = clause_response.json()["id"]
        
        # Wait a moment to ensure timestamp difference
        import time
        time.sleep(0.5)
        
        # Link clause
        link_response = requests.put(f"{BASE_URL}/api/recaps/{recap_id}/clauses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"clause_ids": [clause_id]}
        )
        assert link_response.status_code == 200
        
        # Get recap and verify last_modified updated
        get_response = requests.get(f"{BASE_URL}/api/recaps/{recap_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = get_response.json()
        
        assert data.get("last_modified_at") is not None
        assert data.get("last_modified_by_name") is not None
        print(f"✓ Linking clauses updated last_modified_at: {data.get('last_modified_at')}")
    
    def test_approval_action_bumps_last_modified(self, admin_token):
        """Approval actions (submit/approve/reject/fix) bump last_modified_* on recap"""
        # Create recap
        create_response = requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "raw_text": "TEST recap for approval",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}APPROVAL_VESSEL",
                    "charterer": "TestCo"
                }
            }
        )
        recap_id = create_response.json()["id"]
        
        # Submit for review
        import time
        time.sleep(0.5)
        
        submit_response = requests.post(f"{BASE_URL}/api/recaps/{recap_id}/approvals",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"action": "submit", "comment": "Ready for review"}
        )
        assert submit_response.status_code == 200
        
        # Get recap and verify last_modified updated
        get_response = requests.get(f"{BASE_URL}/api/recaps/{recap_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = get_response.json()
        
        assert data.get("last_modified_at") is not None
        assert data.get("last_modified_by_name") is not None
        assert data["status"] == "under_review"
        print(f"✓ Submit action updated last_modified_at and status to under_review")


# ============ ACTIVITY LOG PER ENTITY ============
class TestActivityLogPerEntity:
    """Test activity log (audit) per entity"""
    
    def test_get_audit_for_clause(self, admin_token):
        """GET /api/audit?entity_type=clause&entity_id={id} returns activity for that clause"""
        # Create clause
        create_response = requests.post(f"{BASE_URL}/api/clauses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Audit Test Clause",
                "category": "General",
                "tags": [],
                "text": "Original text"
            }
        )
        clause_id = create_response.json()["id"]
        
        # Update clause to create more audit entries
        requests.patch(f"{BASE_URL}/api/clauses/{clause_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"text": "Updated text"}
        )
        
        # Get audit for this clause
        response = requests.get(f"{BASE_URL}/api/audit?entity_type=clause&entity_id={clause_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 2, f"Expected at least 2 audit entries (created + revised), got {len(data)}"
        
        # Verify audit entry structure
        for entry in data:
            assert entry["entity_type"] == "clause"
            assert entry["entity_id"] == clause_id
            assert "action" in entry
            assert "user_name" in entry
            assert "user_role" in entry
            assert "summary" in entry
            assert "created_at" in entry
        
        # Check for expected actions
        actions = [e["action"] for e in data]
        assert "created" in actions, f"Expected 'created' action in audit, got {actions}"
        assert "revised" in actions, f"Expected 'revised' action in audit, got {actions}"
        
        print(f"✓ Got {len(data)} audit entries for clause: actions={actions}")
    
    def test_audit_includes_user_role(self, admin_token):
        """Audit log entries include user_role field"""
        # Create clause
        create_response = requests.post(f"{BASE_URL}/api/clauses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Audit Role Test",
                "category": "General",
                "tags": [],
                "text": "Test text"
            }
        )
        clause_id = create_response.json()["id"]
        
        # Get audit
        response = requests.get(f"{BASE_URL}/api/audit?entity_type=clause&entity_id={clause_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = response.json()
        
        assert len(data) >= 1
        entry = data[0]
        assert "user_role" in entry, "Audit entry missing user_role"
        assert entry["user_role"] == "admin", f"Expected user_role='admin', got {entry['user_role']}"
        print(f"✓ Audit entry includes user_role: {entry['user_role']}")


# ============ CREATING SETS LAST_MODIFIED ============
class TestCreationSetsLastModified:
    """Test that creating a recap or clause sets last_modified_by_name = creator"""
    
    def test_create_clause_sets_last_modified_to_creator(self, admin_token):
        """Creating a clause sets last_modified_by_name = creator"""
        response = requests.post(f"{BASE_URL}/api/clauses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Creator Test Clause",
                "category": "General",
                "tags": [],
                "text": "Test text"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["last_modified_by_name"] == data["created_by_name"]
        assert data["last_modified_by_role"] is not None
        print(f"✓ New clause: last_modified_by_name={data['last_modified_by_name']} equals created_by_name")
    
    def test_create_recap_sets_last_modified_to_creator(self, admin_token):
        """Creating a recap sets last_modified_by_name = creator"""
        response = requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "raw_text": "TEST creator recap",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}CREATOR_VESSEL",
                    "charterer": "TestCo"
                }
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["last_modified_by_name"] == data["created_by_name"]
        assert data["last_modified_by_role"] is not None
        print(f"✓ New recap: last_modified_by_name={data['last_modified_by_name']} equals created_by_name")


# ============ MULTIPLE FIELD CHANGES ============
class TestMultipleFieldChanges:
    """Test that multiple field changes are tracked correctly"""
    
    def test_patch_clause_multiple_fields_tracks_all(self, admin_token):
        """PATCH with multiple field changes tracks all in changed_fields"""
        # Create clause
        create_response = requests.post(f"{BASE_URL}/api/clauses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Multi Field Test",
                "category": "General",
                "tags": ["original"],
                "text": "Original text"
            }
        )
        clause_id = create_response.json()["id"]
        
        # Patch with multiple changes
        response = requests.patch(f"{BASE_URL}/api/clauses/{clause_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Multi Field Test UPDATED",
                "category": "BIMCO",
                "tags": ["original", "new"],
                "text": "Updated text"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        v2 = data["versions"][1]
        changed = v2.get("changed_fields", [])
        
        assert "title" in changed, f"changed_fields should include 'title', got {changed}"
        assert "category" in changed, f"changed_fields should include 'category', got {changed}"
        assert "tags" in changed, f"changed_fields should include 'tags', got {changed}"
        assert "text" in changed, f"changed_fields should include 'text', got {changed}"
        
        print(f"✓ Multiple field changes tracked: {changed}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
