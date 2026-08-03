# Backend Engineering Upgrade

This backend now includes production-grade foundations.

## 1. Module Boundaries

- Core infrastructure is separated under `app/core`:
  - `config.py` for environment-driven settings
  - `security.py` for auth token/password primitives
  - `logging_config.py` for centralized logging
  - `middleware.py` for request tracing/security headers
  - `errors.py` for global exception handling
- API ops endpoints are grouped in `app/routers/health.py`.

## 2. Auth and Validation

- Password hashing and bearer parsing are centralized in `app/core/security.py`.
- Request validation failures now return a standard JSON structure from a global handler.

## 3. Logging and Monitoring

- Request/response timing is logged with `x-request-id` correlation.
- New operational endpoints:
  - `GET /health`
  - `GET /ready`

## 4. Tests

- Added smoke + auth + validation tests in `tests/test_api_smoke.py`.
- Run locally:

```bash
pytest
```

## 5. CI/CD

- Added GitHub Actions workflow: `.github/workflows/ci.yml`
- Pipeline runs:
  - Backend dependency install
  - DB migrations (`alembic upgrade head`)
  - Backend tests (`pytest`)
  - Frontend typecheck and build

## 6. DB Migrations

- Alembic is configured (`alembic.ini`, `alembic/env.py`).
- Baseline migration created in `alembic/versions/20260401_0001_baseline.py`.
- Run migrations:

```bash
alembic upgrade head
```

## 7. Environment-based Config

- Added `.env.example` with production-safe placeholders.
- Keep real secrets only in `.env` or platform secret stores.
