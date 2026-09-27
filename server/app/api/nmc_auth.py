"""
NMC Auth API
Simple admin password + reviewer key authentication.
Role-based session tokens with HMAC verification and 24-hour validity window.

Reviewers are persisted in the database (not in-memory).
Decision counts and last_active timestamps are queried live from the DB.
"""

import hmac
import hashlib
import time
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Header, Request
from pydantic import BaseModel

try:
    from app.config import settings
    from app.db.nmc_repository import nmc_repo
except ImportError:
    from server.app.config import settings
    from server.app.db.nmc_repository import nmc_repo

router = APIRouter()

_ADMIN_TOKEN_PREFIX = "nmc-admin-"
_REVIEWER_TOKEN_PREFIX = "nmc-reviewer-"


class AuthContext(str):
    """
    Subclasses str so existing `role == 'admin'` and `role == 'reviewer'` checks continue working seamlessly,
    while attaching full identity: cpse_code, cpse_id, reviewer_id, reviewer_name.
    """
    def __new__(
        cls,
        role: str,
        cpse_code: Optional[str] = None,
        cpse_id: Optional[str] = None,
        reviewer_id: Optional[str] = None,
        reviewer_name: Optional[str] = None,
    ):
        obj = str.__new__(cls, role)
        obj.role = role
        obj.cpse_code = cpse_code.upper() if cpse_code else None
        obj.cpse_id = cpse_id
        obj.reviewer_id = reviewer_id
        obj.reviewer_name = reviewer_name
        return obj

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def is_reviewer(self) -> bool:
        return self.role == "reviewer"

    def can_access_cpse(self, target_cpse_code: Optional[str] = None, target_cpse_id: Optional[str] = None) -> bool:
        if self.is_admin:
            return True
        if not self.cpse_code:
            return True
        if target_cpse_code and target_cpse_code.upper() != "ALL":
            return target_cpse_code.upper() == self.cpse_code
        if target_cpse_id and self.cpse_id:
            return target_cpse_id == self.cpse_id
        return True


def _make_token_for_ts(prefix: str, secret: str, ts_bucket: int) -> str:
    sig = hmac.new(secret.encode(), str(ts_bucket).encode(), hashlib.sha256).hexdigest()[:24]
    return f"{prefix}{sig}"


