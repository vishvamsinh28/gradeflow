from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from postgrest.exceptions import APIError
from supabase import Client

from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.supabase import get_supabase
from app.dependencies import get_current_user
from app.models.schemas import AuthResponse, LoginRequest, RegisterRequest, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def handle_database_error(error: APIError) -> None:
    if error.code == "PGRST205":
        raise HTTPException(
            status_code=503,
            detail="Supabase schema is not ready. Run make db-setup from the project root, then retry.",
        ) from error
    if error.code == "42501":
        raise HTTPException(
            status_code=503,
            detail="Supabase rejected the database request because row-level security blocked it. Set backend/.env SUPABASE_SECRET_KEY to your server-only Supabase service role/secret key, restart the backend, and retry.",
        ) from error
    if error.code == "23505":
        raise HTTPException(status_code=409, detail="An account with this email already exists") from error
    raise error


def set_auth_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    max_age = settings.access_token_expire_minutes * 60
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=max_age,
        expires=datetime.now(timezone.utc) + timedelta(seconds=max_age),
        path="/",
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, response: Response, db: Client = Depends(get_supabase)):
    email = payload.email.lower()
    try:
        existing = db.table("users").select("id").eq("email", email).limit(1).execute()
    except APIError as error:
        handle_database_error(error)
    if existing.data:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    try:
        user_response = db.table("users").insert(
            {
                "email": email,
                "full_name": payload.full_name.strip(),
                "password_hash": hash_password(payload.password),
            }
        ).execute()
    except APIError as error:
        handle_database_error(error)
    user = user_response.data[0]
    token = create_access_token(user["id"], {"email": user["email"]})
    set_auth_cookie(response, token)
    return {"user": user, "access_token": token}


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, response: Response, db: Client = Depends(get_supabase)):
    try:
        result = db.table("users").select("*").eq("email", payload.email.lower()).limit(1).execute()
    except APIError as error:
        handle_database_error(error)
    if not result.data or not verify_password(payload.password, result.data[0]["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    user = result.data[0]
    token = create_access_token(user["id"], {"email": user["email"]})
    set_auth_cookie(response, token)
    return {"user": user, "access_token": token}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    settings = get_settings()
    response.delete_cookie(
        "access_token",
        path="/",
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )


@router.get("/me", response_model=UserResponse)
def me(user=Depends(get_current_user)):
    return user
