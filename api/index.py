"""
api/index.py
FastAPI entrypoint for the Railway-deployed Python microservice.
All routes require X-API-Key authentication.
Only accessible via Next.js proxy — not directly from the browser.
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import backfill_debut, optimize

app = FastAPI(
    title="Rebalancify Optimization API",
    description="Portfolio optimization and asset backfill — internal Railway service",
)

# ---------------------------------------------------------------------------
# CORS — restrict to Next.js origins only (no wildcard)
# ---------------------------------------------------------------------------

ALLOWED_ORIGINS = [
    "http://localhost:3000",      # local development
    "https://rebalancify.vercel.app",  # production
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["POST"],
    allow_headers=["X-API-Key", "Content-Type"],
)


# ---------------------------------------------------------------------------
# Mount routers
# ---------------------------------------------------------------------------

app.include_router(optimize.router)
app.include_router(backfill_debut.router)
