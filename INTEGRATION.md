# FoodPilot — full-stack integration (microservices)

Three services, wired together. The Java gateway is the frontend's single entry
point; it owns the sales domain itself (SQL) and proxies the AI-heavy calls to
the Python service that holds the LangChain / LangGraph brain.

```
  Browser (Next.js)            Java (Spring Boot)              Python (FastAPI)
  ─────────────────            ──────────────────              ────────────────
  web/  :3000    ──HTTP──►     gateway/  :8080    ──HTTP──►     ai_service/  :8000
  screens + fetch              • sales via JDBC ─────────────►  foodpilot.db (SQLite)
  graceful fallback            • proxies AI ──────────────────► app/ chains + agents
  to local mocks                 (parse, order, chat,           • CreateAI (parse/order/report)
                                  copilot, reviews)             • Ollama qwen3 (feed_me/copilot)
                                                                • Chroma (review_search)
```

## Run it (three terminals)

Order matters: start the AI service, then the gateway, then the web app.

```bash
# 1) Python AI service  → http://localhost:8000
./scripts/run-ai.sh

# 2) Java gateway       → http://localhost:8080   (needs Java 17+, Maven)
./scripts/run-gateway.sh

# 3) Next.js frontend   → http://localhost:3000
cd web && npm run dev
```

Health check of the whole chain:

```bash
curl -s http://localhost:8080/api/health
# {"gateway":"up","ai":{"status":"ok","service":"foodpilot-ai"}}
```

The frontend targets the gateway via `web/.env.local`
(`NEXT_PUBLIC_API_URL=http://localhost:8080/api`). **Every screen falls back to
its local mock if the backend is down**, so the UI never breaks — a small badge
shows *Live* vs *Sample data*.

## Endpoint map

| Frontend screen | Gateway endpoint | Owned by | Backing logic |
|---|---|---|---|
| Owner Dashboard / Analytics | `GET /api/sales/summary` | **Java (JDBC)** | SQL over `foodpilot.db` |
| Discover | `POST /api/parse` | proxy → Python | `parse_chain` (CreateAI) |
| Order Builder | `POST /api/order/resolve` | proxy → Python | `parse_and_resolve_order` (CreateAI + modifier resolver) |
| Concierge | `POST /api/chat` | proxy → Python | `run_feed_me` (Ollama qwen3) |
| Owner Copilot | `POST /api/copilot` | proxy → Python | `run_owner_copilot` (Ollama qwen3 + sales_stats + review_search) |
| Review Intelligence | `POST /api/reviews/report` | proxy → Python | `generate_complaint_report` (CreateAI map-reduce) |
| (also) | `POST /api/recommend` | proxy → Python | `recommend` (CreateAI + Chroma) |

The copilot and review report run a local reasoning model and can take **1–2
minutes**; the gateway's read timeout is set to 6 minutes and the UI shows a
labeled progress / thinking state.

## Prereqs

- Python venv `cuisine/` with the repo's `requirements.txt` **plus** `fastapi`.
- `ollama serve` running with `qwen3:4b` pulled (agents) — CreateAI creds in `.env` (chains).
- Java 17+ and Maven (`run-gateway.sh` auto-detects a Homebrew `openjdk@21`).
- Node for `web/`.

## Why this shape

Spring Boot can't call the Python `app/` functions directly, so the Java service
does the parts that are natural in Java (transactional SQL over the orders DB)
and delegates the LLM/agent work to the Python service over HTTP. That keeps the
LangChain/LangGraph brain intact and still puts a real Java + Spring Boot +
microservices tier in front of it.
