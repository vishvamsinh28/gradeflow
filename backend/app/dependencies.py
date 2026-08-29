from typing import Any

from fastapi import Cookie, Depends, Header, HTTPException
from supabase import Client

from app.core.security import decode_access_token
from app.db.supabase import get_supabase


def get_token(
    access_token: str | None = Cookie(default=None),
    authorization: str | None = Header(default=None),
) -> str:
    if access_token:
        return access_token
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1]
    raise HTTPException(status_code=401, detail="Authentication required")


def get_current_user(
    token: str = Depends(get_token),
    db: Client = Depends(get_supabase),
) -> dict[str, Any]:
    payload = decode_access_token(token)
    response = db.table("users").select("id,email,full_name,created_at").eq("id", payload["sub"]).limit(1).execute()
    if not response.data:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return response.data[0]
