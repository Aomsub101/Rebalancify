"""
api/test_optimize.py
Unit tests for the portfolio optimization math engine.
TDD Red phase — these tests import from api/optimize which does not exist yet.
All tests should FAIL until api/optimize.py is implemented.

Run with: pytest api/test_optimize.py -v
"""

import pytest
import numpy as np
from datetime import date, timedelta


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def make_price_series(ticker: str, dates, closes):
    """Build a price list matching fetch_prices() output shape: {ticker: [{date, close}, ...]}."""
    return [{"date": d.strftime("%Y-%m-%d"), "close": c} for d, c in zip(dates, closes)]


def date_range(start_date: date, n_days: int):
    """Generate n_days of trading dates (weekdays only)."""
    dates = []
    d = start_date
    while len(dates) < n_days:
        if d.weekday() < 5:  # Mon-Fri
            dates.append(d)
        d += timedelta(days=1)
    return dates


@pytest.fixture
def two_asset_prices():
    """Two assets: AAPL and MSFT, both with ~5 years of weekday data."""
    start = date(2021, 1, 4)
    n_days = 1260  # ~5 years of trading days

    aapl_dates = date_range(start, n_days)
    msft_dates = date_range(start, n_days)

    # AAPL: deterministic walk with slight positive drift
    np.random.seed(42)
    aapl_prices = [100.0]
    for _ in range(n_days - 1):
        ret = 0.0005 + np.random.randn() * 0.015
        aapl_prices.append(round(aapl_prices[-1] * (1 + ret), 4))

    # MSFT: slightly higher drift
    np.random.seed(43)
    msft_prices = [100.0]
    for _ in range(n_days - 1):
        ret = 0.0008 + np.random.randn() * 0.018
        msft_prices.append(round(msft_prices[-1] * (1 + ret), 4))

    return {
        "AAPL": make_price_series("AAPL", aapl_dates, aapl_prices),
        "MSFT": make_price_series("MSFT", msft_dates, msft_prices),
    }


@pytest.fixture
def three_asset_prices():
    """Three assets with different series lengths for truncation tests."""
    start = date(2021, 1, 4)
    start_young = date(2025, 7, 1)

    aapl_dates = date_range(start, 1260)
    msft_dates = date_range(start, 1260)
    young_dates = date_range(start_young, 200)

    np.random.seed(42)
    aapl_prices = [100.0]
    for _ in range(len(aapl_dates) - 1):
        ret = 0.0005 + np.random.randn() * 0.015
        aapl_prices.append(round(aapl_prices[-1] * (1 + ret), 4))

    np.random.seed(43)
    msft_prices = [100.0]
    for _ in range(len(msft_dates) - 1):
        ret = 0.0008 + np.random.randn() * 0.018
        msft_prices.append(round(msft_prices[-1] * (1 + ret), 4))

    np.random.seed(44)
    young_prices = [50.0]
    for _ in range(len(young_dates) - 1):
        ret = 0.001 + np.random.randn() * 0.025
        young_prices.append(round(young_prices[-1] * (1 + ret), 4))

    return {
        "AAPL": make_price_series("AAPL", aapl_dates, aapl_prices),
        "MSFT": make_price_series("MSFT", msft_dates, msft_prices),
        "YOUNG": make_price_series("YOUNG", young_dates, young_prices),
    }


# ---------------------------------------------------------------------------
# Tests (Red phase — these import from api/optimize which doesn't exist yet)
# ---------------------------------------------------------------------------

