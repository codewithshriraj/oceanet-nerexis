"""
API v1 Router Factory
- Centralized route registration
- Version management
- Response envelope wrapper
"""

from fastapi import APIRouter, Request
from typing import Callable, Any
from functools import wraps

from app.core.schemas import APIResponse, ErrorCode
import uuid


def create_v1_api_router(prefix: str = "/api/v1") -> APIRouter:
    """
    Create an APIRouter with v1 prefix and response envelope support.
    
    Usage:
        router = create_v1_api_router()
        
        @router.get("/data")
        async def get_data() -> APIResponse[dict]:
            return APIResponse.success(data={"key": "value"})
    """
    return APIRouter(prefix=prefix, tags=["v1"])


def wrap_endpoint_with_envelope(func: Callable) -> Callable:
    """
    Decorator to automatically add request_id to responses.
    
    Usage:
        @router.get("/endpoint")
        @wrap_endpoint_with_envelope
        async def my_endpoint():
            return APIResponse.success(data={...})
    """
    @wraps(func)
    async def wrapper(*args, request: Request = None, **kwargs):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        
        # Call original function
        result = await func(*args, **kwargs) if hasattr(func, "__call__") else func(*args, **kwargs)
        
        # Add request_id to response if it's an APIResponse
        if isinstance(result, APIResponse):
            result.request_id = request_id
        
        return result
    
    return wrapper
