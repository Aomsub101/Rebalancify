-- Rebalancify Initial Schema
-- Migration: 0001
-- Run this in your Supabase SQL editor or via Supabase CLI

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. user_profiles
-- ============================================================
create table if not exists public.user_profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  email            text not null,
  display_name     text,
  base_currency    text not null default 'USD',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "Users can view own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = id);

-- ============================================================
-- 2. silos
-- ============================================================
create table if not exists public.silos (
  id                          uuid primary key default uuid_generate_v4(),
  user_id                     uuid not null references public.user_profiles(id) on delete cascade,
  name                        text not null,
  platform_type               text not null check (platform_type in ('alpaca', 'manual')),
  alpaca_account_id           text,
  alpaca_api_key_encrypted    text,
  alpaca_api_secret_encrypted text,
  cash_balance                numeric(20, 8) not null default 0,
  currency                    text not null default 'USD',
  is_active                   boolean not null default true,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists idx_silos_user_id on public.silos(user_id);

alter table public.silos enable row level security;

create policy "Users can manage own silos"
  on public.silos for all
  using (auth.uid() = user_id);

-- ============================================================
-- 3. assets (global — no user ownership)
-- ============================================================
create table if not exists public.assets (
  id         uuid primary key default uuid_generate_v4(),
  ticker     text not null unique,
  name       text not null,
  asset_type text not null check (asset_type in ('stock', 'crypto', 'etf')),
  exchange   text,
  currency   text not null default 'USD',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assets_ticker on public.assets(ticker);

alter table public.assets enable row level security;

create policy "Assets are publicly readable"
  on public.assets for select
  using (true);

-- ============================================================
-- 4. asset_mappings
-- ============================================================
create table if not exists public.asset_mappings (
  id              uuid primary key default uuid_generate_v4(),
  asset_id        uuid not null references public.assets(id) on delete cascade,
  platform_type   text not null,
  platform_symbol text not null,
  created_at      timestamptz not null default now(),
  unique (platform_type, platform_symbol)
);

create index if not exists idx_asset_mappings_asset_id on public.asset_mappings(asset_id);

alter table public.asset_mappings enable row level security;

create policy "Asset mappings are publicly readable"
  on public.asset_mappings for select
  using (true);

-- ============================================================
-- 5. holdings
-- ============================================================
create table if not exists public.holdings (
  id             uuid primary key default uuid_generate_v4(),
  silo_id        uuid not null references public.silos(id) on delete cascade,
  asset_id       uuid not null references public.assets(id) on delete restrict,
  quantity       numeric(30, 10) not null default 0,
  average_cost   numeric(20, 8),
  source         text not null check (source in ('manual', 'alpaca_sync')),
  last_synced_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (silo_id, asset_id)
);

create index if not exists idx_holdings_silo_id on public.holdings(silo_id);
create index if not exists idx_holdings_asset_id on public.holdings(asset_id);

alter table public.holdings enable row level security;

create policy "Users can manage holdings in own silos"
  on public.holdings for all
  using (
    exists (
      select 1 from public.silos
      where silos.id = holdings.silo_id
        and silos.user_id = auth.uid()
    )
  );

-- ============================================================
-- 6. target_weights
-- ============================================================
create table if not exists public.target_weights (
  id         uuid primary key default uuid_generate_v4(),
  silo_id    uuid not null references public.silos(id) on delete cascade,
  asset_id   uuid not null references public.assets(id) on delete restrict,
  target_pct numeric(7, 4) not null check (target_pct >= 0 and target_pct <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (silo_id, asset_id)
);

create index if not exists idx_target_weights_silo_id on public.target_weights(silo_id);

alter table public.target_weights enable row level security;

create policy "Users can manage target weights for own silos"
  on public.target_weights for all
  using (
    exists (
      select 1 from public.silos
      where silos.id = target_weights.silo_id
        and silos.user_id = auth.uid()
    )
  );

-- ============================================================
-- 7. price_cache (global)
-- ============================================================
create table if not exists public.price_cache (
  id         uuid primary key default uuid_generate_v4(),
  asset_id   uuid not null references public.assets(id) on delete cascade,
  price      numeric(30, 10) not null,
  currency   text not null default 'USD',
  fetched_at timestamptz not null default now(),
  source     text not null,
  unique (asset_id, source)
);

create index if not exists idx_price_cache_asset_id on public.price_cache(asset_id);
create index if not exists idx_price_cache_fetched_at on public.price_cache(fetched_at);

alter table public.price_cache enable row level security;

create policy "Price cache is publicly readable"
  on public.price_cache for select
  using (true);

-- View: price_cache_fresh — only entries fetched within the last 15 minutes
create or replace view public.price_cache_fresh as
  select *
  from public.price_cache
  where fetched_at >= now() - interval '15 minutes';

-- ============================================================
-- 8. fx_rates (global)
-- ============================================================
create table if not exists public.fx_rates (
  id            uuid primary key default uuid_generate_v4(),
  from_currency text not null,
  to_currency   text not null,
  rate          numeric(20, 8) not null,
  fetched_at    timestamptz not null default now(),
  source        text not null,
  unique (from_currency, to_currency, source)
);

create index if not exists idx_fx_rates_pair on public.fx_rates(from_currency, to_currency);

alter table public.fx_rates enable row level security;

create policy "FX rates are publicly readable"
  on public.fx_rates for select
  using (true);

-- ============================================================
-- 9. rebalance_sessions
-- ============================================================
create table if not exists public.rebalance_sessions (
  id              uuid primary key default uuid_generate_v4(),
  silo_id         uuid not null references public.silos(id) on delete cascade,
  user_id         uuid not null references public.user_profiles(id) on delete cascade,
  mode            text not null check (mode in ('partial', 'full')),
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'partial', 'cancelled')),
  snapshot_before jsonb,
  snapshot_after  jsonb,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_rebalance_sessions_silo_id on public.rebalance_sessions(silo_id);
create index if not exists idx_rebalance_sessions_user_id on public.rebalance_sessions(user_id);

alter table public.rebalance_sessions enable row level security;

create policy "Users can manage own rebalance sessions"
  on public.rebalance_sessions for all
  using (auth.uid() = user_id);

-- ============================================================
-- 10. rebalance_orders
-- ============================================================
create table if not exists public.rebalance_orders (
  id               uuid primary key default uuid_generate_v4(),
  session_id       uuid not null references public.rebalance_sessions(id) on delete cascade,
  asset_id         uuid not null references public.assets(id) on delete restrict,
  order_type       text not null check (order_type in ('buy', 'sell')),
  quantity         numeric(30, 10) not null,
  estimated_price  numeric(20, 8) not null,
  executed_price   numeric(20, 8),
  execution_status text not null default 'pending'
                     check (execution_status in (
                       'pending', 'submitted', 'filled',
                       'partial_fill', 'cancelled', 'failed'
                     )),
  alpaca_order_id  text,
  error_message    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_rebalance_orders_session_id on public.rebalance_orders(session_id);
create index if not exists idx_rebalance_orders_asset_id on public.rebalance_orders(asset_id);

alter table public.rebalance_orders enable row level security;

create policy "Users can manage orders in own sessions"
  on public.rebalance_orders for all
  using (
    exists (
      select 1 from public.rebalance_sessions
      where rebalance_sessions.id = rebalance_orders.session_id
        and rebalance_sessions.user_id = auth.uid()
    )
  );

-- ============================================================
-- 11. news_cache (global)
-- ============================================================
create table if not exists public.news_cache (
  id           uuid primary key default uuid_generate_v4(),
  headline     text not null,
  summary      text,
  source       text not null,
  url          text not null unique,
  image_url    text,
  tickers      text[] not null default '{}',
  published_at timestamptz not null,
  fetched_at   timestamptz not null default now()
);

create index if not exists idx_news_cache_published_at on public.news_cache(published_at desc);
-- GIN index for efficient array containment queries on tickers
create index if not exists idx_news_cache_tickers_gin on public.news_cache using gin(tickers);

alter table public.news_cache enable row level security;

create policy "News cache is publicly readable"
  on public.news_cache for select
  using (true);

-- ============================================================
-- 12. user_article_state
-- ============================================================
create table if not exists public.user_article_state (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.user_profiles(id) on delete cascade,
  article_id uuid not null references public.news_cache(id) on delete cascade,
  is_read    boolean not null default false,
  is_saved   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, article_id)
);

create index if not exists idx_user_article_state_user_id on public.user_article_state(user_id);

alter table public.user_article_state enable row level security;

create policy "Users can manage own article states"
  on public.user_article_state for all
  using (auth.uid() = user_id);

-- ============================================================
-- AUTH TRIGGER: auto-create user_profiles on sign-up
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
