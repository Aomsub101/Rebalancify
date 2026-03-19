/**
 * Represents a user's public profile, extending Supabase Auth with app-specific fields.
 */
export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  base_currency: string;
  created_at: string;
  updated_at: string;
}

/**
 * A Silo is a logical grouping of holdings tied to a single investment platform or manual bucket.
 */
export interface Silo {
  id: string;
  user_id: string;
  name: string;
  platform_type: 'alpaca' | 'manual';
  alpaca_account_id: string | null;
  alpaca_api_key_encrypted: string | null;
  alpaca_api_secret_encrypted: string | null;
  cash_balance: string;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * A globally shared asset (stock, crypto, or ETF) that any user can reference.
 */
export interface Asset {
  id: string;
  ticker: string;
  name: string;
  asset_type: 'stock' | 'crypto' | 'etf';
  exchange: string | null;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Maps a platform-specific asset identifier to the canonical Asset record.
 */
export interface AssetMapping {
  id: string;
  asset_id: string;
  platform_type: string;
  platform_symbol: string;
  created_at: string;
}

/**
 * Represents the quantity of a specific asset held within a silo.
 */
export interface Holding {
  id: string;
  silo_id: string;
  asset_id: string;
  quantity: string;
  average_cost: string | null;
  source: 'manual' | 'alpaca_sync';
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * The user-defined target allocation weight for an asset within a silo.
 */
export interface TargetWeight {
  id: string;
  silo_id: string;
  asset_id: string;
  target_pct: string;
  created_at: string;
  updated_at: string;
}

/**
 * Cached market price for an asset, sourced from a third-party data provider.
 */
export interface PriceCache {
  id: string;
  asset_id: string;
  price: string;
  currency: string;
  fetched_at: string;
  source: string;
}

/**
 * Cached foreign exchange rate between two currencies.
 */
export interface FxRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: string;
  fetched_at: string;
  source: string;
}

/**
 * A rebalancing session capturing the intent and outcome of a rebalancing run.
 */
export interface RebalanceSession {
  id: string;
  silo_id: string;
  user_id: string;
  mode: 'partial' | 'full';
  status: 'pending' | 'approved' | 'partial' | 'cancelled';
  snapshot_before: Record<string, unknown> | null;
  snapshot_after: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * An individual buy or sell order generated as part of a rebalancing session.
 */
export interface RebalanceOrder {
  id: string;
  session_id: string;
  asset_id: string;
  order_type: 'buy' | 'sell';
  quantity: string;
  estimated_price: string;
  executed_price: string | null;
  execution_status: 'pending' | 'submitted' | 'filled' | 'partial_fill' | 'cancelled' | 'failed';
  alpaca_order_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * A cached news article from a third-party provider, tagged with relevant asset tickers.
 */
export interface NewsArticle {
  id: string;
  headline: string;
  summary: string | null;
  source: string;
  url: string;
  image_url: string | null;
  tickers: string[];
  published_at: string;
  fetched_at: string;
}

/**
 * Tracks a user's read/saved state for a specific news article.
 */
export interface UserArticleState {
  id: string;
  user_id: string;
  article_id: string;
  is_read: boolean;
  is_saved: boolean;
  created_at: string;
  updated_at: string;
}
