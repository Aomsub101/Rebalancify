"""
python/optimize.py
FastAPI router for portfolio mean-variance optimization.
Deployable to Railway (or any uvicorn-hostable environment).

DO NOT modify the math functions:
  min_variance_portfolio, max_sharpe_portfolio, target_risk_portfolio,
  project_3m, run_optimization, fetch_prices, calculate_annualized_metrics,
  truncate_to_common_length — these are out of scope for this migration.

Implements:
  F11-R3  Dynamic Truncation
  F11-R4  Annualized mean returns (μ) and covariance (Σ)
  F11-R5  Global Minimum Volatility optimization
  F11-R6  Maximum Sharpe Ratio optimization (Rf = 0.04)
  F11-R7  Target Risk optimization (≤ 1.5 × Max Sharpe vol)
  F11-R9  3-Month Projection Math
  F11-R14 API Response Shape
"""

import json
import math
import os
from datetime import date, timedelta
from typing import Any

import numpy as np
import scipy.optimize as opt
import yfinance as yf
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from supabase import Client, create_client

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CACHE_TTL_HOURS = 24
RF = 0.04  # Risk-free rate for Max Sharpe (4% annual)

# ---------------------------------------------------------------------------
# Pydantic request model
# ---------------------------------------------------------------------------


class OptimizeRequest(BaseModel):
    tickers: list[str]


# ---------------------------------------------------------------------------
# FastAPI router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/optimize/", tags=["optimize"])


@router.post("/")
async def optimize_endpoint(
    body: OptimizeRequest,
    x_api_key: str = Header(..., alias="X-API-Key"),
) -> dict[str, Any]:
    """
    POST /optimize
    Receives { tickers: string[] }, runs mean-variance optimization,
    returns F11-R14 response shape.
    """
    tickers = body.tickers

    # Validate: at least 2 tickers
    if not isinstance(tickers, list) or len(tickers) < 2:
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "OPTIMIZATION_ERROR", "message": "At least 2 tickers are required"}},
        )

    # Validate: all tickers are strings
    if not all(isinstance(t, str) for t in tickers):
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "OPTIMIZATION_ERROR", "message": "All tickers must be strings"}},
        )

    # Deduplicate
    tickers = list(dict.fromkeys(tickers))

    try:
        result = run_optimization(tickers)
        return result
    except OptimizationError as e:
        raise HTTPException(status_code=422, detail={"error": {"code": "OPTIMIZATION_ERROR", "message": e.message}})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": {"code": "INTERNAL_ERROR", "message": str(e)}})


# ---------------------------------------------------------------------------
# Supabase client
# ---------------------------------------------------------------------------

