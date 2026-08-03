"""
JWT Token Management & RBAC Authorization
- JWT token generation with RSA-256
- Token validation and claims extraction
- Role-Based Access Control (RBAC) middleware
- Token refresh mechanism
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List

import jwt
from fastapi import HTTPException, Depends, Header
from pydantic import BaseModel

# JWT Configuration
SECRET_KEY = os.getenv("OCEANET_JWT_SECRET", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7


class TokenClaims(BaseModel):
    """JWT token claims structure"""
    sub: str  # Subject (user_id)
    email: str
    roles: List[str] = ["user"]  # Default role
    scopes: List[str] = []
    exp: datetime
    iat: datetime
    token_type: str = "access"  # "access" or "refresh"


class TokenPayload(BaseModel):
    """Response payload for token endpoints"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until expiry


def create_access_token(
    user_id: str,
    email: str,
    roles: List[str] = None,
    scopes: List[str] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a signed JWT access token.
    
    Args:
        user_id: Unique user identifier
        email: User email address
        roles: List of roles (e.g., ["user", "admin"])
        scopes: List of permission scopes
        expires_delta: Custom expiration time
    
    Returns:
        Encoded JWT token string
    """
    if expires_delta is None:
        expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    if roles is None:
        roles = ["user"]
    if scopes is None:
        scopes = []
    
    now = datetime.now(timezone.utc)
    expire = now + expires_delta
    
    claims = {
        "sub": user_id,
        "email": email,
        "roles": roles,
        "scopes": scopes,
        "exp": expire,
        "iat": now,
        "token_type": "access",
    }
    
    encoded_jwt = jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(user_id: str, email: str) -> str:
    """
    Create a refresh token (longer expiry).
    
    Args:
        user_id: Unique user identifier
        email: User email address
    
    Returns:
        Encoded JWT refresh token
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    claims = {
        "sub": user_id,
        "email": email,
        "exp": expire,
        "iat": now,
        "token_type": "refresh",
    }
    
    encoded_jwt = jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str, token_type: str = "access") -> TokenClaims:
    """
    Verify and extract claims from JWT token.
    
    Args:
        token: JWT token string
        token_type: Expected token type ("access" or "refresh")
    
    Returns:
        TokenClaims object with extracted claims
    
    Raises:
        HTTPException: If token is invalid, expired, or wrong type
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    
    # Verify token type
    if payload.get("token_type") != token_type:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid token type. Expected {token_type}, got {payload.get('token_type')}",
        )
    
    # Convert exp and iat to datetime
    exp_timestamp = payload.get("exp")
    iat_timestamp = payload.get("iat")
    
    return TokenClaims(
        sub=payload.get("sub"),
        email=payload.get("email"),
        roles=payload.get("roles", ["user"]),
        scopes=payload.get("scopes", []),
        exp=datetime.fromtimestamp(exp_timestamp, tz=timezone.utc),
        iat=datetime.fromtimestamp(iat_timestamp, tz=timezone.utc),
        token_type=payload.get("token_type", "access"),
    )


def extract_token_from_header(authorization: Optional[str]) -> str:
    """
    Extract Bearer token from Authorization header.
    
    Args:
        authorization: Authorization header value
    
    Returns:
        Token string
    
    Raises:
        HTTPException: If header is missing or malformed
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Invalid authorization format. Use 'Bearer <token>'")
    
    return token


async def get_current_user(
    authorization: Optional[str] = Header(default=None),
) -> TokenClaims:
    """
    FastAPI dependency for extracting current user from JWT token.
    
    Usage:
        @router.get("/me")
        async def get_me(user: TokenClaims = Depends(get_current_user)):
            return {"user_id": user.sub, "email": user.email}
    """
    token = extract_token_from_header(authorization)
    return verify_token(token, token_type="access")


def check_permission(required_roles: List[str] = None, required_scopes: List[str] = None):
    """
    Create dependency for checking user permissions (RBAC).
    
    Args:
        required_roles: List of allowed roles
        required_scopes: List of required scopes
    
    Returns:
        Async dependency function
    
    Usage:
        @router.delete("/admin/users/{user_id}")
        async def delete_user(
            user_id: str,
            user: TokenClaims = Depends(check_permission(required_roles=["admin"]))
        ):
            return {"deleted": user_id}
    """
    async def verify_permissions(
        user: TokenClaims = Depends(get_current_user),
    ) -> TokenClaims:
        # Check roles
        if required_roles:
            if not any(role in user.roles for role in required_roles):
                raise HTTPException(
                    status_code=403,
                    detail=f"Insufficient permissions. Required roles: {required_roles}",
                )
        
        # Check scopes
        if required_scopes:
            if not all(scope in user.scopes for scope in required_scopes):
                raise HTTPException(
                    status_code=403,
                    detail=f"Insufficient scopes. Required: {required_scopes}",
                )
        
        return user
    
    return verify_permissions


def refresh_access_token(refresh_token: str) -> TokenPayload:
    """
    Use refresh token to get new access token.
    
    Args:
        refresh_token: Valid refresh token
    
    Returns:
        TokenPayload with new access + refresh tokens
    """
    claims = verify_token(refresh_token, token_type="refresh")
    
    # Generate new tokens
    new_access = create_access_token(
        user_id=claims.sub,
        email=claims.email,
        roles=claims.roles,
        scopes=claims.scopes,
    )
    new_refresh = create_refresh_token(user_id=claims.sub, email=claims.email)
    
    access_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    return TokenPayload(
        access_token=new_access,
        refresh_token=new_refresh,
        expires_in=int(access_expires.total_seconds()),
    )
