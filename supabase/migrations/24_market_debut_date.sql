ALTER TABLE assets ADD COLUMN market_debut_date DATE;
COMMENT ON COLUMN assets.market_debut_date IS 'First date yfinance returned price data for this ticker — proxy for market listing/debut. NULL if never fetched.';
CREATE INDEX idx_assets_market_debut_date ON assets(market_debut_date) WHERE market_debut_date IS NOT NULL;
