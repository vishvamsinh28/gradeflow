from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RegisterRequest(APIModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=8, max_length=72)

    @model_validator(mode="after")
    def password_must_fit_bcrypt(self) -> "RegisterRequest":
        # bcrypt's limit is 72 *bytes*; max_length counts characters, so a short
        # password of multi-byte characters passes validation and then throws.
        if len(self.password.encode("utf-8")) > 72:
            raise ValueError("Password is too long — use fewer than 72 bytes of text")
        return self


class LoginRequest(APIModel):
    email: EmailStr
    password: str


class UserResponse(APIModel):
    id: UUID
    email: EmailStr
    full_name: str
    created_at: datetime


class AuthResponse(APIModel):
    user: UserResponse
    access_token: str