def get_supabase_client() -> Client:
    """Create Supabase client using service role key (server-side only)."""
    supabase_url = os.environ.get("SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_role_key:
        raise OptimizationError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    return create_client(supabase_url, service_role_key)


# ---------------------------------------------------------------------------
# Price fetching (cache-first, yfinance on miss)
# ---------------------------------------------------------------------------

def fetch_prices(tickers: list[str], supabase: Client) -> dict[str, list[dict]]:
    """
    Fetch price series for each ticker.
    1. Check asset_historical_data cache (fresh if < 24h old)
    2. On cache miss or stale: fetch from yfinance, upsert result
    Returns {ticker: [{date, close}, ...]} sorted ascending by date.
    """
    prices_by_ticker: dict[str, list[dict]] = {}

    for ticker in tickers:
        ticker_upper = ticker.upper().strip()

        # Step 1: Check Supabase cache
        row = (
            supabase.table("asset_historical_data")
            .select("ticker, historical_prices, last_updated")
            .eq("ticker", ticker_upper)
            .maybe_single()
        ).execute()

        cache_fresh = False
        if row and row.data:
            last_updated = date.fromisoformat(row.data["last_updated"].replace("Z", ""))
            age_hours = (date.today() - last_updated).total_seconds() / 3600
            if age_hours < CACHE_TTL_HOURS:
                cache_fresh = True
                prices_by_ticker[ticker_upper] = row.data["historical_prices"]

        if cache_fresh:
            continue

        # Step 2: Fetch from yfinance
        try:
            ticker_obj = yf.Ticker(ticker_upper)
            hist = ticker_obj.history(period="5y")
        except Exception as e:
            raise OptimizationError(f"yfinance fetch failed for {ticker_upper}: {e}")

        if hist is None or hist.empty:
            raise OptimizationError(f"Ticker not found: {ticker_upper}")

        # Extract Close series as list of {date, close}
        prices: list[dict] = []
        for idx, row_price in hist.iterrows():
            dt = idx.strftime("%Y-%m-%d")
            close = float(row_price["Close"])
            if math.isnan(close):
                continue
            prices.append({"date": dt, "close": close})

        if len(prices) < 2:
            raise OptimizationError(f"Insufficient price data for {ticker_upper}: only {len(prices)} price points")

        # Sort ascending by date
        prices.sort(key=lambda p: p["date"])

        # Derive market debut from the first date in the fetched price series
        if prices:
            debut_date = prices[0]["date"]  # already sorted ascending
            # Older date wins since yfinance lookback is always up to 5yr
            supabase.table("assets").upsert(
                {"ticker": ticker_upper, "market_debut_date": debut_date},
                on_conflict="ticker",
            ).execute()

        # Step 3: Upsert to Supabase
        supabase.table("asset_historical_data").upsert(
            {
                "ticker": ticker_upper,
                "historical_prices": prices,
                "last_updated": date.today().isoformat(),
            },
            on_conflict="ticker",
        ).execute()

        prices_by_ticker[ticker_upper] = prices

    return prices_by_ticker


# ---------------------------------------------------------------------------
# Truncation (F11-R3)
# ---------------------------------------------------------------------------

def truncate_to_common_length(prices_by_ticker: dict[str, list[dict]]) -> tuple[dict, str, int]:
    """
    Find the asset with the shortest price series and truncate all others to match.
    Returns (truncated_prices, limiting_ticker, lookback_months).
    """
    # Find shortest series
    shortest_ticker = None
    shortest_len = float("inf")
    for ticker, prices in prices_by_ticker.items():
        n = len(prices)
        if n < shortest_len:
            shortest_len = n
            shortest_ticker = ticker

    # Truncate all series to shortest length
    truncated: dict[str, list[dict]] = {}
    for ticker, prices in prices_by_ticker.items():
        truncated[ticker] = prices[:shortest_len]

    # Calculate lookback_months from first to last date in truncated series
    dates = [p["date"] for p in truncated[shortest_ticker]]
    first_date = date.fromisoformat(dates[0])
    last_date = date.fromisoformat(dates[-1])
    lookback_days = (last_date - first_date).days
    # Approximate months using 30.44 avg days per month
    lookback_months = int(round(lookback_days / 30.44))

    return truncated, shortest_ticker, lookback_months


# ---------------------------------------------------------------------------
# Annualized metrics (F11-R4)
# ---------------------------------------------------------------------------

def calculate_annualized_metrics(prices_by_ticker: dict[str, list[dict]]) -> tuple[np.ndarray, np.ndarray]:
    """
    Compute annualized mean returns vector (μ) and covariance matrix (Σ).
    Input: {ticker: [{date, close}, ...]} sorted ascending by date.
    Returns: (mu, Sigma) as numpy arrays.
    """
    tickers = list(prices_by_ticker.keys())
    n = len(tickers)

    # Verify all series have same length (should be after truncation)
    series_len = len(prices_by_ticker[tickers[0]])
    for ticker in tickers:
        if len(prices_by_ticker[ticker]) != series_len:
            raise OptimizationError(f"Price series lengths differ after truncation: {ticker}")

    # Build daily returns matrix: rows=tickers, cols=days
    returns_matrix = np.zeros((n, series_len - 1))
    for i, ticker in enumerate(tickers):
        closes = np.array([p["close"] for p in prices_by_ticker[ticker]], dtype=np.float64)
        daily_rets = np.diff(closes) / closes[:-1]
        # Replace any inf/nan with 0
        daily_rets = np.nan_to_num(daily_rets, nan=0.0, posinf=0.0, neginf=0.0)
        returns_matrix[i] = daily_rets

    # Annualize: mean return × 252, covariance × 252
    mu = np.mean(returns_matrix, axis=1) * 252.0
    cov = np.cov(returns_matrix) * 252.0

    # Ensure positive semi-definiteness (add small regularization if needed)
    eigenvalues = np.linalg.eigvalsh(cov)
    if eigenvalues.min() < 0:
        # Add small multiple of identity to make PSD
        cov = cov + (abs(eigenvalues.min()) + 1e-8) * np.eye(n)

    return mu, cov


# ---------------------------------------------------------------------------
# Optimization strategies (F11-R5, R6, R7)
# ---------------------------------------------------------------------------

def _min_vol(mu: np.ndarray, Sigma: np.ndarray) -> np.ndarray:
    """Min variance portfolio: min w'Sigma w s.t. sum(w)=1, 0<=w<=1."""
    n = len(mu)
    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1}]
    bounds = [(0.0, 1.0)] * n
    x0 = np.ones(n) / n

    result = opt.minimize(
        lambda w: float(w @ Sigma @ w),
        x0,
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
        options={"ftol": 1e-10, "maxiter": 1000},
    )
    if not result.success:
        raise OptimizationError(f"Min variance optimization failed: {result.message}")
    return result.x


def min_variance_portfolio(mu: np.ndarray, Sigma: np.ndarray) -> np.ndarray:
    """F11-R5: Global Minimum Volatility — minimize portfolio variance."""
    return _min_vol(mu, Sigma)


