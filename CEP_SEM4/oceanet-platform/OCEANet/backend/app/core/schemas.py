"""
Standardized API Response Models
- Response envelope with status, data, errors
- Error code definitions
- Pagination support
"""

from typing import Any, Generic, List, Optional, TypeVar
from enum import Enum
from pydantic import BaseModel, Field


class ErrorCode(str, Enum):
    """Standardized error codes for API responses"""
    # Authentication errors (4000-4099)
    AUTH_REQUIRED = "ERR_AUTH_REQUIRED"
    AUTH_INVALID = "ERR_AUTH_INVALID"
    AUTH_EXPIRED = "ERR_AUTH_EXPIRED"
    AUTH_INSUFFICIENT_PERMISSIONS = "ERR_INSUFFICIENT_PERMISSIONS"
    AUTH_INVALID_CREDENTIALS = "ERR_INVALID_CREDENTIALS"
    
    # Validation errors (4100-4199)
    VALIDATION_FAILED = "ERR_VALIDATION_FAILED"
    INVALID_INPUT = "ERR_INVALID_INPUT"
    INVALID_FORMAT = "ERR_INVALID_FORMAT"
    
    # Resource errors (4200-4299)
    NOT_FOUND = "ERR_NOT_FOUND"
    ALREADY_EXISTS = "ERR_ALREADY_EXISTS"
    CONFLICT = "ERR_CONFLICT"
    
    # Business logic errors (4300-4399)
    OPERATION_FAILED = "ERR_OPERATION_FAILED"
    INVALID_STATE = "ERR_INVALID_STATE"
    QUOTA_EXCEEDED = "ERR_QUOTA_EXCEEDED"
    RATE_LIMITED = "ERR_RATE_LIMITED"
    
    # Server errors (5000+)
    INTERNAL_ERROR = "ERR_INTERNAL_ERROR"
    SERVICE_UNAVAILABLE = "ERR_SERVICE_UNAVAILABLE"
    DATABASE_ERROR = "ERR_DATABASE_ERROR"


class ErrorDetail(BaseModel):
    """Individual error detail"""
    code: ErrorCode
    message: str
    field: Optional[str] = None  # For validation errors
    context: Optional[dict] = None  # Additional error context


T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    """
    Standard API response envelope.
    
    Example success response:
        {
            "status": "success",
            "data": {...},
            "errors": [],
            "request_id": "abc-123"
        }
    
    Example error response:
        {
            "status": "error",
            "data": null,
            "errors": [
                {
                    "code": "ERR_VALIDATION_FAILED",
                    "message": "Invalid email format",
                    "field": "email"
                }
            ],
            "request_id": "abc-123"
        }
    """
    status: str = Field(..., description="Response status: 'success' or 'error'")
    data: Optional[T] = Field(default=None, description="Response data")
    errors: List[ErrorDetail] = Field(default_factory=list, description="List of errors")
    request_id: Optional[str] = Field(default=None, description="Request correlation ID")
    
    @classmethod
    def success(cls, data: Any = None, request_id: Optional[str] = None):
        """Create success response"""
        return cls(status="success", data=data, errors=[], request_id=request_id)
    
    @classmethod
    def error(
        cls,
        code: ErrorCode,
        message: str,
        request_id: Optional[str] = None,
        field: Optional[str] = None,
        context: Optional[dict] = None,
    ):
        """Create error response"""
        return cls(
            status="error",
            data=None,
            errors=[ErrorDetail(code=code, message=message, field=field, context=context)],
            request_id=request_id,
        )


class PaginatedResponse(BaseModel, Generic[T]):
    """
    Paginated response with metadata.
    
    Example:
        {
            "status": "success",
            "data": [...],
            "pagination": {
                "total": 150,
                "page": 1,
                "page_size": 20,
                "total_pages": 8,
                "has_next": true,
                "has_prev": false
            },
            "request_id": "abc-123"
        }
    """
    status: str = "success"
    data: List[T]
    pagination: Optional[dict] = Field(default=None)
    request_id: Optional[str] = None
    
    @classmethod
    def create(
        cls,
        items: List[T],
        total: int,
        page: int,
        page_size: int,
        request_id: Optional[str] = None,
    ):
        """Create paginated response"""
        total_pages = (total + page_size - 1) // page_size
        return cls(
            status="success",
            data=items,
            pagination={
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1,
            },
            request_id=request_id,
        )


class AuthTokenResponse(BaseModel):
    """Response for authentication endpoints"""
    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(..., description="Access token expiry in seconds")
    user_id: str = Field(..., description="Authenticated user ID")
    email: str = Field(..., description="User email")