class TestTruncation:
    """Tests for F11-R3 — Dynamic Truncation."""

    def test_truncation_metadata(self, three_asset_prices):
        """limiting_ticker should be YOUNG (shortest series)."""
        from api.optimize import truncate_to_common_length
        truncated, limiting_ticker, lookback_months = truncate_to_common_length(three_asset_prices)

        # All series should have same length as YOUNG's original series
        young_original_len = len(three_asset_prices["YOUNG"])  # now a direct list
        for ticker, prices in truncated.items():
            assert len(prices) == young_original_len, f"{ticker} not truncated to {young_original_len}"

        assert limiting_ticker == "YOUNG"
        # lookback_months should be ~8-9 (200 trading days / ~21 trading days per month ≈ 9.5)
        assert 6 <= lookback_months <= 12, f"Expected ~8-9 months, got {lookback_months}"

    def test_truncation_below_3_years_flag(self, three_asset_prices):
        """With a young asset, is_truncated_below_3_years should be True."""
        from api.optimize import truncate_to_common_length
        _, _, lookback_months = truncate_to_common_length(three_asset_prices)
        assert lookback_months < 36, f"Expected < 36 months, got {lookback_months}"

    def test_two_asset_no_truncation_warning(self, two_asset_prices):
        """With 5y data for both assets, is_truncated_below_3_years should be False."""
        from api.optimize import truncate_to_common_length
        _, _, lookback_months = truncate_to_common_length(two_asset_prices)
        assert lookback_months >= 36, f"Expected >= 36 months, got {lookback_months}"


class TestAnnualizedMetrics:
    """Tests for F11-R4 — Annualized mean returns (μ) and covariance (Σ)."""

    def test_mu_vector_shape(self, two_asset_prices):
        """mu should be a vector with length equal to number of assets."""
        from api.optimize import truncate_to_common_length, calculate_annualized_metrics
        truncated, _, _ = truncate_to_common_length(two_asset_prices)
        mu, Sigma = calculate_annualized_metrics(truncated)
        assert mu.shape == (2,), f"Expected shape (2,), got {mu.shape}"

    def test_sigma_matrix_shape(self, two_asset_prices):
        """Sigma should be a 2x2 covariance matrix."""
        from api.optimize import truncate_to_common_length, calculate_annualized_metrics
        truncated, _, _ = truncate_to_common_length(two_asset_prices)
        mu, Sigma = calculate_annualized_metrics(truncated)
        assert Sigma.shape == (2, 2), f"Expected shape (2,2), got {Sigma.shape}"

    def test_sigma_positive_semidefinite(self, two_asset_prices):
        """Covariance matrix must be positive semi-definite."""
        from api.optimize import truncate_to_common_length, calculate_annualized_metrics
        truncated, _, _ = truncate_to_common_length(two_asset_prices)
        mu, Sigma = calculate_annualized_metrics(truncated)
        eigenvalues = np.linalg.eigvalsh(Sigma)
        assert all(e >= -1e-6 for e in eigenvalues), f"Sigma not PSD: eigenvalues={eigenvalues}"

    def test_mu_reasonable_range(self, two_asset_prices):
        """Annualized returns should be in a plausible range."""
        from api.optimize import truncate_to_common_length, calculate_annualized_metrics
        truncated, _, _ = truncate_to_common_length(two_asset_prices)
        mu, _ = calculate_annualized_metrics(truncated)
        assert all(-0.5 < m < 2.0 for m in mu), f"mu values unreasonable: {mu}"


