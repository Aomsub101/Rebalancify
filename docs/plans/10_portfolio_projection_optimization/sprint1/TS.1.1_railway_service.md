# TS.1.1 — Railway FastAPI Service

## Task
Create FastAPI microservice on Railway with CORS, X-API-Key auth, and health check.

## Target
`api/index.py`

## Inputs
- `docs/architecture/components/10_portfolio_projection_optimization/01-optimizer_api.md`

## Process
1. Create `api/index.py`:
   - FastAPI app factory
   - CORS: locked to localhost:3000 + production Vercel origin
   - X-API-Key header validation against `RAILWAY_API_KEY` env var
   - Mount routers: `/optimize`, `/backfill_debut`
   - Health check endpoint: `GET /health`
2. Configure `railway.json`:
   - Builder: Nixpacks with Python 3.12
   - Start: `uvicorn api.index:app --host 0.0.0.0 --port $PORT`
   - Replicas: 1, restart on failure (max 10 retries)
3. Dependencies: `pyproject.toml` with scipy, yfinance, fastapi, uvicorn, supabase-py
4. Env vars: `RAILWAY_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

## Outputs
- `api/index.py`
- `railway.json`
- `pyproject.toml` (Python deps)

## Verify
- `uvicorn api.index:app` starts locally
- `/health` returns 200
- Missing X-API-Key → 401
- Invalid key → 403

## Handoff
→ TS.1.2 (Optimizer endpoint)
