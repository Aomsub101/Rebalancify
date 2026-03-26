# docs/architecture/00-system-overview.md — System Overview

## AGENT CONTEXT

**What this file is:** A high-level architectural overview — deployment model, request flow, data flow, and the relationship between all architectural components.
**Derived from:** PRD_v1.3.md Section 5, TECH_DOCS_v1.2.md (all DOC sections)
**Connected to:** docs/architecture/01-tech-stack-decisions.md, docs/architecture/02-database-schema.md, docs/architecture/03-api-contract.md
**Critical rules for agents using this file:**
- This is a read-only orientation document. Implementation details live in the specific architecture files.
- The "never call external APIs from the browser" rule in this document is absolute. See CLAUDE.md Rule 5.

---

## Deployment Model

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                           │
│  Next.js App (React, Tailwind, TanStack Query, next-pwa)         │
│  - Authenticated via Supabase JWT                                │
│  - Never holds API keys                                          │
│  - Service Worker: offline caching of last-known state           │
└────────────────────┬─────────────────────────────────────────────┘
                     │ HTTPS (JWT in Authorization header)
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│              VERCEL SERVERLESS (Next.js API Routes)              │
│  app/api/**                                                      │
│  - Validates Supabase JWT on every request                       │
│  - Decrypts API keys from Supabase (never stored in Vercel)      │
│  - Proxies all external API calls (Alpaca, Finnhub, etc.)        │
│  - Proxies all LLM calls (v2.0)                                  │
└────────┬───────────────────────────┬────────────────────────────┘
         │                           │
         ▼                           ▼
┌─────────────────┐    ┌────────────────────────────────────────┐
│    SUPABASE     │    │        EXTERNAL SERVICES               │
│  PostgreSQL DB  │    │  Finnhub, FMP, CoinGecko               │
│  Supabase Auth  │    │  ExchangeRate-API                      │
│  pgvector(v2.0) │    │  Alpaca, BITKUB, InnovestX             │
│  Storage (v2.0) │    │  Charles Schwab, Webull                │
│  RLS enforced   │    │  Resend (email)                        │
└─────────────────┘    │  LLM Providers (v2.0)                  │
                       └────────────────────────────────────────┘
```

---

## Request Flow (Standard Data Request)

```
Browser component
  → useQuery('silos') [TanStack Query]
  → fetch('/api/silos', { headers: { Authorization: 'Bearer <jwt>' } })
  → Vercel: app/api/silos/route.ts
    → Validate JWT via Supabase server client
    → Query Supabase DB (RLS filters to auth.uid() automatically)
    → Return JSON
  → TanStack Query caches result
  → Component renders
```

---

## Request Flow (External API Call — e.g., Price Fetch)

```
Browser component
  → useQuery('prices') [TanStack Query]
  → fetch('/api/prices/[asset_id]')
  → Vercel: app/api/prices/[asset_id]/route.ts
    → Check price_cache_fresh view (Supabase)
    → If fresh: return cached price
    → If stale: call Finnhub/CoinGecko (key in Vercel env vars)
      → Upsert price_cache
      → Return price
```

---

## Data Ownership Model

| Data | Owner | Shared? | RLS? |
|---|---|---|---|
| `user_profiles` | User | No | Yes |
| `silos` | User | No | Yes |
| `holdings` | User (via silo) | No | Yes |
| `target_weights` | User (via silo) | No | Yes |
| `asset_mappings` | User (via silo) | No | Yes |
| `rebalance_sessions` | User | No | Yes |
| `rebalance_orders` | User (via session) | No | Yes |
| `assets` | Global registry | Yes (read) | Read-only RLS |
| `price_cache` | Global cache | Yes (read) | Read-only RLS |
| `fx_rates` | Global cache | Yes (read) | Read-only RLS |
| `news_cache` | Global cache | Yes (read) | Read-only RLS |
| `user_article_state` | User | No | Yes |
| `knowledge_chunks` | User (v2.0) | No | Yes |
| `research_sessions` | User (v2.0) | No | Yes |

---

## Price Fetching Architecture

Three-tier strategy. The correct tier is selected automatically based on `silos.platform_type` and `assets.asset_type`.

| Tier | Applies To | Source | Cache TTL |
|---|---|---|---|
| 1a | Alpaca silos | Alpaca API at sync time | Per sync |
| 1b | BITKUB silos | BITKUB `/api/market/ticker` | 15 min |
| 2 | Manual silos — stocks/ETFs | Finnhub `/quote` | 15 min |
| 3 | Manual silos — crypto | CoinGecko `/simple/price` | 15 min |

FX rates (ExchangeRate-API): 60-min TTL.

---

## v1.0 vs v2.0 Boundary

**v1.0 (Phases 0–7):** All core portfolio tracking, Alpaca execution, non-Alpaca holdings fetch, drift monitoring, news, discovery, PWA.

**v2.0 (Phases 8–9):** AI Research Hub (RAG + pgvector + LLM BYOK) + automated execution for BITKUB, InnovestX, Schwab, Webull.

The v2.0 tables (`knowledge_chunks`, `research_sessions`) are migrated in Phase 0 alongside all other tables. This avoids a schema migration during active development. They are simply unused until Phase 8.