class TestOptimizationStrategies:
    """Tests for F11-R5, R6, R7 — Three scipy.optimize strategies."""

    def test_weights_sum_to_one(self, two_asset_prices):
        """All three strategy weights must sum to 1.0 (tol 0.001)."""
        from api.optimize import truncate_to_common_length, calculate_annualized_metrics
        from api.optimize import min_variance_portfolio, max_sharpe_portfolio, target_risk_portfolio

        truncated, _, _ = truncate_to_common_length(two_asset_prices)
        mu, Sigma = calculate_annualized_metrics(truncated)

        w_min_var = min_variance_portfolio(mu, Sigma)
        w_max_sharpe, sigma_sharpe = max_sharpe_portfolio(mu, Sigma)
        w_target_risk = target_risk_portfolio(mu, Sigma, sigma_sharpe)

        for name, w in [("min_variance", w_min_var), ("max_sharpe", w_max_sharpe), ("target_risk", w_target_risk)]:
            total = float(np.sum(w))
            assert abs(total - 1.0) < 0.001, f"{name} weights sum to {total}, not 1.0"

    def test_weights_bounded(self, two_asset_prices):
        """All weights must be between 0 and 1."""
        from api.optimize import truncate_to_common_length, calculate_annualized_metrics
        from api.optimize import min_variance_portfolio, max_sharpe_portfolio, target_risk_portfolio

        truncated, _, _ = truncate_to_common_length(two_asset_prices)
        mu, Sigma = calculate_annualized_metrics(truncated)

        w_min_var = min_variance_portfolio(mu, Sigma)
        w_max_sharpe, sigma_sharpe = max_sharpe_portfolio(mu, Sigma)
        w_target_risk = target_risk_portfolio(mu, Sigma, sigma_sharpe)

        for name, w in [("min_variance", w_min_var), ("max_sharpe", w_max_sharpe), ("target_risk", w_target_risk)]:
            assert all(0 - 1e-6 <= wi <= 1 + 1e-6 for wi in w), f"{name} has weight outside [0,1]: {w}"

    def test_target_risk_return_gte_max_sharpe(self, two_asset_prices):
        """Target Risk return should be >= Max Sharpe return."""
        from api.optimize import truncate_to_common_length, calculate_annualized_metrics
        from api.optimize import min_variance_portfolio, max_sharpe_portfolio, target_risk_portfolio

        truncated, _, _ = truncate_to_common_length(two_asset_prices)
        mu, Sigma = calculate_annualized_metrics(truncated)

        w_max_sharpe, sigma_sharpe = max_sharpe_portfolio(mu, Sigma)
        w_target_risk = target_risk_portfolio(mu, Sigma, sigma_sharpe)

        ret_max_sharpe = float(w_max_sharpe @ mu)
        ret_target_risk = float(w_target_risk @ mu)

        assert ret_target_risk >= ret_max_sharpe - 0.001, (
            f"Target risk return {ret_target_risk:.4f} should be >= Max Sharpe {ret_max_sharpe:.4f}"
        )

    def test_optimistic_respects_vol_constraint(self, two_asset_prices):
        """Target Risk portfolio vol must be <= 1.5 * sigma_max_sharpe."""
        from api.optimize import truncate_to_common_length, calculate_annualized_metrics
        from api.optimize import max_sharpe_portfolio, target_risk_portfolio

        truncated, _, _ = truncate_to_common_length(two_asset_prices)
        mu, Sigma = calculate_annualized_metrics(truncated)

        w_max_sharpe, sigma_sharpe = max_sharpe_portfolio(mu, Sigma)
        w_target_risk = target_risk_portfolio(mu, Sigma, sigma_sharpe)

        vol_target_risk = float(np.sqrt(w_target_risk @ Sigma @ w_target_risk))
        assert vol_target_risk <= 1.5 * sigma_sharpe + 1e-5, (
            f"Target risk vol {vol_target_risk:.4f} exceeds 1.5 * sharpe vol {1.5*sigma_sharpe:.4f}"
        )


