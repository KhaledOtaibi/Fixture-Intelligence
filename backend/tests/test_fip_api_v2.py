"""
Fixture Intelligence Platform - Backend API Tests V2
Tests: Clauses CRUD, Clause Compare, Attachments, Audit Trail, Noticeboard, Alerts, Q88 Vessel Lookup, Charter Party ID
"""
import pytest
import requests
import os
import uuid
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_PREFIX = "TEST_"


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
def chartering_token():
    """Get chartering user token"""
    email = f"chartering_{uuid.uuid4().hex[:8]}@test.com"
    response = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": email,
        "password": "testpass123",
        "name": f"{TEST_PREFIX}Chartering",
        "role": "chartering"
    })
    return response.json()["token"]


@pytest.fixture
def legal_token():
    """Get legal user token"""
    email = f"legal_{uuid.uuid4().hex[:8]}@test.com"
    response = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": email,
        "password": "testpass123",
        "name": f"{TEST_PREFIX}Legal",
        "role": "legal"
    })
    return response.json()["token"]


# ============ HEALTH CHECK ============
class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_api_root(self):
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        # Updated service name after rebrand
        assert "Emergent" in data["service"] or "Contract" in data["service"]
        assert data["status"] == "ok"
        print("✓ Health check passed")


# ============ CLAUSE LIBRARY TESTS ============
class TestClauseCRUD:
    """Clause Library CRUD operations"""
    
    def test_create_clause_with_v1(self, admin_token):
        """POST /api/clauses creates a clause with v1 version"""
        response = requests.post(f"{BASE_URL}/api/clauses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}BIMCO Sanctions Clause",
                "category": "BIMCO",
                "tags": ["sanctions", "OFAC"],
                "text": "The Owners shall not be required to employ the Vessel in any trade prohibited by Sanctions."
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == f"{TEST_PREFIX}BIMCO Sanctions Clause"
        assert data["category"] == "BIMCO"
        assert data["tags"] == ["sanctions", "OFAC"]
        assert data["is_approved"] == False
        assert len(data["versions"]) == 1
        assert data["versions"][0]["version_label"] == "v1"
        assert "id" in data
        print(f"✓ Created clause with v1: {data['id']}")
        return data["id"]
    
    def test_list_clauses(self, admin_token):
        """GET /api/clauses lists clauses"""
        response = requests.get(f"{BASE_URL}/api/clauses",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} clauses")
    
    def test_list_clauses_with_category_filter(self, admin_token):
        """GET /api/clauses with category filter"""
        # Create a clause with specific category
        requests.post(f"{BASE_URL}/api/clauses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Piracy Clause",
                "category": "Piracy",
                "tags": ["piracy"],
                "text": "Piracy clause text"
            }
        )
        
        response = requests.get(f"{BASE_URL}/api/clauses?category=Piracy",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        for clause in data:
            assert clause["category"] == "Piracy"
        print(f"✓ Filtered by category: {len(data)} Piracy clauses")
    
    def test_list_clauses_with_tag_filter(self, admin_token):
        """GET /api/clauses with tag filter"""
        response = requests.get(f"{BASE_URL}/api/clauses?tag=sanctions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        for clause in data:
            assert "sanctions" in clause.get("tags", [])
        print(f"✓ Filtered by tag: {len(data)} clauses with 'sanctions' tag")
    
    def test_list_clauses_with_search(self, admin_token):
        """GET /api/clauses with search filter"""
        # Create a clause with unique text
        unique_text = f"UNIQUE_SEARCH_{uuid.uuid4().hex[:8]}"
        requests.post(f"{BASE_URL}/api/clauses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Search Test",
                "category": "General",
                "tags": [],
                "text": unique_text
            }
        )
        
        response = requests.get(f"{BASE_URL}/api/clauses?search={unique_text}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        print(f"✓ Search filter found {len(data)} clauses")
    
    def test_get_clause_with_versions(self, admin_token):
        """GET /api/clauses/{id} returns clause with versions"""
        # Create clause
        create_response = requests.post(f"{BASE_URL}/api/clauses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Get Test Clause",
                "category": "General",
                "tags": [],
                "text": "Original text"
            }
        )
        clause_id = create_response.json()["id"]
        
        # Get clause
        response = requests.get(f"{BASE_URL}/api/clauses/{clause_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == clause_id
        assert "versions" in data
        assert len(data["versions"]) >= 1
        print(f"✓ Got clause with {len(data['versions'])} version(s)")
    
    def test_patch_clause_creates_v2(self, admin_token):
        """PATCH /api/clauses/{id} with changed text creates v2"""
        # Create clause
        create_response = requests.post(f"{BASE_URL}/api/clauses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Version Test",
                "category": "General",
                "tags": [],
                "text": "Original text v1"
            }
        )
        clause_id = create_response.json()["id"]
        
        # Patch with new text
        response = requests.patch(f"{BASE_URL}/api/clauses/{clause_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "text": "Updated text v2",
                "change_note": "Updated for 2024 regulations"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["versions"]) == 2
        assert data["versions"][1]["version_label"] == "v2"
        assert data["text"] == "Updated text v2"
        print(f"✓ PATCH created v2 for clause: {clause_id}")
    
    def test_patch_clause_approve_requires_legal_admin(self, admin_token, chartering_token):
        """PATCH with is_approved=true requires legal/admin role"""
        # Create clause as admin
        create_response = requests.post(f"{BASE_URL}/api/clauses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Approve Test",
                "category": "General",
                "tags": [],
                "text": "Clause to approve"
            }
        )
        clause_id = create_response.json()["id"]
        
        # Try to approve as chartering (should fail with 403)
        response = requests.patch(f"{BASE_URL}/api/clauses/{clause_id}",
            headers={"Authorization": f"Bearer {chartering_token}"},
            json={"is_approved": True}
        )
        assert response.status_code == 403
        print("✓ Chartering user correctly denied clause approval (403)")
        
        # Approve as admin (should succeed)
        response = requests.patch(f"{BASE_URL}/api/clauses/{clause_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"is_approved": True}
        )
        assert response.status_code == 200
        assert response.json()["is_approved"] == True
        print("✓ Admin approved clause successfully")
    
    def test_delete_clause_requires_legal_admin(self, admin_token, chartering_token):
        """DELETE /api/clauses/{id} requires legal/admin"""
        # Create clause
        create_response = requests.post(f"{BASE_URL}/api/clauses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Delete Test",
                "category": "General",
                "tags": [],
                "text": "Clause to delete"
            }
        )
        clause_id = create_response.json()["id"]
        
        # Try to delete as chartering (should fail with 403)
        response = requests.delete(f"{BASE_URL}/api/clauses/{clause_id}",
            headers={"Authorization": f"Bearer {chartering_token}"}
        )
        assert response.status_code == 403
        print("✓ Chartering user correctly denied clause deletion (403)")
        
        # Delete as admin (should succeed)
        response = requests.delete(f"{BASE_URL}/api/clauses/{clause_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        assert response.json()["deleted"] == True
        print("✓ Admin deleted clause successfully")


class TestClauseCompare:
    """Clause comparison with AI analysis"""
    
    def test_compare_clauses_returns_ai_analysis(self, admin_token):
        """POST /api/clauses/compare returns ai_analysis with differences/overlaps/summary/disclaimer"""
        # Create two clauses
        clause_a = requests.post(f"{BASE_URL}/api/clauses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Compare A - Sanctions",
                "category": "Sanctions",
                "tags": ["sanctions"],
                "text": "The Owners shall not be required to employ the Vessel in any trade prohibited by OFAC sanctions."
            }
        ).json()
        
        clause_b = requests.post(f"{BASE_URL}/api/clauses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Compare B - Sanctions",
                "category": "Sanctions",
                "tags": ["sanctions"],
                "text": "The Charterers warrant that the Vessel will not be employed in any trade subject to EU or UN sanctions."
            }
        ).json()
        
        # Compare
        response = requests.post(f"{BASE_URL}/api/clauses/compare",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "clause_a_id": clause_a["id"],
                "clause_b_id": clause_b["id"]
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "clause_a" in data
        assert "clause_b" in data
        assert "ai_analysis" in data
        assert "summary" in data["ai_analysis"]
        assert "differences" in data["ai_analysis"]
        assert "overlaps" in data["ai_analysis"]
        assert "disclaimer" in data["ai_analysis"]
        print(f"✓ AI comparison returned: summary='{data['ai_analysis']['summary'][:50]}...'")
        print(f"  Differences: {len(data['ai_analysis']['differences'])}, Overlaps: {len(data['ai_analysis']['overlaps'])}")


# ============ ATTACHMENTS TESTS ============
class TestAttachments:
    """Attachment upload/download/delete tests"""
    
    def test_upload_attachment(self, admin_token):
        """POST /api/attachments with UploadFile and recap_id returns stored file info"""
        # Create a recap first
        recap_response = requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "raw_text": "TEST attachment recap",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}ATTACHMENT_VESSEL",
                    "charterer": "TestCo"
                }
            }
        )
        recap_id = recap_response.json()["id"]
        
        # Upload file
        files = {"file": ("test_document.txt", io.BytesIO(b"Test file content for attachment"), "text/plain")}
        response = requests.post(
            f"{BASE_URL}/api/attachments?recap_id={recap_id}&category=document",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files
        )
        assert response.status_code == 200
        data = response.json()
        assert data["recap_id"] == recap_id
        assert data["filename"] == "test_document.txt"
        assert data["category"] == "document"
        assert "storage_path" in data
        assert data["is_deleted"] == False
        print(f"✓ Uploaded attachment: {data['id']}")
        return data["id"], recap_id
    
    def test_list_attachments_by_recap(self, admin_token):
        """GET /api/attachments?recap_id=X lists non-deleted attachments"""
        # Create recap and upload
        recap_response = requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "raw_text": "TEST list attachments",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}LIST_ATT_VESSEL",
                    "charterer": "TestCo"
                }
            }
        )
        recap_id = recap_response.json()["id"]
        
        # Upload two files
        for i in range(2):
            files = {"file": (f"test_file_{i}.txt", io.BytesIO(f"Content {i}".encode()), "text/plain")}
            requests.post(
                f"{BASE_URL}/api/attachments?recap_id={recap_id}&category=document",
                headers={"Authorization": f"Bearer {admin_token}"},
                files=files
            )
        
        # List
        response = requests.get(f"{BASE_URL}/api/attachments?recap_id={recap_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
        for att in data:
            assert att["is_deleted"] == False
        print(f"✓ Listed {len(data)} attachments for recap")
    
    def test_download_attachment_with_auth_query(self, admin_token):
        """GET /api/attachments/{id}/download returns file bytes (test with ?auth= query param)"""
        # Create recap and upload
        recap_response = requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "raw_text": "TEST download attachment",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}DOWNLOAD_VESSEL",
                    "charterer": "TestCo"
                }
            }
        )
        recap_id = recap_response.json()["id"]
        
        test_content = b"Download test content 12345"
        files = {"file": ("download_test.txt", io.BytesIO(test_content), "text/plain")}
        upload_response = requests.post(
            f"{BASE_URL}/api/attachments?recap_id={recap_id}&category=document",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files
        )
        att_id = upload_response.json()["id"]
        
        # Download with auth query param
        response = requests.get(f"{BASE_URL}/api/attachments/{att_id}/download?auth={admin_token}")
        assert response.status_code == 200
        assert test_content in response.content
        print(f"✓ Downloaded attachment with auth query param")
    
    def test_delete_attachment_soft_deletes(self, admin_token):
        """DELETE /api/attachments/{id} soft-deletes (is_deleted=true)"""
        # Create recap and upload
        recap_response = requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "raw_text": "TEST delete attachment",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}DELETE_ATT_VESSEL",
                    "charterer": "TestCo"
                }
            }
        )
        recap_id = recap_response.json()["id"]
        
        files = {"file": ("delete_test.txt", io.BytesIO(b"Delete me"), "text/plain")}
        upload_response = requests.post(
            f"{BASE_URL}/api/attachments?recap_id={recap_id}&category=document",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files
        )
        att_id = upload_response.json()["id"]
        
        # Delete
        response = requests.delete(f"{BASE_URL}/api/attachments/{att_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        assert response.json()["deleted"] == True
        
        # Verify not in list
        list_response = requests.get(f"{BASE_URL}/api/attachments?recap_id={recap_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        att_ids = [a["id"] for a in list_response.json()]
        assert att_id not in att_ids
        print(f"✓ Soft-deleted attachment: {att_id}")


# ============ AUDIT TRAIL TESTS ============
class TestAuditTrail:
    """Audit trail endpoint tests"""
    
    def test_audit_by_entity(self, admin_token):
        """GET /api/audit?entity_type=recap&entity_id=X returns audit log"""
        # Create a recap (this should create an audit entry)
        recap_response = requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "raw_text": "TEST audit recap",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}AUDIT_VESSEL",
                    "charterer": "TestCo"
                }
            }
        )
        recap_id = recap_response.json()["id"]
        
        # Get audit for this recap
        response = requests.get(f"{BASE_URL}/api/audit?entity_type=recap&entity_id={recap_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        # Check audit entry structure
        entry = data[0]
        assert entry["entity_type"] == "recap"
        assert entry["entity_id"] == recap_id
        assert "action" in entry
        assert "user_name" in entry
        assert "summary" in entry
        print(f"✓ Got {len(data)} audit entries for recap")
    
    def test_audit_general_feed(self, admin_token):
        """GET /api/audit?limit=100 returns general audit feed"""
        response = requests.get(f"{BASE_URL}/api/audit?limit=100",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) <= 100
        print(f"✓ Got {len(data)} audit entries in general feed")


# ============ NOTICEBOARD TESTS ============
class TestNoticeboard:
    """Noticeboard endpoint tests"""
    
    def test_create_notice(self, admin_token):
        """POST /api/notices creates notice"""
        response = requests.post(f"{BASE_URL}/api/notices",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Test Notice",
                "body": "This is a test notice body",
                "pinned": False
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == f"{TEST_PREFIX}Test Notice"
        assert data["body"] == "This is a test notice body"
        assert data["pinned"] == False
        assert "id" in data
        print(f"✓ Created notice: {data['id']}")
        return data["id"]
    
    def test_list_notices_pinned_first(self, admin_token):
        """GET /api/notices returns pinned first"""
        # Create unpinned notice
        requests.post(f"{BASE_URL}/api/notices",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Unpinned Notice",
                "body": "Not pinned",
                "pinned": False
            }
        )
        
        # Create pinned notice
        requests.post(f"{BASE_URL}/api/notices",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Pinned Notice",
                "body": "This is pinned",
                "pinned": True
            }
        )
        
        # List
        response = requests.get(f"{BASE_URL}/api/notices",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check pinned notices come first
        pinned_indices = [i for i, n in enumerate(data) if n["pinned"]]
        unpinned_indices = [i for i, n in enumerate(data) if not n["pinned"]]
        if pinned_indices and unpinned_indices:
            assert max(pinned_indices) < min(unpinned_indices), "Pinned notices should come before unpinned"
        print(f"✓ Listed {len(data)} notices (pinned first)")
    
    def test_delete_notice_owner_only(self, admin_token, chartering_token):
        """DELETE /api/notices/{id} rejects if not owner/admin"""
        # Create notice as admin
        create_response = requests.post(f"{BASE_URL}/api/notices",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": f"{TEST_PREFIX}Admin Notice",
                "body": "Created by admin",
                "pinned": False
            }
        )
        notice_id = create_response.json()["id"]
        
        # Try to delete as chartering (should fail with 403)
        response = requests.delete(f"{BASE_URL}/api/notices/{notice_id}",
            headers={"Authorization": f"Bearer {chartering_token}"}
        )
        assert response.status_code == 403
        print("✓ Non-owner correctly denied notice deletion (403)")
        
        # Delete as admin (should succeed)
        response = requests.delete(f"{BASE_URL}/api/notices/{notice_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        print("✓ Owner/admin deleted notice successfully")


# ============ ALERTS TESTS ============
class TestAlerts:
    """Alerts endpoint tests"""
    
    def test_get_alerts(self, admin_token):
        """GET /api/alerts returns alerts based on laycan dates and under_review recaps"""
        # First seed some data
        requests.post(f"{BASE_URL}/api/seed",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        response = requests.get(f"{BASE_URL}/api/alerts",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Check alert structure if any exist
        if len(data) > 0:
            alert = data[0]
            assert "id" in alert
            assert "recap_id" in alert
            assert "charter_party_id" in alert
            assert "vessel_name" in alert
            assert "alert_type" in alert
            assert "message" in alert
            assert "severity" in alert
            assert alert["severity"] in ["info", "warning", "critical"]
        print(f"✓ Got {len(data)} alerts")


# ============ Q88 VESSEL LOOKUP TESTS ============
class TestVesselLookup:
    """Q88 Vessel Lookup (mock) tests"""
    
    def test_lookup_bahri_abha_found(self, admin_token):
        """POST /api/vessels/lookup with 'BAHRI ABHA' returns found:true"""
        response = requests.post(f"{BASE_URL}/api/vessels/lookup",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"query": "BAHRI ABHA"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["found"] == True
        assert data["source"] == "Q88 (mock)"
        assert data["vessel"]["name"] == "BAHRI ABHA"
        assert data["vessel"]["imo"] == "9594367"
        assert data["vessel"]["type"] == "VLCC"
        print(f"✓ Found BAHRI ABHA: IMO {data['vessel']['imo']}, {data['vessel']['type']}")
    
    def test_lookup_by_imo(self, admin_token):
        """POST /api/vessels/lookup with IMO returns found:true"""
        response = requests.post(f"{BASE_URL}/api/vessels/lookup",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"query": "9594367"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["found"] == True
        assert data["vessel"]["name"] == "BAHRI ABHA"
        print(f"✓ Found vessel by IMO: {data['vessel']['name']}")
    
    def test_lookup_not_found(self, admin_token):
        """POST /api/vessels/lookup with 'XYZ123' returns found:false"""
        response = requests.post(f"{BASE_URL}/api/vessels/lookup",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"query": "XYZ123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["found"] == False
        assert data["vessel"] is None
        print("✓ Unknown vessel returns found:false")
    
    def test_lookup_other_vessels(self, admin_token):
        """Test other vessels in Q88 mock DB"""
        vessels = ["SEA LION", "SHELL ATLANTIS", "OCEAN PRIDE", "NORTHERN STAR", "NAUTILUS IV"]
        for vessel in vessels:
            response = requests.post(f"{BASE_URL}/api/vessels/lookup",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={"query": vessel}
            )
            assert response.status_code == 200
            assert response.json()["found"] == True
        print(f"✓ All {len(vessels)} mock vessels found")


# ============ RECAP CHARTER PARTY ID TESTS ============
class TestRecapCharterPartyId:
    """Recap Charter Party ID tests"""
    
    def test_recap_has_charter_party_id(self, admin_token):
        """POST /api/recaps now returns charter_party_id field (format CP-YYYYMMDD-XXXXXX)"""
        response = requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "raw_text": "TEST CP ID",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}CP_ID_VESSEL",
                    "charterer": "TestCo"
                }
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "charter_party_id" in data
        # Check format: CP-YYYYMMDD-XXXXXX
        cp_id = data["charter_party_id"]
        assert cp_id.startswith("CP-")
        parts = cp_id.split("-")
        assert len(parts) == 3
        assert len(parts[1]) == 8  # YYYYMMDD
        assert len(parts[2]) == 6  # XXXXXX
        print(f"✓ Recap has charter_party_id: {cp_id}")
    
    def test_recap_creates_audit_log(self, admin_token):
        """POST /api/recaps creates an audit log entry"""
        response = requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "raw_text": "TEST audit log",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}AUDIT_LOG_VESSEL",
                    "charterer": "TestCo"
                }
            }
        )
        recap_id = response.json()["id"]
        
        # Check audit log
        audit_response = requests.get(f"{BASE_URL}/api/audit?entity_type=recap&entity_id={recap_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = audit_response.json()
        assert len(data) >= 1
        assert any(log["action"] == "created" for log in data)
        print(f"✓ Recap creation logged in audit trail")


# ============ LINKED CLAUSES TESTS ============
class TestLinkedClauses:
    """Linked clauses for recaps"""
    
    def test_link_clauses_to_recap(self, admin_token):
        """PUT /api/recaps/{id}/clauses sets linked_clauses"""
        # Create recap
        recap_response = requests.post(f"{BASE_URL}/api/recaps",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "raw_text": "TEST link clauses",
                "structured": {
                    "vessel_name": f"{TEST_PREFIX}LINK_CLAUSES_VESSEL",
                    "charterer": "TestCo"
                }
            }
        )
        recap_id = recap_response.json()["id"]
        
        # Create clauses
        clause_ids = []
        for i in range(2):
            clause_response = requests.post(f"{BASE_URL}/api/clauses",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={
                    "title": f"{TEST_PREFIX}Link Clause {i}",
                    "category": "General",
                    "tags": [],
                    "text": f"Clause {i} text"
                }
            )
            clause_ids.append(clause_response.json()["id"])
        
        # Link clauses
        response = requests.put(f"{BASE_URL}/api/recaps/{recap_id}/clauses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"clause_ids": clause_ids}
        )
        assert response.status_code == 200
        assert response.json()["linked"] == 2
        
        # Verify
        get_response = requests.get(f"{BASE_URL}/api/recaps/{recap_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert get_response.json()["linked_clauses"] == clause_ids
        print(f"✓ Linked {len(clause_ids)} clauses to recap")


# ============ STATS WITH CLAUSES TESTS ============
class TestStatsWithClauses:
    """Stats endpoint with clause counts"""
    
    def test_stats_includes_clauses(self, admin_token):
        """GET /api/stats now returns clauses: {total, approved}"""
        response = requests.get(f"{BASE_URL}/api/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "clauses" in data
        assert "total" in data["clauses"]
        assert "approved" in data["clauses"]
        print(f"✓ Stats includes clauses: total={data['clauses']['total']}, approved={data['clauses']['approved']}")


# ============ SEED WITH CLAUSES TESTS ============
class TestSeedWithClauses:
    """Seed endpoint with clauses and notices"""
    
    def test_seed_creates_clauses_and_notices(self, admin_token):
        """POST /api/seed now seeds 5 recaps + 6 clauses + 1 notice"""
        response = requests.post(f"{BASE_URL}/api/seed",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["seeded_recaps"] == 5
        assert data["seeded_clauses"] == 6
        print(f"✓ Seeded {data['seeded_recaps']} recaps and {data['seeded_clauses']} clauses")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
