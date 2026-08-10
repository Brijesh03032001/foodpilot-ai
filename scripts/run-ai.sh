#!/usr/bin/env bash
# FoodPilot AI service (Python / FastAPI) — the LangChain + agents brain.
# Serves on :8000. Run from anywhere; paths resolve to the repo root.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
exec cuisine/bin/uvicorn ai_service.main:app --port 8000 --reload
