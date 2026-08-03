# OCEANet AI Chat Setup

## What was added
- `POST /ai/chat` endpoint in `app/main.py`
- Conversation history support (`history` array)
- Provider modes:
  - `auto` (default): tries OpenAI, then local fallback
  - `openai`: prefers OpenAI and falls back locally on errors
  - `local`: always local responses (no API key required)

## Request format
```json
{
  "message": "Analyze tuna stock trends in Bay of Bengal",
  "history": [
    {"role": "user", "content": "hello"},
    {"role": "assistant", "content": "Hi!"}
  ]
}
```

## Response format
```json
{
  "reply": "...assistant text...",
  "provider": "openai"
}
```

## Optional: Enable OpenAI replies
Set environment variables before running backend:

- `OPENAI_API_KEY=your_key_here`
- `OCEANET_AI_PROVIDER=auto` (or `openai`)
- `OCEANET_OPENAI_MODEL=gpt-4o-mini` (optional)

If `OPENAI_API_KEY` is missing, the service still works using local fallback responses.

## Run backend
```bash
uvicorn app.main:app --reload --port 8000
```

## Frontend base URL
Frontend already uses:
- `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:8000`)
