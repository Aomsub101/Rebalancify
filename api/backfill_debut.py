"""
api/backfill_debut.py
Python serverless function (Vercel) for backfilling assets.market_debut_date.

Runtime: @vercel/python

This is called by the holdings API route when an asset is missing market_debut_date.
Uses yfinance 5-year price series — same logic as api/optimize.py lines 187–194.
"""

import json
import math
import os
from datetime import date
from typing import Any

import yfinance as yf
from supabase import Client, create_client


def handler(event: dict[str, Any]) -> dict[str, Any]:
    """
    Vercel Python serverless function entry point.
    Handles POST /api/backfill_debut.
    """
    if event.get("method", "").upper() != "POST":
        return {"statusCode": 405, "body": json.dumps({"error": {"code": "METHOD_NOT_ALLOWED", "message": "Only POST is supported"}})}

    try:
        body = json.loads(event.get("body", "{}"))
    except json.JSONDecodeError:
        return {"statusCode": 400, "body": json.dumps({"error": {"code": "INVALID_JSON", "message": "Invalid JSON in request body"}})}

    ticker = body.get("ticker", "").strip()
    if not ticker:
        return {"statusCode": 400, "body": json.dumps({"error": {"code": "INVALID_VALUE", "message": "ticker is required"}})}

    ticker_upper = ticker.upper()

    supabase_url = os.environ.get("SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_role_key:
        return {"statusCode": 500, "body": json.dumps({"error": {"code": "CONFIG_ERROR", "message": "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"}})}

    supabase: Client = create_client(supabase_url, service_role_key)

    try:
        debut_date = fetch_and_upsert_debut(supabase, ticker_upper)
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"ticker": ticker_upper, "market_debut_date": debut_date}),
        }
    except BackfillError as e:
        return {"statusCode": 422, "headers": {"Content-Type": "application/json"}, "body": json.dumps({"error": {"code": "BACKFILL_ERROR", "message": e.message}})}
    except Exception as e:
        return {"statusCode": 500, "headers": {"Content-Type": "application/json"}, "body": json.dumps({"error": {"code": "INTERNAL_ERROR", "message": str(e)}})}


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
