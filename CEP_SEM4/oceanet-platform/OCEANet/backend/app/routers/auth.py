from typing import Any

from fastapi import APIRouter, Header

from ..services.legacy_bridge import get_legacy_module, parse_request_model

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup")
async def signup(payload: dict[str, Any]):
    legacy = get_legacy_module()
    request_model = parse_request_model(legacy.SignUpRequest, payload)
    return await legacy.signup(request_model)


@router.post("/signin")
async def signin(payload: dict[str, Any]):
    legacy = get_legacy_module()
    request_model = parse_request_model(legacy.SignInRequest, payload)
    return await legacy.signin(request_model)


@router.get("/me")
async def me(authorization: str | None = Header(default=None)):
    legacy = get_legacy_module()
    return await legacy.me(authorization=authorization)


@router.post("/signout")
async def signout(authorization: str | None = Header(default=None)):
    legacy = get_legacy_module()
    return await legacy.signout(authorization=authorization)