class TestProjectionMath:
    """Tests for F11-R9 — 3-Month Projection Math."""

    def test_projection_format(self, two_asset_prices):
        """3-month projection strings should have correct % and ± format."""
        from api.optimize import truncate_to_common_length, calculate_annualized_metrics
        from api.optimize import max_sharpe_portfolio, project_3m

        truncated, _, _ = truncate_to_common_length(two_asset_prices)
        mu, Sigma = calculate_annualized_metrics(truncated)
        w_max_sharpe, _ = max_sharpe_portfolio(mu, Sigma)

        return_3m_str, range_str = project_3m(w_max_sharpe, mu, Sigma)

        assert return_3m_str.endswith("%"), f"return_3m should end with %: {return_3m_str}"
        assert "±" in range_str, f"range should contain ±: {range_str}"
        assert range_str.endswith("%"), f"range should end with %: {range_str}"

    def test_projection_magnitude_reasonable(self, two_asset_prices):
        """3-month returns should be plausible (roughly annual return / 4)."""
        from api.optimize import truncate_to_common_length, calculate_annualized_metrics
        from api.optimize import min_variance_portfolio, project_3m

        truncated, _, _ = truncate_to_common_length(two_asset_prices)
        mu, Sigma = calculate_annualized_metrics(truncated)
        w_min_var = min_variance_portfolio(mu, Sigma)

        return_3m_str, _ = project_3m(w_min_var, mu, Sigma)
        port_return_annual = float(w_min_var @ mu)

        ret_val = float(return_3m_str.replace("%", ""))
        expected_3m = port_return_annual * 0.25

        assert abs(ret_val / 100 - expected_3m) < 0.01, (
            f"3m return {ret_val}% doesn't match expected {expected_3m*100:.2f}%"
        )


class _FakeExecuteResult:
    def __init__(self, data):
        self.data = data

    def execute(self):
        return self


class _FakeTable:
    def __init__(self, name: str, db):
        self.name = name
        self.db = db
        self.filters = []
        self.selected_columns = None
        self.upserts = []
        self.updates = []

    def select(self, columns):
        self.selected_columns = columns
        return self

    def eq(self, field, value):
        self.filters.append(("eq", field, value))
        return self

    def is_(self, field, value):
        self.filters.append(("is", field, value))
        return self

    def maybe_single(self):
        return _FakeExecuteResult(self.db["select_rows"].get(self.name))

    def execute(self):
        return _FakeExecuteResult(None)

    def update(self, payload):
        self.updates.append(payload)
        self.db["updates"].append((self.name, payload, list(self.filters)))
        return self

    def upsert(self, payload, on_conflict=None):
        self.upserts.append((payload, on_conflict))
        self.db["upserts"].append((self.name, payload, on_conflict))
        return self


class _FakeSupabase:
    def __init__(self, select_rows=None):
        self.db = {
            "select_rows": select_rows or {},
            "updates": [],
            "upserts": [],
        }

    def table(self, name):
        return _FakeTable(name, self.db)


class TestCacheAndAssetBackfill:
    def test_fetch_prices_accepts_timestamp_last_updated(self, monkeypatch):
        from api import optimize

        supabase = _FakeSupabase(
            select_rows={
                "asset_historical_data": {
                    "ticker": "AAPL",
                    "historical_prices": [
                        {"date": "2026-03-31", "close": 100.0},
                        {"date": "2026-04-01", "close": 101.0},
                    ],
                    "last_updated": "2026-04-02T00:00:00+00:00",
                }
            }
        )

        # Avoid date-sensitive flakiness by making the cache permanently fresh.
        monkeypatch.setattr(optimize, "CACHE_TTL_HOURS", 10_000)

        prices = optimize.fetch_prices(["AAPL"], supabase)

        assert "AAPL" in prices
        assert prices["AAPL"][0]["close"] == 100.0
        assert supabase.db["updates"] == []
        assert supabase.db["upserts"] == []

    def test_fetch_prices_updates_assets_without_upsert(self, monkeypatch):
        from api import optimize

        class FakeTicker:
            def history(self, period):
                import pandas as pd

                return pd.DataFrame(
                    {"Close": [100.0, 101.0]},
                    index=pd.to_datetime(["2021-04-05", "2021-04-06"]),
                )

        supabase = _FakeSupabase(select_rows={"asset_historical_data": None})
        monkeypatch.setattr(optimize.yf, "Ticker", lambda ticker: FakeTicker())

        prices = optimize.fetch_prices(["AAPL"], supabase)

        assert len(prices["AAPL"]) == 2
        assert any(name == "assets" for name, _, _ in supabase.db["updates"])
        assert not any(name == "assets" for name, _, _ in supabase.db["upserts"])
