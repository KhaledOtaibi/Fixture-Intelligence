from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import re
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

app = FastAPI(title="Fixture Intelligence Platform")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---------- Models ----------
Role = Literal["chartering", "operations", "legal", "admin"]
RecapStatus = Literal["draft", "under_review", "approved", "fixed"]

class StructuredRecap(BaseModel):
    vessel_name: Optional[str] = None
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
    vessel_name: str
    charterer: str
    status: RecapStatus
    raw_text: str
    structured: StructuredRecap
    versions: List[Version]
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


# ---------- Auth utils ----------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS),
    }
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
    # try direct parse
    try:
        return json.loads(text)
    except Exception:
        pass
    # extract first {...} block
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
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"parse-{uuid.uuid4()}",
        system_message=PARSER_SYSTEM,
    ).with_model("openai", "gpt-5.2")
    try:
        response = await chat.send_message(UserMessage(text=data.raw_text))
    except Exception as e:
        logger.error(f"LLM error: {e}")
        raise HTTPException(status_code=500, detail=f"AI parsing failed: {str(e)}")
    parsed = extract_json(response)
    # coerce allowed keys only
    allowed = StructuredRecap.model_fields.keys()
    clean = {k: (str(v) if v is not None else None) for k, v in parsed.items() if k in allowed}
    return StructuredRecap(**clean)


# ---------- Recap CRUD ----------
def recap_from_doc(doc: dict) -> Recap:
    return Recap(**doc)

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
        vessel_name=data.structured.vessel_name or "Unknown Vessel",
        charterer=data.structured.charterer or "Unknown",
        status="draft",
        raw_text=data.raw_text,
        structured=data.structured,
        versions=[version],
        created_by=current["id"],
        created_by_name=current["name"],
        created_at=now,
        updated_at=now,
    )
    await db.recaps.insert_one(recap.model_dump())
    return recap

@api_router.get("/recaps", response_model=List[Recap])
async def list_recaps(
    vessel: Optional[str] = None,
    charterer: Optional[str] = None,
    status_filter: Optional[str] = None,
    current=Depends(get_current_user),
):
    query = {}
    if vessel:
        query["vessel_name"] = {"$regex": vessel, "$options": "i"}
    if charterer:
        query["charterer"] = {"$regex": charterer, "$options": "i"}
    if status_filter:
        query["status"] = status_filter
    docs = await db.recaps.find(query, {"_id": 0}).sort("updated_at", -1).to_list(500)
    return [Recap(**d) for d in docs]

