# Rebalancify

> Portfolio clarity for every platform.

Rebalancify is a free, open-source web application that gives self-directed retail investors a single hub for tracking, analysing, and rebalancing portfolios spread across multiple investment platforms.

---

## What It Does

- **Centralises holdings** across Alpaca, BITKUB, InnovestX, Charles Schwab, Webull, DIME, and any other platform via manual entry.
- **Calculates rebalancing orders** — deterministic, auditable buy/sell orders based on your user-defined target weights. Two rounding modes: Partial (minimise transactions) and Full (achieve exact weights).
- **Executes orders on Alpaca** with your explicit approval in a non-dismissible confirmation dialog. All other platforms receive a manual instruction list in v1.0.
- **Monitors portfolio drift** — daily digest alerts when any asset exceeds your configured drift threshold.
- **Surfaces market news** — portfolio-filtered and macro news from Finnhub and FMP, with rate-limit-safe caching.
- **Discovers related assets** — peer companies, top gainers/losers across US stocks and crypto.

---

## Key Principles

- **You always decide.** Rebalancify calculates and presents — it never allocates or executes without your explicit approval.
- **No financial advice.** All AI outputs (v2.0) carry persistent disclaimers. The system never recommends target weights.
- **Transparent calculations.** Every rebalancing session stores a full snapshot of the input state. You can always audit what the calculator used.
- **Free to use.** Hosted at `rebalancify.app`. All integrations use free-tier APIs. No ads. No subscription required.
- **Self-hostable.** Clone this repository and deploy to your own Vercel + Supabase accounts with no code changes.

---

## Tech Stack

Next.js 15 · TypeScript · Tailwind CSS · Supabase (PostgreSQL + Auth) · Vercel · React Query · Resend

---

## Getting Started

### Hosted version

Visit `https://rebalancify.app` — create a free account.

### Self-hosting

```bash
git clone https://github.com/[your-org]/rebalancify.git
cd rebalancify
pnpm install
cp .env.example .env.local
# Fill in .env.local with your Supabase + Vercel credentials
pnpm dev
```

See `docs/development/01-dev-environment.md` for a complete setup guide.

---

## Platform Support (v1.0)

| Platform           | Holdings Fetch | Order Execution           |
| ------------------ | -------------- | ------------------------- |
| Alpaca             | Automated      | Automated (user-approved) |
| BITKUB             | Automated      | Manual (v2.0)             |
| InnovestX          | Automated      | Manual (v2.0)             |
| Charles Schwab     | Automated      | Manual (v2.0)             |
| Webull             | Automated      | Manual (v2.0)             |
| DIME               | Manual entry   | — (no API)               |
| Any other platform | Manual entry   | —                        |

---

## Release Roadmap

| Release              | Scope                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **v1.0 (MVP)** | Portfolio tracking, rebalancing engine, platform silos, Alpaca execution, drift monitoring, news feed, asset discovery |
| **v2.0**       | AI Research Hub (RAG + LLM BYOK), automated execution for BITKUB / InnovestX / Schwab / Webull                         |
| **v3.0+**      | Tax-lot tracking, additional exchanges, native mobile app, GraphRAG                                                    |

---

## For Developers

See the `docs/` directory:

- `docs/prd/` — Product requirements and feature specifications
- `docs/architecture/` — Database schema, API contract, component tree, build order
- `docs/design/` — Design system, component library, screen flows
- `docs/development/` — Dev environment, coding standards, testing, deployment
- `stories/` — Epics and user stories with acceptance criteria

All Claude Code agents and new contributors: read `KICKSTART.md` first — it is the mandatory entry point that defines reading order, rules, and resume protocol. CLAUDE.md is the second document to read, per KICKSTART.md's Section 2.

---

## Licence

MIT. See `LICENSE`.

---

## Disclaimer

This software is provided for informational and educational purposes only. Nothing in Rebalancify constitutes financial advice. Consult a licensed financial advisor before making investment decisions.
