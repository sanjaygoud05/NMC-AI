"""
NMC Auth API
Simple admin password + reviewer key authentication.
Role-based session tokens with HMAC verification and 24-hour validity window.
"""

import hmac
import hashlib
import time
from typing import Optional
from fastapi import APIRouter, HTTPException, Header
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


def _make_token_for_ts(prefix: str, secret: str, ts_bucket: int) -> str:
    sig = hmac.new(secret.encode(), str(ts_bucket).encode(), hashlib.sha256).hexdigest()[:24]
    return f"{prefix}{sig}"


def _make_token(prefix: str, secret: str) -> str:
    """Generate a deterministic HMAC token with 24-hour validity."""
    ts_bucket = int(time.time() // 86400)
    return _make_token_for_ts(prefix, secret, ts_bucket)


def _is_valid_token(token: str, prefix: str, secret: str) -> bool:
    """Check against current and previous 24-hour window."""
    if not token or not token.startswith(prefix):
        return False
    curr_bucket = int(time.time() // 86400)
    for b in (curr_bucket, curr_bucket - 1):
        if token == _make_token_for_ts(prefix, secret, b):
            return True
    return False


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

    # Direct password match allowed
    if token == settings.ADMIN_PASSWORD:
        return "admin"

    if _is_valid_token(token, _ADMIN_TOKEN_PREFIX, settings.ADMIN_PASSWORD):
        return "admin"

    # If they passed a reviewer token/key, explicitly forbid admin action
    if token == settings.REVIEWER_KEY or _is_valid_token(token, _REVIEWER_TOKEN_PREFIX, settings.REVIEWER_KEY):
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Reviewers are not authorized to perform administrative setup or modify datasets.",
        )

    raise HTTPException(status_code=401, detail="Invalid or expired admin token.")


def verify_reviewer_access(
    authorization: Optional[str] = Header(None),
    x_reviewer_key: Optional[str] = Header(None),
) -> str:
    """
    Validates that request has valid Reviewer (or Admin) view credentials.
    Used for read-only access to review queue.
    """
    token = extract_token_from_header(authorization=authorization, x_reviewer_key=x_reviewer_key)
    if not token:
        if settings.DEBUG:
            return "reviewer"
        raise HTTPException(
            status_code=401,
            detail="Reviewer credentials required. Please provide a reviewer key or token.",
        )

    if token == settings.REVIEWER_KEY or _is_valid_token(token, _REVIEWER_TOKEN_PREFIX, settings.REVIEWER_KEY):
        return "reviewer"

    if token == settings.ADMIN_PASSWORD or _is_valid_token(token, _ADMIN_TOKEN_PREFIX, settings.ADMIN_PASSWORD):
        return "admin"

    if settings.DEBUG:
        return "reviewer"

    raise HTTPException(status_code=401, detail="Invalid or expired reviewer credentials.")


def verify_reviewer_decision_access(
    authorization: Optional[str] = Header(None),
    x_reviewer_key: Optional[str] = Header(None),
) -> str:
    """
    Allow both Admin and Reviewer to submit governance decisions.
    Returns the role ('admin' or 'reviewer') on success.
    """
    token = extract_token_from_header(authorization=authorization, x_reviewer_key=x_reviewer_key)
    if not token:
        if settings.DEBUG:
            return "reviewer"
        raise HTTPException(
            status_code=401,
            detail="Credentials required to submit review decisions.",
        )

    # Admin can also submit decisions
    if token == settings.ADMIN_PASSWORD or _is_valid_token(token, _ADMIN_TOKEN_PREFIX, settings.ADMIN_PASSWORD):
        return "admin"

    if token == settings.REVIEWER_KEY or _is_valid_token(token, _REVIEWER_TOKEN_PREFIX, settings.REVIEWER_KEY):
        return "reviewer"

    if settings.DEBUG:
        return "reviewer"

    raise HTTPException(status_code=401, detail="Invalid or expired credentials.")


class AdminLoginRequest(BaseModel):
    password: str


class ReviewerLoginRequest(BaseModel):
    reviewer_key: str


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
    """Verify reviewer key and return reviewer session."""
    if req.reviewer_key != settings.REVIEWER_KEY:
        raise HTTPException(status_code=401, detail="Invalid reviewer key.")
    nmc_repo.log_action("Reviewer", None, "REVIEWER_LOGIN")
    return {
        "role": "reviewer",
        "token": _make_token(_REVIEWER_TOKEN_PREFIX, settings.REVIEWER_KEY),
        "message": "Reviewer access granted.",
    }


@router.get("/verify")
def verify_token(token: str):
    """Quick token validity check (used by frontend on page load)."""
    if _is_valid_token(token, _ADMIN_TOKEN_PREFIX, settings.ADMIN_PASSWORD):
        return {"valid": True, "role": "admin"}
    if _is_valid_token(token, _REVIEWER_TOKEN_PREFIX, settings.REVIEWER_KEY):
        return {"valid": True, "role": "reviewer"}
    raise HTTPException(status_code=401, detail="Invalid or expired token.")
