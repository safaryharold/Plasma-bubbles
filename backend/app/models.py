"""Pydantic request/response models."""
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from typing import Optional, List, Any
from datetime import datetime
import re


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128, description="Password must be at least 8 characters with uppercase, lowercase, number, and special character")
    name: str = Field(min_length=1, max_length=80)
    role: Optional[str] = Field(default="researcher", pattern="^(researcher|pro)$")

    @field_validator("password")
    @classmethod
    def _strong_password(cls, v: str) -> str:
        if not re.search(r"[a-z]", v): raise ValueError("password must contain a lowercase letter")
        if not re.search(r"[A-Z]", v): raise ValueError("password must contain an uppercase letter")
        if not re.search(r"\d", v): raise ValueError("password must contain a digit")
        if not re.search(r"[@$!%*?&]", v): raise ValueError("password must contain a special character (@$!%*?&)")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str
    usage_count: int = 0
    created_at: Optional[str] = None


class AuthResponse(BaseModel):
    user: UserOut
    access_token: str
    token_type: str = "bearer"


# ---------- IBP ----------
class IBPCalculateRequest(BaseModel):
    day_month: int = Field(..., ge=1, le=366, description="Month 1-12, or day-of-year 13-366")
    lon: float = Field(..., ge=-180, le=180)
    lt: float = Field(..., ge=0, le=24)
    f107: float = Field(..., ge=60, le=300)


class IBPCalculateResult(BaseModel):
    doy: int
    month: int
    lon: float
    lt: float
    f107: float
    ibp: float
    confidence: float
    anomaly_flag: bool
    explanation: str


class IBPBatchRequest(BaseModel):
    name: Optional[str] = None
    day_month: int = Field(..., ge=1, le=366)
    f107: float = Field(..., ge=60, le=300)
    lon_min: float = Field(-180, ge=-180, le=180)
    lon_max: float = Field(180, ge=-180, le=180)
    lon_step: float = Field(10, gt=0, le=360)
    lt_min: float = Field(18, ge=0, le=24)
    lt_max: float = Field(24, ge=0, le=24)
    lt_step: float = Field(0.5, gt=0, le=24)


class JobOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    type: str
    status: str
    name: Optional[str] = None
    params: dict
    config_hash: str
    cells: int
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error: Optional[str] = None
    summary: Optional[dict] = None
    worker: Optional[str] = None
    task_id: Optional[str] = None


# ---------- Experiments ----------
class ExperimentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    params: dict


class ExperimentOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    params: dict
    config_hash: str
    created_at: str


# ---------- API Keys ----------
class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class ApiKeyOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    key_prefix: str
    created_at: str
    last_used: Optional[str] = None
    call_count: int = 0
    revoked: bool = False


class ApiKeyCreated(ApiKeyOut):
    raw_key: str  # shown ONCE at creation