def max_sharpe_portfolio(mu: np.ndarray, Sigma: np.ndarray, Rf: float = RF) -> tuple[np.ndarray, float]:
    """F11-R6: Maximum Sharpe Ratio — maximize (w'μ - Rf) / √(w'Σw). Returns (weights, portfolio_vol)."""
    n = len(mu)
    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1}]
    bounds = [(0.0, 1.0)] * n
    x0 = np.ones(n) / n

    def neg_sharpe(w: np.ndarray) -> float:
        w = np.array(w)
        port_return = float(w @ mu)
        port_vol = float(np.sqrt(w @ Sigma @ w))
        if port_vol < 1e-10:
            return 1e10
        return -(port_return - Rf) / port_vol

    result = opt.minimize(
        neg_sharpe,
        x0,
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
        options={"ftol": 1e-10, "maxiter": 1000},
    )
    if not result.success:
        raise OptimizationError(f"Max Sharpe optimization failed: {result.message}")

    w = result.x
    portfolio_vol = float(np.sqrt(w @ Sigma @ w))
    return w, portfolio_vol


def target_risk_portfolio(mu: np.ndarray, Sigma: np.ndarray, sigma_max_sharpe: float) -> np.ndarray:
    """F11-R7: Target Risk — maximize return with vol ≤ 1.5 × Max Sharpe vol."""
    n = len(mu)
    vol_constraint = {
        "type": "ineq",
        "fun": lambda w: float(1.5 * sigma_max_sharpe - np.sqrt(w @ Sigma @ w)),
    }
    constraints = [
        {"type": "eq", "fun": lambda w: np.sum(w) - 1},
        vol_constraint,
    ]
    bounds = [(0.0, 1.0)] * n
    x0 = np.ones(n) / n

    result = opt.minimize(
        lambda w: -float(w @ mu),  # minimize negative return = maximize return
        x0,
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
        options={"ftol": 1e-10, "maxiter": 1000},
    )
    if not result.success:
        raise OptimizationError(f"Target risk optimization failed: {result.message}")
    return result.x


# ---------------------------------------------------------------------------
# 3-Month projection (F11-R9)
# ---------------------------------------------------------------------------

def project_3m(weights: np.ndarray, mu: np.ndarray, Sigma: np.ndarray) -> tuple[str, str]:
    """
    Compute 3-month expected return and range string.
    Returns (return_3m_str, range_str).
    """
    weights = np.array(weights)
    mu = np.array(mu)
    Sigma = np.array(Sigma)

    port_return_annual = float(weights @ mu)
    port_vol_annual = float(np.sqrt(weights @ Sigma @ weights))

    return_3m = port_return_annual * (3.0 / 12.0)
    vol_3m = port_vol_annual * math.sqrt(3.0 / 12.0)

    return_str = f"{return_3m * 100:.2f}%"
    range_str = f"{return_3m * 100:.2f}% ± {2 * vol_3m * 100:.2f}%"

    return return_str, range_str


# ---------------------------------------------------------------------------
# Main optimization runner
# ---------------------------------------------------------------------------

class OptimizationError(Exception):
    """Raised when optimization fails with a user-visible message."""
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def run_optimization(tickers: list[str]) -> dict[str, Any]:
    """
    Full optimization pipeline:
    1. Fetch price series from cache/yfinance
    2. Truncate to common length
    3. Compute annualized μ and Σ
    4. Run three optimization strategies
    5. Compute 3-month projections
    6. Return F11-R14 response shape
    """
    supabase = get_supabase_client()

    # Step 1: Fetch price series
    prices_by_ticker = fetch_prices(tickers, supabase)

    # Step 2: Truncate to common length
    truncated, limiting_ticker, lookback_months = truncate_to_common_length(prices_by_ticker)

    # Step 3: Annualized metrics
    mu, Sigma = calculate_annualized_metrics(truncated)

    # Step 4: Run three optimization strategies
    w_min_var = min_variance_portfolio(mu, Sigma)
    w_max_sharpe, sigma_sharpe = max_sharpe_portfolio(mu, Sigma)
    w_target_risk = target_risk_portfolio(mu, Sigma, sigma_sharpe)

    # Step 5: 3-month projections
    ret_min_var, range_min_var = project_3m(w_min_var, mu, Sigma)
    ret_max_sharpe, range_max_sharpe = project_3m(w_max_sharpe, mu, Sigma)
    ret_target_risk, range_target_risk = project_3m(w_target_risk, mu, Sigma)

    # Step 6: Build ticker symbol → weight mapping
    ticker_list = list(truncated.keys())

    def weights_to_dict(w: np.ndarray) -> dict[str, float]:
        result = {}
        for i, ticker in enumerate(ticker_list):
            result[ticker] = round(float(w[i]), 6)
        return result

    # Step 7: Assemble response (F11-R14)
    result = {
        "strategies": {
            "not_to_lose": {
                "weights": weights_to_dict(w_min_var),
                "return_3m": ret_min_var,
                "range": range_min_var,
            },
            "expected": {
                "weights": weights_to_dict(w_max_sharpe),
                "return_3m": ret_max_sharpe,
                "range": range_max_sharpe,
            },
            "optimistic": {
                "weights": weights_to_dict(w_target_risk),
                "return_3m": ret_target_risk,
                "range": range_target_risk,
            },
        },
        "metadata": {
            "is_truncated_below_3_years": lookback_months < 36,
            "limiting_ticker": limiting_ticker,
            "lookback_months": lookback_months,
        },
    }

    return result
