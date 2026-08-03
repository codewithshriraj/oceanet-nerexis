# Phase 1 Quick Reference - Commands & Configuration

## 🚀 Quick Start

### Option A: Docker (Recommended)
```bash
cd oceanet-platform/OCEANet
docker-compose up -d
# Services ready at:
# Backend: http://localhost:8000
# Frontend: http://localhost:3000
# Database UI: http://localhost:8080
```

### Option B: Local Development
```bash
# Terminal 1: Backend
cd backend
pip install -r requirements.txt
alembic upgrade head
python -m uvicorn app.main:app --reload

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

---

## 🔐 JWT Authentication Examples

### Signup
```bash
curl -X POST http://localhost:8000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123!",
    "signup_key": "optional-admin-key"
  }'

# Response:
{
  "status": "success",
  "data": {
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "token_type": "bearer",
    "expires_in": 900,
    "user_id": "abc123...",
    "email": "john@example.com"
  }
}
```

### Login
```bash
curl -X POST http://localhost:8000/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

### Use Access Token
```bash
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc..."
```

### Refresh Token
```bash
curl -X POST http://localhost:8000/api/v1/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."}'
```

---

## 🗄️ Database Configuration

### SQLite (Development - No Setup Needed)
```bash
# Just works! Data stored in ./data/oceanet.db
# Run migrations:
cd backend
alembic upgrade head
```

### PostgreSQL (Production)
```bash
# Prerequisites
# 1. PostgreSQL installed and running
# 2. Database created: createdb oceanet_prod

# Configuration (.env)
OCEANET_DB_TYPE=postgres
OCEANET_DB_HOST=localhost
OCEANET_DB_PORT=5432
OCEANET_DB_USER=oceanet
OCEANET_DB_PASSWORD=your-secure-password
OCEANET_DB_NAME=oceanet_prod

# Run migrations
cd backend
alembic upgrade head

# Verify
psql -U oceanet -d oceanet_prod -c "\dt"
# Should show: users, sessions, audit_logs, datasets, reports
```

---

## 🔑 Secrets Management

### Development (Environment Variables)
```bash
# .env file
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
OCEANET_JWT_SECRET=your-secret-key
```

### Production (HashiCorp Vault)
```bash
# Setup Vault
vault server -dev

# Configuration (.env)
OCEANET_VAULT_ENABLED=1
OCEANET_VAULT_ADDR=http://localhost:8200
OCEANET_VAULT_TOKEN=hvs.xxx

# Secrets stored at:
# secret/data/oceanet/openai_api_key
# secret/data/oceanet/gemini_api_key
# etc.

# Add secrets to Vault
vault kv put secret/oceanet/openai_api_key value=sk-...
vault kv put secret/oceanet/gemini_api_key value=...
```

### Production (AWS Secrets Manager)
```bash
# Configuration (.env)
OCEANET_AWS_SECRETS_ENABLED=1
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Create secrets via CLI
aws secretsmanager create-secret \
  --name oceanet/openai_api_key \
  --secret-string '{"openai_api_key":"sk-..."}'
```

---

## 🐳 Docker Commands

### Build Images
```bash
# Backend
docker build -t oceanet-backend:1.0 ./backend

# Frontend
docker build -t oceanet-frontend:1.0 ./frontend
```

### Run Stack
```bash
docker-compose up -d                    # Start all services
docker-compose down                     # Stop all services
docker-compose logs -f backend          # View backend logs
docker-compose exec postgres psql -U oceanet -d oceanet_dev  # Access DB
```

### Clean Up
```bash
docker-compose down -v                  # Remove volumes too
docker system prune -a                  # Clean unused images
```

---

## 📊 Database Queries

### Check Users Table
```sql
SELECT id, email, name, roles FROM users;
```

### Check Sessions
```sql
SELECT id, user_id, is_active, created_at, expires_at FROM sessions;
```

### View Audit Logs
```sql
SELECT user_id, action, resource_type, created_at, status FROM audit_logs ORDER BY created_at DESC;
```

---

## 🧪 Testing

### Run Tests
```bash
cd backend
pytest tests/test_api_smoke.py -v
pytest tests/ -v --cov=app    # With coverage
```

### Manual Testing
```bash
# Health check
curl http://localhost:8000/health

# API docs (Swagger UI)
http://localhost:8000/docs

# API docs (ReDoc)
http://localhost:8000/redoc
```

---

## 📝 Environment Variables

### Critical (Must Set)
```
OCEANET_JWT_SECRET         # JWT signing key (min 32 chars)
OCEANET_DB_PASSWORD        # Database password (if PostgreSQL)
```

### Important (Recommended)
```
OCEANET_ENV=production     # Set to production
OCEANET_DEBUG=0            # Disable debug mode
OCEANET_DB_TYPE=postgres   # Use PostgreSQL
OCEANET_VAULT_ENABLED=1    # Enable secrets vault
OCEANET_CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

### Optional (With Defaults)
```
OCEANET_LOG_LEVEL=INFO
OCEANET_ACCESS_TOKEN_EXPIRE_MINUTES=15
OCEANET_REFRESH_TOKEN_EXPIRE_DAYS=7
```

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| `PostgreSQL connection refused` | Check OCEANET_DB_HOST, OCEANET_DB_PORT, database exists |
| `JWT secret too short` | Generate with: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `Docker build fails` | Clear cache: `docker-compose down -v`, rebuild |
| `401 Unauthorized` | Check `Authorization: Bearer <token>` header format |
| `Token expired` | Use refresh token endpoint to get new token |
| `Database locked (SQLite)` | Stop other processes, delete `oceanet.db-wal` and `oceanet.db-shm` |

---

## 📚 Useful Links

- **JWT Docs**: https://tools.ietf.org/html/rfc7519
- **FastAPI**: https://fastapi.tiangolo.com
- **SQLAlchemy**: https://docs.sqlalchemy.org
- **Alembic**: https://alembic.sqlalchemy.org
- **HashiCorp Vault**: https://www.vaultproject.io
- **AWS Secrets Manager**: https://aws.amazon.com/secrets-manager

---

## ✅ Checklist for Deployment

- [ ] `alembic upgrade head` runs without errors
- [ ] `pytest` tests all passing
- [ ] JWT endpoints responding with correct format
- [ ] Token refresh working
- [ ] Admin signup key set (if needed)
- [ ] CORS_ALLOWED_ORIGINS updated for production
- [ ] Database backups configured
- [ ] Secrets stored securely (Vault or AWS)
- [ ] Error handling working with response envelope
- [ ] Audit logging functional

---

**Version**: 1.0  
**Last Updated**: May 11, 2026  
**Status**: Ready for Production
