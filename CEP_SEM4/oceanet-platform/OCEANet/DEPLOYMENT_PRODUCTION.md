# OCEANet 24/7 Production Deployment

This repo is now configured for always-on deployment with persistent backend data.

## What Is Already Configured

- Render blueprint in OCEANet/render.yaml now uses always-on starter plans for both services.
- Backend has a persistent disk mount at /var/data.
- Backend data path is configurable with OCEANET_DATA_ROOT and set to /var/data in Render.
- Auto deploy is enabled for both services.
- Dataset refresh is configured for near real-time polling with OCEANET_DATASET_REFRESH_INTERVAL_SECONDS=60.
- Backend startup now applies DB migrations automatically before serving traffic.
- CI pipeline is configured in .github/workflows/ci.yml.

## Deploy Now (Single Provider: Render)

1. Push this project to GitHub.
2. In Render, create a new Blueprint deployment.
3. Select your repo and choose OCEANet/render.yaml.
4. Deploy.
5. Wait for both services:
   - oceanet-backend
   - oceanet-frontend

## Required Post-Deploy Env Wiring

After frontend URL is generated, set these backend variables in Render and redeploy backend once:

- OCEANET_CORS_ALLOWED_ORIGINS=https://your-frontend-domain
- OCEANET_FRONTEND_PUBLIC_BASE_URL=https://your-frontend-domain

Set this frontend variable in Render if still using placeholder:

- NEXT_PUBLIC_API_BASE_URL=https://your-backend-domain

## Production URLs To Check

- Backend health: https://your-backend-domain/health
- Backend readiness: https://your-backend-domain/ready
- Backend API docs: https://your-backend-domain/docs
- Frontend app: https://your-frontend-domain/analytics

## Admin Setup (Optional but Recommended)

Set these on backend service:

- OCEANET_ADMIN_SIGNUP_KEY=your-strong-secret
- OCEANET_ADMIN_EMAILS=email1@example.com,email2@example.com
- OCEANET_GFW_API_TOKEN=your-global-fishing-watch-token

## Why This Stays Online 24/7

- Starter plan web services do not sleep.
- Backend SQLite, datasets, and reports are written to mounted persistent storage.
- Every git push triggers automatic redeploy.

## Migration and Release Notes

- Runtime schema upgrades are managed with Alembic.
- Render backend startup command runs `alembic upgrade head` before booting Gunicorn/Uvicorn workers.
- Keep secrets in provider-managed environment variables and avoid committing real credentials.

## Recommended Upgrade Path

For larger scale, move auth and analytics storage to managed Postgres and store large report files in object storage.
