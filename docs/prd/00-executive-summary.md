# docs/prd/00-executive-summary.md — Executive Summary

## AGENT CONTEXT

**What this file is:** The one-page executive summary of the Rebalancify PRD. Entry point for anyone new to the project.
**Derived from:** PRD_v1.3.md Section 1 (Executive Summary), Section 1.4 (Release Roadmap)
**Connected to:** docs/prd/01-problem-statement.md, docs/prd/02-personas.md, CLAUDE.md, README.md
**Critical rules for agents using this file:**
- This file must never contradict CLAUDE.md Section 1 (Project Identity).
- The release roadmap table must stay consistent with PROGRESS.md epic status.

---

## Problem

Retail investors holding assets across multiple disconnected platforms face a persistent operational problem: maintaining desired asset allocation requires tedious manual calculation across accounts that cannot communicate with each other. Professional robo-advisors partially solve this but charge fees, enforce rigid allocation models, and rarely support non-US or crypto platforms.

---

## Solution

Rebalancify is a free, open-source, production-grade web application that gives self-directed retail investors a single decision-support hub for managing, analysing, and rebalancing multi-platform portfolios. It is platform-agnostic, respects user autonomy by never making allocation decisions on behalf of the user, and exposes its full source code on GitHub while remaining accessible through a hosted production URL.

---

## Core Values

| Value | Meaning in Practice |
|---|---|
| **User Autonomy** | The user always makes the final investment decision. No order is submitted without an explicit confirmation click. |
| **Transparency** | All calculations are deterministic and auditable. Every rebalancing session stores a full input snapshot. AI outputs carry persistent disclaimers. |
| **Data-Driven Insights** | Aggregated news, sentiment, and peer data surface information users would otherwise spend hours gathering. |
| **Platform Agnosticism** | The app works with any brokerage — whether or not an API integration exists. |

---

## Release Roadmap

| Release | Scope | Status |
|---|---|---|
| **v1.0 (MVP)** | Portfolio tracking, rebalancing engine, platform silos (Alpaca / BITKUB / InnovestX / Schwab / Webull / manual), Alpaca automated execution, drift monitoring, news feed, asset discovery, PWA | This PRD |
| **v2.0** | Automated execution for BITKUB / InnovestX / Schwab / Webull; AI Research Hub (Trust Engine); RAG pipeline; LLM Insight layer (BYOK — 5 direct providers + OpenRouter) | Post-MVP |
| **v3.0+** | Tax-lot tracking, additional exchange integrations, native mobile app, GraphRAG upgrade | Future |

---

## Technology Choices (Summary)

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js 15 / React 19 / PWA | SSR + PWA + API route proxying in one framework |
| Hosting | Vercel free tier | Zero cost, zero config |
| Database | Supabase PostgreSQL | 500 MB free; RLS; pgvector for v2.0 RAG |
| Auth | Supabase Auth | Email + password; built-in password reset |
| Email | Resend free tier | 3,000 emails/month; best practice for Vercel/Next.js |

Full tech stack: `CLAUDE.md` Section 2.

---

## Scope Boundaries

**v1.0 explicitly excludes:** Tax-lot tracking, options/futures/derivatives, non-US/crypto stock exchanges (SET, LSE), AI financial advice, executing trades without user approval, native iOS/Android apps, multi-user accounts, live price push notifications, manual price entry, historical price storage, automated execution for BITKUB / InnovestX / Schwab / Webull.

Full non-goals list: `docs/prd/03-non-goals.md`.
