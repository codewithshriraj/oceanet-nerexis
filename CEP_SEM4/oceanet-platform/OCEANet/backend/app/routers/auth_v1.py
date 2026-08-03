"""
JWT-Based Authentication Router (v1)
- Modern JWT token-based authentication
- Refresh token mechanism
- User registration and login
- Token validation and claims extraction
"""

from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
import hashlib
import secrets

from app.core.jwt_handler import (
    create_access_token,
    create_refresh_token,
    verify_token,
    refresh_access_token,
    get_current_user,
    TokenClaims,
)
from app.core.schemas import APIResponse, ErrorCode, AuthTokenResponse
from app.core.config import settings

router = APIRouter(prefix="/api/v1/auth", tags=["auth-v1"])


# ============================================================================
# Request/Response Models
# ============================================================================

class SignUpRequest(BaseModel):
    """User registration request"""
    name: str = Field(..., min_length=1, max_length=255, description="User's full name")
    email: EmailStr = Field(..., description="User's email address")
    password: str = Field(..., min_length=8, max_length=128, description="Password (min 8 chars)")
    signup_key: Optional[str] = Field(default=None, description="Admin signup key (if registering as admin)")


class SignInRequest(BaseModel):
    """User login request"""
    email: EmailStr = Field(..., description="User's email address")
    password: str = Field(..., description="User's password")


class RefreshTokenRequest(BaseModel):
    """Refresh token request"""
    refresh_token: str = Field(..., description="Valid refresh token")


class ChangePasswordRequest(BaseModel):
    """Change password request"""
    old_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, max_length=128, description="New password")


class UserInfo(BaseModel):
    """User information"""
    id: str
    email: str
    name: str
    roles: list = []
    created_at: Optional[str] = None


# ============================================================================
# In-Memory User Store (Replace with database in production)
# ============================================================================
# For development only - use actual database in production

users_db: dict = {}
sessions_db: dict = {}


def hash_password(password: str) -> str:
    """Hash password using PBKDF2"""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 200_000)
    return f"{salt}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify password against hash"""
    try:
        salt, expected_hex = stored_hash.split("$", 1)
    except ValueError:
        return False
    
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 200_000)
    return secrets.compare_digest(candidate.hex(), expected_hex)


# ============================================================================
# Authentication Endpoints
# ============================================================================

@router.post("/signup", response_model=APIResponse[AuthTokenResponse])
async def signup(request: SignUpRequest) -> APIResponse[AuthTokenResponse]:
    """
    Register a new user.
    
    - **name**: User's full name
    - **email**: Unique email address
    - **password**: Password (minimum 8 characters)
    - **signup_key**: Admin signup key (optional, for admin registration)
    """
    # Validate email uniqueness
    if any(u["email"].lower() == request.email.lower() for u in users_db.values()):
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )
    
    # Check admin signup key
    roles = ["user"]
    if request.signup_key:
        if request.signup_key == settings.admin_signup_key:
            roles = ["user", "admin"]
        else:
            raise HTTPException(status_code=400, detail="Invalid admin signup key")
    
    # Create user
    user_id = secrets.token_hex(8)
    users_db[user_id] = {
        "id": user_id,
        "name": request.name,
        "email": request.email,
        "password_hash": hash_password(request.password),
        "roles": roles,
        "scopes": ["read:datasets", "read:reports", "read:analytics"],
    }
    
    # Generate tokens
    access_token = create_access_token(
        user_id=user_id,
        email=request.email,
        roles=roles,
    )
    refresh_token = create_refresh_token(user_id=user_id, email=request.email)
    
    return APIResponse.success(
        data=AuthTokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=15 * 60,  # 15 minutes in seconds
            user_id=user_id,
            email=request.email,
        )
    )


@router.post("/signin", response_model=APIResponse[AuthTokenResponse])
async def signin(request: SignInRequest) -> APIResponse[AuthTokenResponse]:
    """
    Log in with email and password.
    
    Returns access token and refresh token.
    """
    # Find user by email
    user = None
    for u in users_db.values():
        if u["email"].lower() == request.email.lower():
            user = u
            break
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password
    if not verify_password(request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Generate tokens
    access_token = create_access_token(
        user_id=user["id"],
        email=user["email"],
        roles=user.get("roles", ["user"]),
    )
    refresh_token = create_refresh_token(user_id=user["id"], email=user["email"])
    
    return APIResponse.success(
        data=AuthTokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=15 * 60,
            user_id=user["id"],
            email=user["email"],
        )
    )


@router.post("/refresh", response_model=APIResponse[AuthTokenResponse])
async def refresh(request: RefreshTokenRequest) -> APIResponse[AuthTokenResponse]:
    """
    Refresh access token using refresh token.
    
    Returns new access and refresh tokens.
    """
    token_payload = refresh_access_token(request.refresh_token)
    
    # Extract user info from token
    claims = verify_token(request.refresh_token, token_type="refresh")
    
    return APIResponse.success(
        data=AuthTokenResponse(
            access_token=token_payload.access_token,
            refresh_token=token_payload.refresh_token,
            expires_in=token_payload.expires_in,
            user_id=claims.sub,
            email=claims.email,
        )
    )


@router.get("/me", response_model=APIResponse[UserInfo])
async def get_current_user_info(
    user: TokenClaims = Depends(get_current_user),
) -> APIResponse[UserInfo]:
    """
    Get current authenticated user's information.
    
    Requires valid JWT access token in Authorization header.
    """
    user_data = users_db.get(user.sub, {})
    
    return APIResponse.success(
        data=UserInfo(
            id=user.sub,
            email=user.email,
            name=user_data.get("name", "Unknown"),
            roles=user.roles,
            created_at=user_data.get("created_at"),
        )
    )


@router.post("/logout", response_model=APIResponse)
async def logout(
    user: TokenClaims = Depends(get_current_user),
) -> APIResponse:
    """
    Log out (invalidate) current session.
    
    Note: JWTs are stateless, so logout is mainly for audit purposes.
    You may want to implement token blacklisting for production.
    """
    # In production, add token to blacklist or revocation list
    return APIResponse.success(data={"message": "Logged out successfully"})


@router.post("/change-password", response_model=APIResponse)
async def change_password(
    request: ChangePasswordRequest,
    user: TokenClaims = Depends(get_current_user),
) -> APIResponse:
    """
    Change user password.
    
    Requires current password for verification.
    """
    user_data = users_db.get(user.sub)
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify old password
    if not verify_password(request.old_password, user_data["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid current password")
    
    # Update password
    user_data["password_hash"] = hash_password(request.new_password)
    
    return APIResponse.success(data={"message": "Password changed successfully"})
