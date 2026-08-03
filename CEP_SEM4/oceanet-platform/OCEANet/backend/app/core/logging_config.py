import logging
from logging.config import dictConfig

from .config import settings


def configure_logging() -> None:
    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": "%(asctime)s %(levelname)s %(name)s request_id=%(request_id)s %(message)s",
                },
            },
            "filters": {
                "request_context": {
                    "()": "app.core.middleware.RequestContextFilter",
                },
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                    "filters": ["request_context"],
                },
            },
            "root": {
                "handlers": ["console"],
                "level": settings.log_level,
            },
        }
    )
    logging.getLogger(__name__).info("logging configured", extra={"request_id": "-"})
