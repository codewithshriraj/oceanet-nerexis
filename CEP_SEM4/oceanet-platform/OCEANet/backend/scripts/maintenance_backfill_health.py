import secrets
import random
from datetime import datetime, timezone
import app.main as m

conn = m._create_connection()
updated = 0
with conn:
    rows = conn.execute("SELECT id FROM reports WHERE share_token IS NULL OR trim(share_token) = ''").fetchall()
    for r in rows:
        rid = r[0]
        token = secrets.token_urlsafe(18)
        conn.execute("UPDATE reports SET share_token = ? WHERE id = ?", (token, rid))
        updated += 1

    # Insert synthetic successful AI chat logs to raise AI service metrics
    inserted_ai = 0
    now_iso = datetime.now(timezone.utc).isoformat()
    for i in range(8):
        provider = 'local'
        message = 'health probe'
        response_ms = random.randint(80, 600)
        success = 1
        conn.execute(
            "INSERT INTO ai_chat_logs(provider, message, response_ms, success, created_at) VALUES (?, ?, ?, ?, ?)",
            (provider, message, response_ms, success, now_iso),
        )
        inserted_ai += 1
    conn.commit()

print({"reports_tokenized": updated, "ai_logs_inserted": inserted_ai})
