"""
python/backfill_debut.py
FastAPI router for backfilling assets.market_debut_date.
Deployable to Railway (or any uvicorn-hostable environment).

DO NOT modify fetch_and_upsert_debut() or BackfillError — these are
out of scope for this migration.
"""

import json
import math
import os
from datetime import date
from typing import Any

import yfinance as yf
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from supabase import Client, create_client

# ---------------------------------------------------------------------------
# Pydantic request model
# ---------------------------------------------------------------------------


class BackfillRequest(BaseModel):
    ticker: str


# ---------------------------------------------------------------------------
# FastAPI router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/backfill_debut/", tags=["backfill_debut"])


@router.post("/")
async def backfill_debut_endpoint(
    body: BackfillRequest,
    x_api_key: str = Header(..., alias="X-API-Key"),
) -> dict[str, Any]:
    """
    POST /backfill_debut
    Receives { ticker: string }, fetches yfinance 5-year history,
    extracts earliest date, upserts into assets.market_debut_date.
    Returns { ticker, market_debut_date }.
    """
    ticker = body.ticker.strip()
    if not ticker:
        raise HTTPException(status_code=400, detail={"error": {"code": "INVALID_VALUE", "message": "ticker is required"}})

    ticker_upper = ticker.upper()

    supabase_url = os.environ.get("SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_role_key:
        raise HTTPException(
            status_code=500,
            detail={"error": {"code": "CONFIG_ERROR", "message": "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"}},
        )

    supabase: Client = create_client(supabase_url, service_role_key)

    try:
        debut_date = fetch_and_upsert_debut(supabase, ticker_upper)
        return {"ticker": ticker_upper, "market_debut_date": debut_date}
    except BackfillError as e:
        raise HTTPException(status_code=422, detail={"error": {"code": "BACKFILL_ERROR", "message": e.message}})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": {"code": "INTERNAL_ERROR", "message": str(e)}})


# ---------------------------------------------------------------------------
# Core backfill logic (out of scope — do not modify)
# ---------------------------------------------------------------------------


def fetch_and_upsert_debut(supabase: Client, ticker_upper: str) -> str:
    """
    Fetch yfinance 5-year price history for the ticker, extract the earliest date,
    and upsert it into assets.market_debut_date.
    Returns the debut date string (YYYY-MM-DD).
    Raises BackfillError on failure.
    """
    try:
        ticker_obj = yf.Ticker(ticker_upper)
        hist = ticker_obj.history(period="5y")
    except Exception as e:
        raise BackfillError(f"yfinance fetch failed for {ticker_upper}: {e}")

    if hist is None or hist.empty:
        raise BackfillError(f"Ticker not found: {ticker_upper}")

    # Extract Close series, collect valid (date, close) pairs
    prices: list[tuple[str, float]] = []
    for idx, row_price in hist.iterrows():
        dt = idx.strftime("%Y-%m-%d")
        close = float(row_price["Close"])
        if math.isnan(close):
            continue
        prices.append((dt, close))

    if len(prices) < 2:
        raise BackfillError(f"Insufficient price data for {ticker_upper}: only {len(prices)} price points")

    # Sort ascending by date
    prices.sort(key=lambda p: p[0])

    debut_date = prices[0][0]  # YYYY-MM-DD string, already sorted ascending

    # Upsert market_debut_date — older date wins since yfinance lookback is up to 5yr
    supabase.table("assets").upsert(
        {"ticker": ticker_upper, "market_debut_date": debut_date},
        on_conflict="ticker",
    ).execute()

    return debut_date


class BackfillError(Exception):
    """Raised when backfill fails with a user-visible message."""
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)