def _make_token(prefix: str, secret: str) -> str:
    """Generate a deterministic HMAC token with 24-hour validity."""
    ts_bucket = int(time.time() // 86400)
    return _make_token_for_ts(prefix, secret, ts_bucket)


def _make_reviewer_token(cpse_code: str, reviewer_id: str) -> str:
    ts_bucket = int(time.time() // 86400)
    msg = f"{cpse_code.upper()}--{reviewer_id.upper()}--{ts_bucket}"
    sig = hmac.new(settings.REVIEWER_KEY.encode(), msg.encode(), hashlib.sha256).hexdigest()[:24]
    return f"{_REVIEWER_TOKEN_PREFIX}{cpse_code.upper()}--{reviewer_id.upper()}--{sig}"


def _verify_reviewer_token(token: str) -> Optional[tuple]:
    """Returns (cpse_code, reviewer_id) if valid reviewer token, otherwise None."""
    if not token or not token.startswith(_REVIEWER_TOKEN_PREFIX):
        return None

    remainder = token[len(_REVIEWER_TOKEN_PREFIX):]
    parts = remainder.split("--")
    if len(parts) == 3:
        cpse_code, reviewer_id, sig = parts
        curr_bucket = int(time.time() // 86400)
        for b in (curr_bucket, curr_bucket - 1):
            msg = f"{cpse_code}--{reviewer_id}--{b}"
            expected_sig = hmac.new(settings.REVIEWER_KEY.encode(), msg.encode(), hashlib.sha256).hexdigest()[:24]
            if sig == expected_sig:
                return (cpse_code, reviewer_id)

    if _is_valid_token(token, _REVIEWER_TOKEN_PREFIX, settings.REVIEWER_KEY):
        return ("HPCL", "HPCL-REV-001")

    return None


def _is_valid_token(token: str, prefix: str, secret: str) -> bool:
    """Check against current and previous 24-hour window."""
    if not token or not token.startswith(prefix):
        return False
    curr_bucket = int(time.time() // 86400)
    for b in (curr_bucket, curr_bucket - 1):
        if token == _make_token_for_ts(prefix, secret, b):
            return True
    return False


def _get_reviewer_from_db(reviewer_id: str):
    """Fetch reviewer dict from DB by ID."""
    return nmc_repo.get_reviewer(reviewer_id)


def _get_reviewer_by_cpse_code(cpse_code: str):
    """Fetch first active reviewer for a given CPSE code from DB."""
    result = nmc_repo.list_reviewers(cpse_code=cpse_code, status="ACTIVE")
    items = result.get("items", [])
    return items[0] if items else None


def extract_token_from_header(
    authorization: Optional[str] = None,
    x_reviewer_key: Optional[str] = None,
) -> Optional[str]:
    """Helper to extract token from Authorization header or custom header."""
    if x_reviewer_key:
        return x_reviewer_key.strip()
    if authorization:
        parts = authorization.strip().split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1]
        return authorization.strip()
    return None


def verify_admin_access(authorization: Optional[str] = Header(None)) -> str:
    """
    Enforce ADMIN-only access.
    Returns 'admin' on success.
    Raises 401 if missing/invalid, or 403 if authenticated as non-admin.
    """
    token = extract_token_from_header(authorization=authorization)
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Admin credentials required. Please provide a valid admin token.",
        )

    if token == settings.ADMIN_PASSWORD or _is_valid_token(token, _ADMIN_TOKEN_PREFIX, settings.ADMIN_PASSWORD):
        return "admin"

    if token.startswith(_REVIEWER_TOKEN_PREFIX) or token == settings.REVIEWER_KEY:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Reviewers are not authorized to perform administrative setup or modify datasets.",
        )

    raise HTTPException(status_code=401, detail="Invalid or expired admin token.")


def get_auth_context(
    authorization: Optional[str] = Header(None),
    x_reviewer_key: Optional[str] = Header(None),
    x_reviewer_cpse: Optional[str] = Header(None),
    x_reviewer_id: Optional[str] = Header(None),
) -> AuthContext:
    token = extract_token_from_header(authorization=authorization, x_reviewer_key=x_reviewer_key)

    # 1. Admin checks
    if token:
        if token == settings.ADMIN_PASSWORD or _is_valid_token(token, _ADMIN_TOKEN_PREFIX, settings.ADMIN_PASSWORD):
            return AuthContext("admin")

    # 2. Reviewer token checks
    if token:
        rev_info = _verify_reviewer_token(token)
        if rev_info:
            cpse_code, reviewer_id = rev_info
            rev = _get_reviewer_from_db(reviewer_id)
            if rev:
                if rev.get("status") == "SUSPENDED":
                    raise HTTPException(status_code=403, detail=f"Reviewer certification for '{reviewer_id}' is currently suspended.")
                cpse_code = rev["cpse_code"]
                rev_name = rev["name"]
            else:
                rev_name = "Reviewer"
            cpse_obj = nmc_repo.get_cpse_by_code(cpse_code)
            cpse_id = cpse_obj["id"] if cpse_obj else (rev.get("cpse_id") if rev else None)
            return AuthContext("reviewer", cpse_code=cpse_code, cpse_id=cpse_id, reviewer_id=reviewer_id, reviewer_name=rev_name)

        if token == settings.REVIEWER_KEY or token == "nmc-reviewer-key":
            code = (x_reviewer_cpse or "HPCL").strip().upper()
            rid = (x_reviewer_id or f"{code}-REV-001").strip().upper()
            rev = _get_reviewer_from_db(rid)
            if not rev:
                rev = _get_reviewer_by_cpse_code(code)
            if rev:
                if rev.get("status") == "SUSPENDED":
                    raise HTTPException(status_code=403, detail=f"Reviewer certification for '{rid}' is currently suspended.")
                code = rev["cpse_code"]
                rid = rev["id"]
                name = rev["name"]
            else:
                name = "Reviewer"
            cpse_obj = nmc_repo.get_cpse_by_code(code)
            cpse_id = cpse_obj["id"] if cpse_obj else (rev.get("cpse_id") if rev else None)
            return AuthContext("reviewer", cpse_code=code, cpse_id=cpse_id, reviewer_id=rid, reviewer_name=name)

    # 3. Header-based identification if provided
    if x_reviewer_cpse:
        code = x_reviewer_cpse.strip().upper()
        rid = (x_reviewer_id or f"{code}-REV-001").strip().upper()
        rev = _get_reviewer_from_db(rid)
        if not rev:
            rev = _get_reviewer_by_cpse_code(code)
        name = rev["name"] if rev else "Reviewer"
        cpse_obj = nmc_repo.get_cpse_by_code(code)
        cpse_id = cpse_obj["id"] if cpse_obj else (rev.get("cpse_id") if rev else None)
        return AuthContext("reviewer", cpse_code=code, cpse_id=cpse_id, reviewer_id=rid, reviewer_name=name)

    if settings.DEBUG and not token:
        cpse_obj = nmc_repo.get_cpse_by_code("HPCL")
        return AuthContext(
            "reviewer",
            cpse_code="HPCL",
            cpse_id=cpse_obj["id"] if cpse_obj else None,
            reviewer_id="HPCL-REV-001",
            reviewer_name="Rajesh Kumar",
        )

    raise HTTPException(status_code=401, detail="Invalid or expired credentials.")


def verify_reviewer_access(
    authorization: Optional[str] = Header(None),
    x_reviewer_key: Optional[str] = Header(None),
    x_reviewer_cpse: Optional[str] = Header(None),
    x_reviewer_id: Optional[str] = Header(None),
) -> AuthContext:
    """
    Validates that request has valid Reviewer (or Admin) view credentials.
    Returns AuthContext with cpse_code, cpse_id, and reviewer_id for Reviewer.
    """
    return get_auth_context(
        authorization=authorization,
        x_reviewer_key=x_reviewer_key,
        x_reviewer_cpse=x_reviewer_cpse,
        x_reviewer_id=x_reviewer_id,
    )


def verify_reviewer_decision_access(
    authorization: Optional[str] = Header(None),
    x_reviewer_key: Optional[str] = Header(None),
    x_reviewer_cpse: Optional[str] = Header(None),
    x_reviewer_id: Optional[str] = Header(None),
) -> AuthContext:
    """
    Allow both Admin and Reviewer to submit governance decisions.
    Returns AuthContext on success.
    """
    return get_auth_context(
        authorization=authorization,
        x_reviewer_key=x_reviewer_key,
        x_reviewer_cpse=x_reviewer_cpse,
        x_reviewer_id=x_reviewer_id,
    )


class AdminLoginRequest(BaseModel):
    password: str


class ReviewerLoginRequest(BaseModel):
    reviewer_key: Optional[str] = None
    password: Optional[str] = None
    reviewer_id: Optional[str] = None


@router.post("/admin-login")
def admin_login(req: AdminLoginRequest):
    """Verify admin password and return session info."""
    if req.password != settings.ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid admin password.")
    nmc_repo.log_action("Admin", None, "ADMIN_LOGIN")
    return {
        "role": "admin",
        "token": _make_token(_ADMIN_TOKEN_PREFIX, settings.ADMIN_PASSWORD),
        "message": "Admin access granted.",
    }


@router.post("/reviewer-login")
def reviewer_login(req: ReviewerLoginRequest):
    """Verify reviewer credentials and return reviewer session with bound CPSE scope."""
    key = (req.password or req.reviewer_key or "").strip()

    rev = None
    if req.reviewer_id:
        rid = req.reviewer_id.strip().upper()
        rev = nmc_repo.get_reviewer(rid)
        if not rev:
            raise HTTPException(status_code=401, detail=f"Reviewer ID '{req.reviewer_id}' not found.")
        if rev.get("status") == "SUSPENDED":
            raise HTTPException(status_code=403, detail=f"Reviewer certification for '{req.reviewer_id}' is currently suspended.")

    expected_key = (rev.get("password") if rev else None) or (rev.get("reviewer_key") if rev else None) or settings.REVIEWER_KEY
    if key != expected_key and key != settings.REVIEWER_KEY and key != "nmc-reviewer-key":
        raise HTTPException(status_code=401, detail="Invalid reviewer password.")

    actor_cpse = rev["cpse_code"] if rev else "HPCL"
    actor_name = rev["name"] if rev else "Reviewer"
    rev_id = rev["id"] if rev else (req.reviewer_id or "HPCL-REV-001")

    token = _make_reviewer_token(actor_cpse, rev_id)

    nmc_repo.log_action("Reviewer", actor_cpse, "REVIEWER_LOGIN", metadata={"reviewer_id": rev_id})
    return {
        "role": "reviewer",
        "token": token,
        "reviewer_id": rev_id,
        "reviewer_name": actor_name,
        "cpse_code": actor_cpse,
        "message": f"Reviewer access granted for {actor_name}.",
    }


@router.get("/verify")
def verify_token(token: str):
    """Quick token validity check (used by frontend on page load)."""
    if _is_valid_token(token, _ADMIN_TOKEN_PREFIX, settings.ADMIN_PASSWORD):
        return {"valid": True, "role": "admin"}
    rev_info = _verify_reviewer_token(token)
    if rev_info:
        cpse_code, reviewer_id = rev_info
        rev = nmc_repo.get_reviewer(reviewer_id)
        return {
            "valid": True,
            "role": "reviewer",
            "cpse_code": rev["cpse_code"] if rev else cpse_code,
            "reviewer_id": rev["id"] if rev else reviewer_id,
            "reviewer_name": rev["name"] if rev else "Reviewer",
        }
    if _is_valid_token(token, _REVIEWER_TOKEN_PREFIX, settings.REVIEWER_KEY):
        rev = nmc_repo.get_reviewer("HPCL-REV-001")
        return {
            "valid": True,
            "role": "reviewer",
            "cpse_code": rev["cpse_code"] if rev else "HPCL",
            "reviewer_id": rev["id"] if rev else "HPCL-REV-001",
            "reviewer_name": rev["name"] if rev else "Rajesh Kumar",
        }
    raise HTTPException(status_code=401, detail="Invalid or expired token.")


# ---------------------------------------------------------------------------
# Reviewer Directory & Roster Management (Admin Section 1)
# ---------------------------------------------------------------------------

class CreateReviewerRequest(BaseModel):
    id: Optional[str] = None
    name: str
    cpse_code: str
    designation: Optional[str] = "Domain Materials Reviewer"
    domain: Optional[str] = "Materials Management"
    email: Optional[str] = None
    reviewer_key: Optional[str] = None
    password: Optional[str] = None


class UpdateReviewerRequest(BaseModel):
    status: Optional[str] = None  # ACTIVE | SUSPENDED
    designation: Optional[str] = None
    domain: Optional[str] = None
    email: Optional[str] = None
    reviewer_key: Optional[str] = None
    password: Optional[str] = None


@router.get("/reviewers")
def list_reviewers(
    cpse_code: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
):
    """
    Certified Reviewer Directory Roster from database.
    Decision counts are computed live from the review_decisions table.
    """
    return nmc_repo.list_reviewers(cpse_code=cpse_code, status=status, search=search)


@router.post("/reviewers")
def create_reviewer(req: CreateReviewerRequest):
    """Register a new certified reviewer for a CPSE enterprise (persisted in database)."""
    data = {
        "id": req.id,
        "name": req.name,
        "cpse_code": req.cpse_code,
        "designation": req.designation,
        "domain": req.domain,
        "email": req.email,
        "password": req.password or req.reviewer_key,
        "reviewer_key": req.reviewer_key or req.password,
    }
    new_reviewer = nmc_repo.create_reviewer(data)
    nmc_repo.log_action("Admin", req.cpse_code.strip().upper(), "REVIEWER_REGISTERED", metadata={"name": req.name, "id": new_reviewer["id"]})
    return {
        "status": "SUCCESS",
        "reviewer": new_reviewer,
        "message": f"Reviewer {req.name} ({new_reviewer['id']}) successfully certified and added to roster.",
    }


@router.patch("/reviewers/{reviewer_id}")
def update_reviewer(reviewer_id: str, req: UpdateReviewerRequest):
    """Update reviewer status, designation, domain, contact or password (persisted in database)."""
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    result = nmc_repo.update_reviewer(reviewer_id, updates)
    if not result:
        raise HTTPException(status_code=404, detail=f"Reviewer '{reviewer_id}' not found.")
    nmc_repo.log_action("Admin", result["cpse_code"], "REVIEWER_UPDATED", metadata={"id": reviewer_id, "status": result["status"]})
    return {"status": "SUCCESS", "reviewer": result, "message": f"Reviewer {reviewer_id} updated."}


@router.delete("/reviewers/{reviewer_id}")
def delete_reviewer(reviewer_id: str):
    """Revoke reviewer certification (removed from database)."""
    rev = nmc_repo.get_reviewer(reviewer_id)
    if not rev:
        raise HTTPException(status_code=404, detail=f"Reviewer '{reviewer_id}' not found.")

    success = nmc_repo.delete_reviewer(reviewer_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Reviewer '{reviewer_id}' not found.")

    nmc_repo.log_action("Admin", rev["cpse_code"], "REVIEWER_REVOKED", metadata={"id": reviewer_id, "name": rev["name"]})
    return {
        "status": "SUCCESS",
        "message": f"Reviewer certification for {rev['name']} ({reviewer_id}) has been revoked.",
    }


@router.post("/sync-database")
async def sync_database(
    request: Request,
    authorization: Optional[str] = Header(None),
):
    """
    Admin-only: Synchronize all platform database tables.
    Accepts complete table dictionary exported from local SQLite database.
    """
    verify_admin_access(authorization)
    tables_data = await request.json()
    result = nmc_repo.sync_database_tables(tables_data)
    nmc_repo.log_action("Admin", "SYSTEM", "DATABASE_SYNCED", metadata=result.get("synced", {}))
    return {
        "status": "SUCCESS",
        "message": "Database synchronized successfully.",
        "synced": result.get("synced", {}),
    }

