from typing import Any, TypeVar

from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError

T = TypeVar("T")


def get_legacy_module() -> Any:
    from .. import main as legacy

    return legacy


def parse_request_model(model_cls: type[T], payload: dict[str, Any]) -> T:
    try:
        return model_cls(**payload)
    except ValidationError as exc:
        raise RequestValidationError(exc.errors()) from exc
