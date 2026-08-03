# Backend Utility Scripts

This folder contains maintenance/ops scripts that are not part of the runtime API service.

## Scripts

- `audit_cleanup_verified.py`: Verifies dataset source/file consistency and writes audit reports.
- `rbac_check.py`: Runs RBAC upload/delete checks against the running backend.

## Usage

Run from the backend root to keep paths predictable:

```powershell
cd backend
python scripts/audit_cleanup_verified.py
python scripts/rbac_check.py
```
