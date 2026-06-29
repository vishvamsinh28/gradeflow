import os

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SECRET_KEY", "test-key")
os.environ.setdefault("JWT_SECRET", "a-test-secret-that-is-long-enough")
os.environ.setdefault("GEMINI_API_KEY", "test-key")
os.environ.setdefault("LANGSMITH_TRACING", "true")
os.environ.setdefault("LANGSMITH_API_KEY", "test-key")
os.environ.setdefault("LANGSMITH_PROJECT", "gradeflow-test")

from app.core.security import create_access_token, decode_access_token, hash_password, verify_password


def test_password_round_trip():
    hashed = hash_password("correct-horse-battery-staple")
    assert hashed != "correct-horse-battery-staple"
    assert verify_password("correct-horse-battery-staple", hashed)
    assert not verify_password("wrong-password", hashed)


def test_jwt_round_trip():
    token = create_access_token("user-123", {"email": "teacher@example.com"})
    payload = decode_access_token(token)
    assert payload["sub"] == "user-123"
    assert payload["email"] == "teacher@example.com"