@api_router.get("/recaps/{recap_id}", response_model=Recap)
async def get_recap(recap_id: str, current=Depends(get_current_user)):
    doc = await db.recaps.find_one({"id": recap_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Recap not found")
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
        await db.recaps.update_one(
            {"id": recap_id},
            {"$set": updates, "$push": {"versions": new_version}},
        )
    else:
        await db.recaps.update_one({"id": recap_id}, {"$set": updates})

    doc = await db.recaps.find_one({"id": recap_id}, {"_id": 0})
    return Recap(**doc)

@api_router.delete("/recaps/{recap_id}")
async def delete_recap(recap_id: str, current=Depends(get_current_user)):
    if current["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    await db.recaps.delete_one({"id": recap_id})
    await db.comments.delete_many({"recap_id": recap_id})
    await db.approvals.delete_many({"recap_id": recap_id})
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
    # role-based enforcement
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
    await db.recaps.update_one(
        {"id": recap_id},
        {"$set": {"status": flow["to"], "updated_at": now_iso()}},
    )
    return approval

@api_router.get("/recaps/{recap_id}/approvals", response_model=List[Approval])
async def list_approvals(recap_id: str, current=Depends(get_current_user)):
    docs = await db.approvals.find({"recap_id": recap_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return [Approval(**d) for d in docs]


# ---------- Comments ----------
@api_router.post("/recaps/{recap_id}/comments", response_model=Comment)
async def create_comment(recap_id: str, data: CommentCreate, current=Depends(get_current_user)):
    doc = await db.recaps.find_one({"id": recap_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Recap not found")
    c = Comment(
        id=str(uuid.uuid4()),
        recap_id=recap_id,
        user_id=current["id"],
        user_name=current["name"],
        user_role=current["role"],
        text=data.text,
        created_at=now_iso(),
    )
    await db.comments.insert_one(c.model_dump())
    return c

@api_router.get("/recaps/{recap_id}/comments", response_model=List[Comment])
async def list_comments(recap_id: str, current=Depends(get_current_user)):
    docs = await db.comments.find({"recap_id": recap_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return [Comment(**d) for d in docs]


# ---------- Dashboard stats ----------
@api_router.get("/stats")
async def stats(current=Depends(get_current_user)):
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    cursor = db.recaps.aggregate(pipeline)
    counts = {"draft": 0, "under_review": 0, "approved": 0, "fixed": 0}
    async for row in cursor:
        counts[row["_id"]] = row["count"]
    total = sum(counts.values())
    return {"total": total, "by_status": counts}


# ---------- Seed ----------
SEED_RECAPS = [
    {
        "raw": "MV SEA LION fixed BP, 80k mts crude oil, WS 145, laycan 10-12 Apr, 1 SB 1 SP Rotterdam/Houston, DEM USD 28,000 PDPR, DES 1/2 DEM",
        "structured": {
            "vessel_name": "SEA LION", "charterer": "BP", "cargo_type": "Crude Oil",
            "cargo_quantity": "80,000 MT", "load_port": "Rotterdam", "discharge_port": "Houston",
            "laycan_start": "10 Apr", "laycan_end": "12 Apr", "freight": "WS 145",
            "demurrage": "USD 28,000 PDPR", "despatch": "1/2 DEM",
            "special_terms": "1 SB 1 SP",
        },
    },
    {
        "raw": "SHELL ATLANTIS fxd to Trafigura, 270k DWT VLCC, 260k mts DPP, USD 3.2M LS, L/C 5-7 May, AG/Singapore, DEM 45k, terms Shelltime4",
        "structured": {
            "vessel_name": "SHELL ATLANTIS", "charterer": "Trafigura", "cargo_type": "DPP",
            "cargo_quantity": "260,000 MT", "load_port": "Arabian Gulf", "discharge_port": "Singapore",
            "laycan_start": "5 May", "laycan_end": "7 May", "freight": "Lumpsum USD 3.2M",
            "demurrage": "USD 45,000", "despatch": None,
            "special_terms": "Shelltime4 form",
        },
    },
    {
        "raw": "Bulker OCEAN PRIDE, 75k mts iron ore, Vale, Tubarao/Qingdao, WS equivalent USD 18.5/mt, laycan 22-26 Apr, 2 SB each end, DEM 22k/ des 11k",
        "structured": {
            "vessel_name": "OCEAN PRIDE", "charterer": "Vale", "cargo_type": "Iron Ore",
            "cargo_quantity": "75,000 MT", "load_port": "Tubarao", "discharge_port": "Qingdao",
            "laycan_start": "22 Apr", "laycan_end": "26 Apr", "freight": "USD 18.50/MT",
            "demurrage": "USD 22,000", "despatch": "USD 11,000",
            "special_terms": "2 SB each end",
        },
    },
    {
        "raw": "NORTHERN STAR / Cargill / 65k wheat / Santos to Alexandria / WS n/a USD 42/mt / L/C 15-20 May / DEM 18k / FOB terms",
        "structured": {
            "vessel_name": "NORTHERN STAR", "charterer": "Cargill", "cargo_type": "Wheat",
            "cargo_quantity": "65,000 MT", "load_port": "Santos", "discharge_port": "Alexandria",
            "laycan_start": "15 May", "laycan_end": "20 May", "freight": "USD 42/MT",
            "demurrage": "USD 18,000", "despatch": None,
            "special_terms": "FOB terms",
        },
    },
    {
        "raw": "VLCC NAUTILUS IV fixed ExxonMobil, 270k mts Arab Light crude, AG/USG, WS 72, laycan 28 Apr-2 May, 1 SB 1 SP each, DEM 38k PDPR",
        "structured": {
            "vessel_name": "NAUTILUS IV", "charterer": "ExxonMobil", "cargo_type": "Arab Light Crude",
            "cargo_quantity": "270,000 MT", "load_port": "Arabian Gulf", "discharge_port": "US Gulf",
            "laycan_start": "28 Apr", "laycan_end": "2 May", "freight": "WS 72",
            "demurrage": "USD 38,000 PDPR", "despatch": None,
            "special_terms": "1 SB 1 SP each end",
        },
    },
]

@api_router.post("/seed")
async def seed_demo(current=Depends(get_current_user)):
    if current["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    await db.recaps.delete_many({"seeded": True})
    now = now_iso()
    statuses = ["fixed", "approved", "under_review", "draft", "under_review"]
    for i, s in enumerate(SEED_RECAPS):
        rid = str(uuid.uuid4())
        struct = StructuredRecap(**s["structured"])
        v1 = Version(
            version_label="Rev1", raw_text=s["raw"], structured=struct,
            created_by=current["id"], created_by_name=current["name"],
            created_at=now, note="Initial broker capture",
        )
        versions = [v1.model_dump()]
        # add second rev for variety
        if i % 2 == 0:
            v2_struct = struct.model_copy(update={"freight": struct.freight + " (adj)" if struct.freight else "Revised"})
            v2 = Version(
                version_label="Rev2", raw_text=s["raw"] + "\n\n[REVISED: freight adjusted]",
                structured=v2_struct, created_by=current["id"], created_by_name=current["name"],
                created_at=now, note="Freight revised after negotiation",
            )
            versions.append(v2.model_dump())
        recap = {
            "id": rid,
            "vessel_name": struct.vessel_name,
            "charterer": struct.charterer,
            "status": statuses[i],
            "raw_text": s["raw"],
            "structured": struct.model_dump(),
            "versions": versions,
            "created_by": current["id"],
            "created_by_name": current["name"],
            "created_at": now,
            "updated_at": now,
            "seeded": True,
        }
        await db.recaps.insert_one(recap)
    return {"seeded": len(SEED_RECAPS)}


# ---------- Health ----------
@api_router.get("/")
async def root():
    return {"service": "Fixture Intelligence Platform", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
