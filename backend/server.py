from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Query, Header, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import re
import requests
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any, Literal
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta

from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"
JWT_EXP_HOURS = 24 * 7
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = "emergent-fip"

app = FastAPI(title="Fixture Intelligence AI")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---------- Object Storage ----------
storage_key: Optional[str] = None

def init_storage() -> Optional[str]:
    global storage_key
    if storage_key:
        return storage_key
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        logger.info("Storage initialized")
        return storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Storage unavailable")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Storage unavailable")
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------- Models ----------
Role = Literal["chartering", "operations", "legal", "admin"]
RecapStatus = Literal["draft", "under_review", "approved", "fixed", "on_subs", "fully_fixed"]

class StructuredRecap(BaseModel):
    vessel_name: Optional[str] = None
    vessel_imo: Optional[str] = None
    charterer: Optional[str] = None
    cargo_type: Optional[str] = None
    cargo_quantity: Optional[str] = None
    load_port: Optional[str] = None
    discharge_port: Optional[str] = None
    laycan_start: Optional[str] = None
    laycan_end: Optional[str] = None
    freight: Optional[str] = None
    demurrage: Optional[str] = None
    despatch: Optional[str] = None
    special_terms: Optional[str] = None

class User(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: Role
    created_at: str

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Role = "chartering"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class AuthResponse(BaseModel):
    token: str
    user: User

class ParseRequest(BaseModel):
    raw_text: str

class RecapCreate(BaseModel):
    raw_text: str = ""
    structured: StructuredRecap

class RecapUpdate(BaseModel):
    raw_text: Optional[str] = None
    structured: Optional[StructuredRecap] = None
    status: Optional[RecapStatus] = None
    note: Optional[str] = None

class Version(BaseModel):
    version_label: str
    raw_text: str
    structured: StructuredRecap
    created_by: str
    created_by_name: str
    created_at: str
    note: Optional[str] = None

class Recap(BaseModel):
    id: str
    charter_party_id: str
    vessel_name: str
    charterer: str
    status: RecapStatus
    raw_text: str
    structured: StructuredRecap
    versions: List[Version]
    linked_clauses: List[str] = []
    created_by: str
    created_by_name: str
    created_at: str
    updated_at: str

class Comment(BaseModel):
    id: str
    recap_id: str
    user_id: str
    user_name: str
    user_role: Role
    text: str
    created_at: str

class CommentCreate(BaseModel):
    text: str

class Approval(BaseModel):
    id: str
    recap_id: str
    user_id: str
    user_name: str
    user_role: Role
    action: Literal["submitted", "approved", "rejected", "fixed"]
    comment: Optional[str] = None
    created_at: str

class ApprovalAction(BaseModel):
    action: Literal["submit", "approve", "reject", "fix"]
    comment: Optional[str] = None

ClauseCategory = Literal["BIMCO", "Shelltime", "Asbatankvoy", "Piracy", "Sanctions", "ETS", "War Risk", "General", "Custom"]

class ClauseVersion(BaseModel):
    version_label: str
    text: str
    created_by: str
    created_by_name: str
    created_at: str
    change_note: Optional[str] = None

class Clause(BaseModel):
    id: str
    title: str
    category: ClauseCategory
    tags: List[str] = []
    text: str
    versions: List[ClauseVersion]
    is_approved: bool = False
    created_by: str
    created_by_name: str
    created_at: str
    updated_at: str

class ClauseCreate(BaseModel):
    title: str
    category: ClauseCategory = "General"
    tags: List[str] = []
    text: str

class ClauseUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[ClauseCategory] = None
    tags: Optional[List[str]] = None
    text: Optional[str] = None
    change_note: Optional[str] = None
    is_approved: Optional[bool] = None

class ClauseCompareRequest(BaseModel):
    clause_a_id: str
    clause_b_id: str

class Attachment(BaseModel):
    id: str
    recap_id: Optional[str] = None
    clause_id: Optional[str] = None
    filename: str
    content_type: str
    size: int
    storage_path: str
    category: str = "document"
    uploaded_by: str
    uploaded_by_name: str
    created_at: str
    is_deleted: bool = False

class AuditLog(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    action: str
    user_id: str
    user_name: str
    user_role: Role
    summary: str
    created_at: str

class Notice(BaseModel):
    id: str
    title: str
    body: str
    pinned: bool = False
    user_id: str
    user_name: str
    user_role: Role
    created_at: str

class NoticeCreate(BaseModel):
    title: str
    body: str
    pinned: bool = False

class Alert(BaseModel):
    id: str
    recap_id: str
    charter_party_id: str
    vessel_name: str
    alert_type: str
    due_date: Optional[str] = None
    message: str
    severity: Literal["info", "warning", "critical"]

class VesselLookupRequest(BaseModel):
    query: str  # vessel name or IMO


# ---------- Auth utils ----------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
        user_id = payload["sub"]
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def gen_cp_id() -> str:
    return f"CP-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

async def log_audit(entity_type: str, entity_id: str, action: str, user: dict, summary: str):
    doc = AuditLog(
        id=str(uuid.uuid4()),
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        user_id=user["id"],
        user_name=user["name"],
        user_role=user["role"],
        summary=summary,
        created_at=now_iso(),
    ).model_dump()
    await db.audit_logs.insert_one(doc)


# ---------- Auth routes ----------
@api_router.post("/auth/register", response_model=AuthResponse)
async def register(data: UserRegister):
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": data.email.lower(),
        "name": data.name,
        "role": data.role,
        "password": hash_password(data.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    user = User(id=user_id, email=data.email.lower(), name=data.name, role=data.role, created_at=doc["created_at"])
    await log_audit("user", user_id, "registered", {"id": user_id, "name": data.name, "role": data.role}, f"{data.name} joined as {data.role}")
    return AuthResponse(token=create_token(user_id), user=user)

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(data: UserLogin):
    doc = await db.users.find_one({"email": data.email.lower()})
    if not doc or not verify_password(data.password, doc["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user = User(id=doc["id"], email=doc["email"], name=doc["name"], role=doc["role"], created_at=doc["created_at"])
    return AuthResponse(token=create_token(doc["id"]), user=user)

@api_router.get("/auth/me", response_model=User)
async def me(current=Depends(get_current_user)):
    return User(**current)


# ---------- AI Parser ----------
PARSER_SYSTEM = """You are an expert shipping fixture recap parser. Extract structured data from broker communications.

Normalize these shipping abbreviations:
- WS = Worldscale rate (freight)
- mts / mt = metric tonnes
- kt / k = thousand
- SB = Safe Berth, SP = Safe Port
- DWT = deadweight, LOA = length overall
- Laycan = laydays/cancelling window
- DEM = demurrage, DES = despatch
- LP = load port, DP = discharge port
- CHR/CHTR = charterer
- Crude/DPP/CPP = cargo types

Return ONLY a valid JSON object matching this exact schema (use null for missing fields):
{
  "vessel_name": "string",
  "vessel_imo": "string (7-digit IMO if present, else null)",
  "charterer": "string",
  "cargo_type": "string",
  "cargo_quantity": "string (include unit e.g. '80,000 MT')",
  "load_port": "string",
  "discharge_port": "string",
  "laycan_start": "string (e.g. '10 Apr')",
  "laycan_end": "string (e.g. '12 Apr')",
  "freight": "string (e.g. 'WS 145' or 'USD 25/ton' or 'Lumpsum 1.2M')",
  "demurrage": "string (e.g. 'USD 25,000 PDPR')",
  "despatch": "string",
  "special_terms": "string"
}

Do not include markdown, explanation, or any text outside the JSON object."""

def extract_json(text: str) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except Exception:
        pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    return {}

@api_router.post("/parse", response_model=StructuredRecap)
async def parse_recap(data: ParseRequest, current=Depends(get_current_user)):
    if not data.raw_text.strip():
        raise HTTPException(status_code=400, detail="Empty text")
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"parse-{uuid.uuid4()}", system_message=PARSER_SYSTEM).with_model("openai", "gpt-5.2")
    try:
        response = await chat.send_message(UserMessage(text=data.raw_text))
    except Exception as e:
        logger.error(f"LLM error: {e}")
        raise HTTPException(status_code=500, detail=f"AI parsing failed: {str(e)}")
    parsed = extract_json(response)
    allowed = StructuredRecap.model_fields.keys()
    clean = {k: (str(v) if v is not None else None) for k, v in parsed.items() if k in allowed}
    return StructuredRecap(**clean)


# ---------- Q88 Vessel Lookup (MOCK) ----------
Q88_MOCK_DB = [
    {"name": "BAHRI ABHA", "imo": "9594367", "dwt": 319700, "type": "VLCC", "year": 2012, "flag": "Saudi Arabia", "owner": "Bahri"},
    {"name": "BAHRI TABUK", "imo": "9594379", "dwt": 317800, "type": "VLCC", "year": 2013, "flag": "Saudi Arabia", "owner": "Bahri"},
    {"name": "BAHRI JEDDAH", "imo": "9594381", "dwt": 319000, "type": "VLCC", "year": 2013, "flag": "Saudi Arabia", "owner": "Bahri"},
    {"name": "SEA LION", "imo": "9712345", "dwt": 115000, "type": "Aframax", "year": 2018, "flag": "Marshall Islands", "owner": "Atlantic Tankers"},
    {"name": "SHELL ATLANTIS", "imo": "9800001", "dwt": 270000, "type": "VLCC", "year": 2020, "flag": "UK", "owner": "Shell"},
    {"name": "OCEAN PRIDE", "imo": "9650912", "dwt": 82000, "type": "Panamax Bulker", "year": 2015, "flag": "Panama", "owner": "Pacific Bulk"},
    {"name": "NORTHERN STAR", "imo": "9681201", "dwt": 76000, "type": "Panamax Bulker", "year": 2016, "flag": "Liberia", "owner": "Nordic Ship"},
    {"name": "NAUTILUS IV", "imo": "9723456", "dwt": 299000, "type": "VLCC", "year": 2019, "flag": "Marshall Islands", "owner": "Nautilus Shipping"},
]

@api_router.post("/vessels/lookup")
async def vessel_lookup(data: VesselLookupRequest, current=Depends(get_current_user)):
    q = data.query.strip().upper()
    if not q:
        raise HTTPException(status_code=400, detail="Empty query")
    # Try IMO match first
    for v in Q88_MOCK_DB:
        if v["imo"] == q.replace(" ", ""):
            return {"found": True, "source": "Q88 (mock)", "vessel": v}
    # Try name substring
    for v in Q88_MOCK_DB:
        if q in v["name"]:
            return {"found": True, "source": "Q88 (mock)", "vessel": v}
    return {"found": False, "source": "Q88 (mock)", "vessel": None}


# ---------- Recap CRUD ----------
@api_router.post("/recaps", response_model=Recap)
async def create_recap(data: RecapCreate, current=Depends(get_current_user)):
    now = now_iso()
    rid = str(uuid.uuid4())
    version = Version(
        version_label="Rev1",
        raw_text=data.raw_text,
        structured=data.structured,
        created_by=current["id"],
        created_by_name=current["name"],
        created_at=now,
        note="Initial draft",
    )
    recap = Recap(
        id=rid,
        charter_party_id=gen_cp_id(),
        vessel_name=data.structured.vessel_name or "Unknown Vessel",
        charterer=data.structured.charterer or "Unknown",
        status="draft",
        raw_text=data.raw_text,
        structured=data.structured,
        versions=[version],
        linked_clauses=[],
        created_by=current["id"],
        created_by_name=current["name"],
        created_at=now,
        updated_at=now,
    )
    await db.recaps.insert_one(recap.model_dump())
    await log_audit("recap", rid, "created", current, f"Created recap {recap.charter_party_id} — {recap.vessel_name}")
    return recap

@api_router.get("/recaps", response_model=List[Recap])
async def list_recaps(
    vessel: Optional[str] = None,
    charterer: Optional[str] = None,
    status_filter: Optional[str] = None,
    current=Depends(get_current_user),
):
    query: Dict[str, Any] = {}
    if vessel:
        query["vessel_name"] = {"$regex": vessel, "$options": "i"}
    if charterer:
        query["charterer"] = {"$regex": charterer, "$options": "i"}
    if status_filter:
        query["status"] = status_filter
    docs = await db.recaps.find(query, {"_id": 0}).sort("updated_at", -1).to_list(100)
    for d in docs:
        d.setdefault("charter_party_id", gen_cp_id())
        d.setdefault("linked_clauses", [])
        for v in d.get("versions", []):
            v.get("structured", {}).setdefault("vessel_imo", None)
        d.get("structured", {}).setdefault("vessel_imo", None)
    return [Recap(**d) for d in docs]

@api_router.get("/recaps/{recap_id}", response_model=Recap)
async def get_recap(recap_id: str, current=Depends(get_current_user)):
    doc = await db.recaps.find_one({"id": recap_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Recap not found")
    doc.setdefault("charter_party_id", gen_cp_id())
    doc.setdefault("linked_clauses", [])
    doc.get("structured", {}).setdefault("vessel_imo", None)
    for v in doc.get("versions", []):
        v.get("structured", {}).setdefault("vessel_imo", None)
    return Recap(**doc)

@api_router.patch("/recaps/{recap_id}", response_model=Recap)
async def update_recap(recap_id: str, data: RecapUpdate, current=Depends(get_current_user)):
    doc = await db.recaps.find_one({"id": recap_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Recap not found")
    now = now_iso()
    updates: Dict[str, Any] = {"updated_at": now}
    create_new_version = False
    if data.raw_text is not None:
        updates["raw_text"] = data.raw_text
        create_new_version = True
    if data.structured is not None:
        updates["structured"] = data.structured.model_dump()
        updates["vessel_name"] = data.structured.vessel_name or doc["vessel_name"]
        updates["charterer"] = data.structured.charterer or doc["charterer"]
        create_new_version = True
    if data.status is not None:
        updates["status"] = data.status

    if create_new_version:
        next_n = len(doc["versions"]) + 1
        label = f"Rev{next_n}" if data.status != "fixed" else "Final"
        new_version = Version(
            version_label=label,
            raw_text=updates.get("raw_text", doc["raw_text"]),
            structured=StructuredRecap(**updates.get("structured", doc["structured"])),
            created_by=current["id"],
            created_by_name=current["name"],
            created_at=now,
            note=data.note,
        ).model_dump()
        await db.recaps.update_one({"id": recap_id}, {"$set": updates, "$push": {"versions": new_version}})
        await log_audit("recap", recap_id, "revised", current, f"Created {label}. {data.note or ''}")
    else:
        await db.recaps.update_one({"id": recap_id}, {"$set": updates})
        await log_audit("recap", recap_id, "updated", current, f"Updated fields: {', '.join(updates.keys())}")

    doc = await db.recaps.find_one({"id": recap_id}, {"_id": 0})
    doc.setdefault("charter_party_id", gen_cp_id())
    doc.setdefault("linked_clauses", [])
    doc.get("structured", {}).setdefault("vessel_imo", None)
    for v in doc.get("versions", []):
        v.get("structured", {}).setdefault("vessel_imo", None)
    return Recap(**doc)

class LinkClausesRequest(BaseModel):
    clause_ids: List[str]

@api_router.put("/recaps/{recap_id}/clauses")
async def link_clauses(recap_id: str, data: LinkClausesRequest, current=Depends(get_current_user)):
    doc = await db.recaps.find_one({"id": recap_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Recap not found")
    await db.recaps.update_one({"id": recap_id}, {"$set": {"linked_clauses": data.clause_ids, "updated_at": now_iso()}})
    await log_audit("recap", recap_id, "clauses_linked", current, f"Linked {len(data.clause_ids)} clause(s)")
    return {"linked": len(data.clause_ids)}

@api_router.delete("/recaps/{recap_id}")
async def delete_recap(recap_id: str, current=Depends(get_current_user)):
    if current["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    await db.recaps.delete_one({"id": recap_id})
    await db.comments.delete_many({"recap_id": recap_id})
    await db.approvals.delete_many({"recap_id": recap_id})
    await log_audit("recap", recap_id, "deleted", current, "Recap deleted")
    return {"deleted": True}


# ---------- Approvals ----------
STATUS_FLOW = {
    "submit": {"from": ["draft"], "to": "under_review", "label": "submitted"},
    "approve": {"from": ["under_review"], "to": "approved", "label": "approved"},
    "reject": {"from": ["under_review"], "to": "draft", "label": "rejected"},
    "fix": {"from": ["approved"], "to": "fixed", "label": "fixed"},
}

@api_router.post("/recaps/{recap_id}/approvals", response_model=Approval)
async def create_approval(recap_id: str, data: ApprovalAction, current=Depends(get_current_user)):
    doc = await db.recaps.find_one({"id": recap_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Recap not found")
    flow = STATUS_FLOW.get(data.action)
    if not flow:
        raise HTTPException(status_code=400, detail="Invalid action")
    if doc["status"] not in flow["from"]:
        raise HTTPException(status_code=400, detail=f"Cannot {data.action} from status {doc['status']}")
    if data.action in ("approve", "reject") and current["role"] not in ("legal", "admin", "operations"):
        raise HTTPException(status_code=403, detail="Your role cannot approve/reject")
    if data.action == "fix" and current["role"] not in ("operations", "admin"):
        raise HTTPException(status_code=403, detail="Only operations/admin can mark fixed")

    approval = Approval(
        id=str(uuid.uuid4()),
        recap_id=recap_id,
        user_id=current["id"],
        user_name=current["name"],
        user_role=current["role"],
        action=flow["label"],
        comment=data.comment,
        created_at=now_iso(),
    )
    await db.approvals.insert_one(approval.model_dump())
    await db.recaps.update_one({"id": recap_id}, {"$set": {"status": flow["to"], "updated_at": now_iso()}})
    await log_audit("recap", recap_id, flow["label"], current, f"{flow['label'].title()}: {data.comment or '—'}")
    return approval

@api_router.get("/recaps/{recap_id}/approvals", response_model=List[Approval])
async def list_approvals(recap_id: str, current=Depends(get_current_user)):
    docs = await db.approvals.find({"recap_id": recap_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return [Approval(**d) for d in docs]


# ---------- Comments ----------
@api_router.post("/recaps/{recap_id}/comments", response_model=Comment)
async def create_comment(recap_id: str, data: CommentCreate, current=Depends(get_current_user)):
    doc = await db.recaps.find_one({"id": recap_id}, {"_id": 0, "id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Recap not found")
    c = Comment(
        id=str(uuid.uuid4()), recap_id=recap_id, user_id=current["id"],
        user_name=current["name"], user_role=current["role"],
        text=data.text, created_at=now_iso(),
    )
    await db.comments.insert_one(c.model_dump())
    return c

@api_router.get("/recaps/{recap_id}/comments", response_model=List[Comment])
async def list_comments(recap_id: str, current=Depends(get_current_user)):
    docs = await db.comments.find({"recap_id": recap_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return [Comment(**d) for d in docs]


# ---------- Clause Library ----------
def _clean_clause(d: dict) -> dict:
    d.setdefault("tags", [])
    d.setdefault("is_approved", False)
    return d

@api_router.post("/clauses", response_model=Clause)
async def create_clause(data: ClauseCreate, current=Depends(get_current_user)):
    now = now_iso()
    cid = str(uuid.uuid4())
    ver = ClauseVersion(
        version_label="v1", text=data.text,
        created_by=current["id"], created_by_name=current["name"],
        created_at=now, change_note="Initial version",
    )
    clause = Clause(
        id=cid, title=data.title, category=data.category, tags=data.tags,
        text=data.text, versions=[ver], is_approved=False,
        created_by=current["id"], created_by_name=current["name"],
        created_at=now, updated_at=now,
    )
    await db.clauses.insert_one(clause.model_dump())
    await log_audit("clause", cid, "created", current, f"New clause '{data.title}' ({data.category})")
    return clause

@api_router.get("/clauses", response_model=List[Clause])
async def list_clauses(
    category: Optional[str] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    current=Depends(get_current_user),
):
    query: Dict[str, Any] = {}
    if category:
        query["category"] = category
    if tag:
        query["tags"] = tag
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"text": {"$regex": search, "$options": "i"}},
        ]
    docs = await db.clauses.find(query, {"_id": 0}).sort("updated_at", -1).to_list(100)
    return [Clause(**_clean_clause(d)) for d in docs]

@api_router.get("/clauses/{clause_id}", response_model=Clause)
async def get_clause(clause_id: str, current=Depends(get_current_user)):
    doc = await db.clauses.find_one({"id": clause_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Clause not found")
    return Clause(**_clean_clause(doc))

@api_router.patch("/clauses/{clause_id}", response_model=Clause)
async def update_clause(clause_id: str, data: ClauseUpdate, current=Depends(get_current_user)):
    doc = await db.clauses.find_one({"id": clause_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Clause not found")

    # Only legal/admin can approve clauses
    if data.is_approved is not None and current["role"] not in ("legal", "admin"):
        raise HTTPException(status_code=403, detail="Only legal/admin can approve clauses")

    now = now_iso()
    updates: Dict[str, Any] = {"updated_at": now}
    create_version = False
    if data.title is not None:
        updates["title"] = data.title
    if data.category is not None:
        updates["category"] = data.category
    if data.tags is not None:
        updates["tags"] = data.tags
    if data.text is not None and data.text != doc["text"]:
        updates["text"] = data.text
        create_version = True
    if data.is_approved is not None:
        updates["is_approved"] = data.is_approved

    if create_version:
        next_n = len(doc["versions"]) + 1
        new_version = ClauseVersion(
            version_label=f"v{next_n}", text=data.text,
            created_by=current["id"], created_by_name=current["name"],
            created_at=now, change_note=data.change_note or "Updated",
        ).model_dump()
        await db.clauses.update_one({"id": clause_id}, {"$set": updates, "$push": {"versions": new_version}})
        await log_audit("clause", clause_id, "revised", current, f"New version v{next_n}: {data.change_note or ''}")
    else:
        await db.clauses.update_one({"id": clause_id}, {"$set": updates})
        await log_audit("clause", clause_id, "updated", current, f"Updated: {', '.join(updates.keys())}")

    doc = await db.clauses.find_one({"id": clause_id}, {"_id": 0})
    return Clause(**_clean_clause(doc))

@api_router.delete("/clauses/{clause_id}")
async def delete_clause(clause_id: str, current=Depends(get_current_user)):
    if current["role"] not in ("legal", "admin"):
        raise HTTPException(status_code=403, detail="Only legal/admin can delete clauses")
    await db.clauses.delete_one({"id": clause_id})
    await log_audit("clause", clause_id, "deleted", current, "Clause deleted")
    return {"deleted": True}

@api_router.post("/clauses/compare")
async def compare_clauses(data: ClauseCompareRequest, current=Depends(get_current_user)):
    a = await db.clauses.find_one({"id": data.clause_a_id}, {"_id": 0})
    b = await db.clauses.find_one({"id": data.clause_b_id}, {"_id": 0})
    if not a or not b:
        raise HTTPException(status_code=404, detail="Clause(s) not found")

    # AI-assisted comparison (information only, not legal advice)
    system = """You are an AI assistant that compares shipping contract clauses side-by-side for INFORMATIONAL purposes only. You do NOT provide legal advice or recommendations. Produce:
1. Short summary (2 sentences) of the key differences
2. A bullet list of specific differences (max 6)
3. A list of specific overlaps (max 4)
Return ONLY valid JSON: {"summary": "...", "differences": ["..."], "overlaps": ["..."]}
Do not add any disclaimer or legal opinion."""
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"cmp-{uuid.uuid4()}", system_message=system).with_model("openai", "gpt-5.2")
    try:
        resp = await chat.send_message(UserMessage(text=f"CLAUSE A ({a['title']}, {a['category']}):\n{a['text']}\n\nCLAUSE B ({b['title']}, {b['category']}):\n{b['text']}"))
    except Exception as e:
        resp = '{"summary": "AI comparison unavailable.", "differences": [], "overlaps": []}'
        logger.error(f"AI compare error: {e}")
    parsed = extract_json(resp)
    return {
        "clause_a": Clause(**_clean_clause(a)).model_dump(),
        "clause_b": Clause(**_clean_clause(b)).model_dump(),
        "ai_analysis": {
            "summary": parsed.get("summary", ""),
            "differences": parsed.get("differences", []),
            "overlaps": parsed.get("overlaps", []),
            "disclaimer": "AI-generated analysis for information retrieval only. Not legal advice.",
        },
    }


# ---------- Attachments ----------
def _safe_ext(filename: str) -> str:
    if "." in filename:
        return filename.rsplit(".", 1)[-1].lower()[:10]
    return "bin"

@api_router.post("/attachments")
async def upload_attachment(
    file: UploadFile = File(...),
    recap_id: Optional[str] = Query(None),
    clause_id: Optional[str] = Query(None),
    category: str = Query("document"),
    current=Depends(get_current_user),
):
    if not recap_id and not clause_id:
        raise HTTPException(status_code=400, detail="Must link to a recap or clause")
    ext = _safe_ext(file.filename or "file")
    att_id = str(uuid.uuid4())
    path = f"{APP_NAME}/uploads/{current['id']}/{att_id}.{ext}"
    data = await file.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 25 MB)")
    result = put_object(path, data, file.content_type or "application/octet-stream")
    doc = Attachment(
        id=att_id, recap_id=recap_id, clause_id=clause_id,
        filename=file.filename or "file",
        content_type=file.content_type or "application/octet-stream",
        size=result.get("size", len(data)),
        storage_path=result["path"], category=category,
        uploaded_by=current["id"], uploaded_by_name=current["name"],
        created_at=now_iso(), is_deleted=False,
    )
    await db.attachments.insert_one(doc.model_dump())
    await log_audit(
        "attachment", att_id, "uploaded", current,
        f"Uploaded {file.filename} ({category}) to {'recap ' + recap_id if recap_id else 'clause ' + clause_id}",
    )
    return doc

@api_router.get("/attachments", response_model=List[Attachment])
async def list_attachments(
    recap_id: Optional[str] = None,
    clause_id: Optional[str] = None,
    current=Depends(get_current_user),
):
    query: Dict[str, Any] = {"is_deleted": False}
    if recap_id:
        query["recap_id"] = recap_id
    if clause_id:
        query["clause_id"] = clause_id
    docs = await db.attachments.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Attachment(**d) for d in docs]

@api_router.get("/attachments/{att_id}/download")
async def download_attachment(att_id: str, authorization: Optional[str] = Header(None), auth: Optional[str] = Query(None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    elif auth:
        token = auth
    if not token:
        raise HTTPException(status_code=401, detail="Missing auth")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        user_id = payload["sub"]
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    att = await db.attachments.find_one({"id": att_id, "is_deleted": False}, {"_id": 0})
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    data, ctype = get_object(att["storage_path"])
    return Response(content=data, media_type=att.get("content_type", ctype), headers={"Content-Disposition": f"inline; filename=\"{att['filename']}\""})

@api_router.delete("/attachments/{att_id}")
async def delete_attachment(att_id: str, current=Depends(get_current_user)):
    att = await db.attachments.find_one({"id": att_id}, {"_id": 0})
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if current["role"] != "admin" and att["uploaded_by"] != current["id"]:
        raise HTTPException(status_code=403, detail="Cannot delete others' files")
    await db.attachments.update_one({"id": att_id}, {"$set": {"is_deleted": True}})
    await log_audit("attachment", att_id, "deleted", current, f"Removed {att['filename']}")
    return {"deleted": True}


# ---------- Audit Trail ----------
@api_router.get("/audit", response_model=List[AuditLog])
async def list_audit(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    limit: int = 100,
    current=Depends(get_current_user),
):
    query: Dict[str, Any] = {}
    if entity_type:
        query["entity_type"] = entity_type
    if entity_id:
        query["entity_id"] = entity_id
    docs = await db.audit_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(min(limit, 500))
    return [AuditLog(**d) for d in docs]


# ---------- Noticeboard ----------
@api_router.post("/notices", response_model=Notice)
async def create_notice(data: NoticeCreate, current=Depends(get_current_user)):
    notice = Notice(
        id=str(uuid.uuid4()), title=data.title, body=data.body, pinned=data.pinned,
        user_id=current["id"], user_name=current["name"], user_role=current["role"],
        created_at=now_iso(),
    )
    await db.notices.insert_one(notice.model_dump())
    await log_audit("notice", notice.id, "posted", current, f"Posted '{data.title}'")
    return notice

@api_router.get("/notices", response_model=List[Notice])
async def list_notices(current=Depends(get_current_user)):
    docs = await db.notices.find({}, {"_id": 0}).sort([("pinned", -1), ("created_at", -1)]).to_list(200)
    return [Notice(**d) for d in docs]

@api_router.delete("/notices/{notice_id}")
async def delete_notice(notice_id: str, current=Depends(get_current_user)):
    doc = await db.notices.find_one({"id": notice_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Notice not found")
    if current["role"] != "admin" and doc["user_id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Cannot delete others' notices")
    await db.notices.delete_one({"id": notice_id})
    return {"deleted": True}


# ---------- Alerts (auto-derived from recaps) ----------
def _parse_day(s: str) -> Optional[datetime]:
    if not s:
        return None
    # try multiple formats
    for fmt in ("%d %b %Y", "%d %b", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            dt = datetime.strptime(s.strip(), fmt)
            if dt.year < 2000:
                dt = dt.replace(year=datetime.now(timezone.utc).year)
            return dt.replace(tzinfo=timezone.utc)
        except Exception:
            continue
    return None

@api_router.get("/alerts", response_model=List[Alert])
async def list_alerts(current=Depends(get_current_user)):
    docs = await db.recaps.find(
        {"status": {"$in": ["draft", "under_review", "approved", "on_subs"]}},
        {"_id": 0, "id": 1, "vessel_name": 1, "charter_party_id": 1, "status": 1, "structured.laycan_start": 1},
    ).to_list(200)
    alerts: List[Alert] = []
    now = datetime.now(timezone.utc)
    for d in docs:
        s = d.get("structured", {}) or {}
        laycan_start_str = s.get("laycan_start")
        dt = _parse_day(laycan_start_str) if laycan_start_str else None
        if dt:
            diff = (dt - now).days
            severity = "info"
            if 0 <= diff <= 3:
                severity = "critical"
            elif 0 <= diff <= 7:
                severity = "warning"
            if diff >= -30 and diff <= 45:
                alerts.append(Alert(
                    id=f"laycan-{d['id']}",
                    recap_id=d["id"],
                    charter_party_id=d.get("charter_party_id", "—"),
                    vessel_name=d["vessel_name"],
                    alert_type="Laycan approaching" if diff >= 0 else "Laycan passed",
                    due_date=dt.strftime("%d %b %Y"),
                    message=f"Laycan {'in ' + str(diff) + ' days' if diff >= 0 else str(-diff) + ' days ago'}",
                    severity=severity,
                ))
        if d.get("status") == "under_review":
            alerts.append(Alert(
                id=f"review-{d['id']}",
                recap_id=d["id"],
                charter_party_id=d.get("charter_party_id", "—"),
                vessel_name=d["vessel_name"],
                alert_type="Pending approval",
                due_date=None,
                message=f"Recap for {d['vessel_name']} awaiting review",
                severity="warning",
            ))
    return alerts


# ---------- Dashboard stats ----------
@api_router.get("/stats")
async def stats(current=Depends(get_current_user)):
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    cursor = db.recaps.aggregate(pipeline)
    counts = {"draft": 0, "under_review": 0, "approved": 0, "fixed": 0, "on_subs": 0, "fully_fixed": 0}
    async for row in cursor:
        if row["_id"] in counts:
            counts[row["_id"]] = row["count"]
    total = sum(counts.values())
    clause_count = await db.clauses.count_documents({})
    approved_clauses = await db.clauses.count_documents({"is_approved": True})
    return {
        "total": total,
        "by_status": counts,
        "clauses": {"total": clause_count, "approved": approved_clauses},
    }


# ---------- Seed ----------
SEED_RECAPS = [
    {"raw": "MV SEA LION fixed BP, 80k mts crude oil, WS 145, laycan 10-12 Apr, 1 SB 1 SP Rotterdam/Houston, DEM USD 28,000 PDPR, DES 1/2 DEM",
     "structured": {"vessel_name": "SEA LION", "vessel_imo": "9712345", "charterer": "BP", "cargo_type": "Crude Oil", "cargo_quantity": "80,000 MT", "load_port": "Rotterdam", "discharge_port": "Houston", "laycan_start": "10 Apr", "laycan_end": "12 Apr", "freight": "WS 145", "demurrage": "USD 28,000 PDPR", "despatch": "1/2 DEM", "special_terms": "1 SB 1 SP"}},
    {"raw": "SHELL ATLANTIS fxd to Trafigura, 270k DWT VLCC, 260k mts DPP, USD 3.2M LS, L/C 5-7 May, AG/Singapore, DEM 45k, terms Shelltime4",
     "structured": {"vessel_name": "SHELL ATLANTIS", "vessel_imo": "9800001", "charterer": "Trafigura", "cargo_type": "DPP", "cargo_quantity": "260,000 MT", "load_port": "Arabian Gulf", "discharge_port": "Singapore", "laycan_start": "5 May", "laycan_end": "7 May", "freight": "Lumpsum USD 3.2M", "demurrage": "USD 45,000", "despatch": None, "special_terms": "Shelltime4 form"}},
    {"raw": "Bulker OCEAN PRIDE, 75k mts iron ore, Vale, Tubarao/Qingdao, WS equivalent USD 18.5/mt, laycan 22-26 Apr, 2 SB each end, DEM 22k/ des 11k",
     "structured": {"vessel_name": "OCEAN PRIDE", "vessel_imo": "9650912", "charterer": "Vale", "cargo_type": "Iron Ore", "cargo_quantity": "75,000 MT", "load_port": "Tubarao", "discharge_port": "Qingdao", "laycan_start": "22 Apr", "laycan_end": "26 Apr", "freight": "USD 18.50/MT", "demurrage": "USD 22,000", "despatch": "USD 11,000", "special_terms": "2 SB each end"}},
    {"raw": "NORTHERN STAR / Cargill / 65k wheat / Santos to Alexandria / WS n/a USD 42/mt / L/C 15-20 May / DEM 18k / FOB terms",
     "structured": {"vessel_name": "NORTHERN STAR", "vessel_imo": "9681201", "charterer": "Cargill", "cargo_type": "Wheat", "cargo_quantity": "65,000 MT", "load_port": "Santos", "discharge_port": "Alexandria", "laycan_start": "15 May", "laycan_end": "20 May", "freight": "USD 42/MT", "demurrage": "USD 18,000", "despatch": None, "special_terms": "FOB terms"}},
    {"raw": "VLCC NAUTILUS IV fixed ExxonMobil, 270k mts Arab Light crude, AG/USG, WS 72, laycan 28 Apr-2 May, 1 SB 1 SP each, DEM 38k PDPR",
     "structured": {"vessel_name": "NAUTILUS IV", "vessel_imo": "9723456", "charterer": "ExxonMobil", "cargo_type": "Arab Light Crude", "cargo_quantity": "270,000 MT", "load_port": "Arabian Gulf", "discharge_port": "US Gulf", "laycan_start": "28 Apr", "laycan_end": "2 May", "freight": "WS 72", "demurrage": "USD 38,000 PDPR", "despatch": None, "special_terms": "1 SB 1 SP each end"}},
]

SEED_CLAUSES = [
    {"title": "BIMCO Sanctions Clause for Time Charter Parties 2020", "category": "BIMCO", "tags": ["sanctions", "OFAC", "time charter"], "text": "(a) The Owners shall not be required to employ the Vessel in any trade or service which is prohibited by any Sanctions. (b) If the Vessel is subject to any Sanctions, the Owners shall be entitled to terminate this Charter Party..."},
    {"title": "BIMCO Piracy Clause for Time Charter Parties 2013", "category": "Piracy", "tags": ["piracy", "war risk", "GOA"], "text": "(a) The Vessel shall not be obliged to proceed or required to continue to or through any port, place, area or zone which in the reasonable judgement of the Master or Owners may expose the Vessel, crew or cargo to piracy..."},
    {"title": "Shelltime 4 — Offhire Clause (Cl. 21)", "category": "Shelltime", "tags": ["offhire", "shelltime4"], "text": "On each and every occasion that there is loss of time (whether by way of interruption in the Vessel's service or from reduction in the Vessel's performance or in any other manner) due to deficiency of personnel, strike of officers or crew, breakdown of machinery, damage to hull or other accident..."},
    {"title": "Asbatankvoy — Laytime & Demurrage (Part II Cl. 7)", "category": "Asbatankvoy", "tags": ["laytime", "demurrage"], "text": "The Charterer shall be allowed 72 running hours, weather permitting, Sundays and Holidays included, for loading and discharging. Laytime shall commence upon the expiration of 6 hours after NOR is tendered..."},
    {"title": "War Risk Clause (CONWARTIME 2013)", "category": "War Risk", "tags": ["war", "CONWARTIME"], "text": "If at any time the Vessel is, in the reasonable judgement of the Master or Owners, exposed to War Risks, the Owners may give notice to the Charterers cancelling this Charter Party..."},
    {"title": "EU ETS Clause for Voyage Charter Parties 2023", "category": "ETS", "tags": ["ets", "emissions", "EU"], "text": "Charterers shall reimburse Owners for emission allowances surrendered under the EU Emission Trading System for CO2 emissions relating to the Vessel's performance under this Charter Party..."},
]

@api_router.post("/seed")
async def seed_demo(current=Depends(get_current_user)):
    if current["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    await db.recaps.delete_many({"seeded": True})
    await db.clauses.delete_many({"seeded": True})
    await db.notices.delete_many({"seeded": True})
    now = now_iso()
    statuses = ["fixed", "approved", "under_review", "draft", "under_review"]
    for i, s in enumerate(SEED_RECAPS):
        rid = str(uuid.uuid4())
        struct = StructuredRecap(**s["structured"])
        v1 = Version(version_label="Rev1", raw_text=s["raw"], structured=struct, created_by=current["id"], created_by_name=current["name"], created_at=now, note="Initial broker capture")
        versions = [v1.model_dump()]
        if i % 2 == 0:
            v2_struct = struct.model_copy(update={"freight": (struct.freight or "") + " (adj)"})
            v2 = Version(version_label="Rev2", raw_text=s["raw"] + "\n\n[REVISED: freight adjusted]", structured=v2_struct, created_by=current["id"], created_by_name=current["name"], created_at=now, note="Freight revised after negotiation")
            versions.append(v2.model_dump())
        recap = {
            "id": rid, "charter_party_id": gen_cp_id(),
            "vessel_name": struct.vessel_name, "charterer": struct.charterer,
            "status": statuses[i], "raw_text": s["raw"],
            "structured": struct.model_dump(), "versions": versions,
            "linked_clauses": [],
            "created_by": current["id"], "created_by_name": current["name"],
            "created_at": now, "updated_at": now, "seeded": True,
        }
        await db.recaps.insert_one(recap)

    for s in SEED_CLAUSES:
        cid = str(uuid.uuid4())
        ver = ClauseVersion(version_label="v1", text=s["text"], created_by=current["id"], created_by_name=current["name"], created_at=now, change_note="Initial import").model_dump()
        await db.clauses.insert_one({
            "id": cid, "title": s["title"], "category": s["category"],
            "tags": s["tags"], "text": s["text"], "versions": [ver],
            "is_approved": True,
            "created_by": current["id"], "created_by_name": current["name"],
            "created_at": now, "updated_at": now, "seeded": True,
        })

    await db.notices.insert_one({
        "id": str(uuid.uuid4()), "title": "Welcome to Fixture Intelligence AI",
        "body": "This platform is your single source of truth for recaps, charter parties, and the clause library. AI-assisted content is for information retrieval only — not legal advice.",
        "pinned": True, "user_id": current["id"], "user_name": current["name"],
        "user_role": current["role"], "created_at": now, "seeded": True,
    })

    return {"seeded_recaps": len(SEED_RECAPS), "seeded_clauses": len(SEED_CLAUSES)}


# ---------- Health ----------
@api_router.get("/")
async def root():
    return {"service": "Fixture Intelligence AI", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    try:
        init_storage()
    except Exception as e:
        logger.warning(f"Storage init failed (non-blocking): {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
