import json
import os
import sqlite3
import tempfile
import uuid
from pathlib import Path

import requests

BASE = "http://localhost:8000"
BACKEND_ROOT = Path(__file__).resolve().parents[1]
DB_PATH = BACKEND_ROOT / "data" / "nerexis_auth.db"

suffix = uuid.uuid4().hex[:8]
general_email = f"general_{suffix}@example.com"
admin_email = f"admin_{suffix}@example.com"
password = "TestPass123!"
admin_key = "nerexis-admin-123"

result = {
    "general_upload_blocked": None,
    "general_delete_blocked": None,
    "admin_upload_allowed": None,
    "admin_delete_allowed": None,
    "notes": [],
}


def signup(name, email, login_type, admin_key_value=None):
    payload = {
        "name": name,
        "email": email,
        "password": password,
        "login_type": login_type,
    }
    if admin_key_value is not None:
        payload["admin_key"] = admin_key_value
    return requests.post(f"{BASE}/auth/signup", json=payload, timeout=20)


def signin(email, login_type):
    payload = {
        "email": email,
        "password": password,
        "login_type": login_type,
    }
    return requests.post(f"{BASE}/auth/signin", json=payload, timeout=20)


sg = signup("General User", general_email, "general")
if sg.status_code not in (200, 409):
    raise RuntimeError(f"general signup failed: {sg.status_code} {sg.text}")

lg = signin(general_email, "general")
if lg.status_code != 200:
    raise RuntimeError(f"general signin failed: {lg.status_code} {lg.text}")
general_token = lg.json()["token"]

sa = signup("Admin User", admin_email, "admin", admin_key)
if sa.status_code == 200:
    result["notes"].append("Admin created via admin key")
elif sa.status_code in (403, 409):
    result["notes"].append("Admin signup with key unavailable/conflict; promoting test admin in DB for runtime RBAC check")
    s2 = signup("Admin User", admin_email, "general")
    if s2.status_code not in (200, 409):
        raise RuntimeError(f"admin fallback signup failed: {s2.status_code} {s2.text}")
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("UPDATE users SET role='admin' WHERE email=?", (admin_email.lower(),))
        conn.commit()
else:
    raise RuntimeError(f"admin signup failed: {sa.status_code} {sa.text}")

la = signin(admin_email, "admin")
if la.status_code != 200:
    raise RuntimeError(f"admin signin failed: {la.status_code} {la.text}")
admin_token = la.json()["token"]

with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False, encoding="utf-8") as tf:
    tf.write("a,b\n1,2\n")
    csv_path = tf.name

with open(csv_path, "rb") as f:
    ru_g = requests.post(
        f"{BASE}/datasets/upload",
        files={"files": ("rbac_test.csv", f, "text/csv")},
        headers={"Authorization": f"Bearer {general_token}"},
        timeout=30,
    )
result["general_upload_blocked"] = ru_g.status_code == 403

with open(csv_path, "rb") as f:
    ru_a = requests.post(
        f"{BASE}/datasets/upload",
        files={"files": ("rbac_test.csv", f, "text/csv")},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
result["admin_upload_allowed"] = ru_a.status_code == 200

if ru_a.status_code != 200:
    result["notes"].append(f"Admin upload returned {ru_a.status_code}: {ru_a.text[:200]}")
    print(json.dumps(result, indent=2))
    raise SystemExit(1)

payload = ru_a.json()
new_id = payload["datasets"][0]["id"]

rd_g = requests.delete(
    f"{BASE}/datasets/{new_id}",
    headers={"Authorization": f"Bearer {general_token}"},
    timeout=20,
)
result["general_delete_blocked"] = rd_g.status_code == 403

rd_a = requests.delete(
    f"{BASE}/datasets/{new_id}",
    headers={"Authorization": f"Bearer {admin_token}"},
    timeout=20,
)
result["admin_delete_allowed"] = rd_a.status_code == 200

os.unlink(csv_path)

result["status_codes"] = {
    "general_upload": ru_g.status_code,
    "admin_upload": ru_a.status_code,
    "general_delete": rd_g.status_code,
    "admin_delete": rd_a.status_code,
}

print(json.dumps(result, indent=2))
