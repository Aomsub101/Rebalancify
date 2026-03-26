# docs/prd/05-monetisation.md — Monetisation Strategy

## AGENT CONTEXT

**What this file is:** The future monetisation options documented for academic discussion. Nothing in this file is implemented in v1.0 or v2.0.
**Derived from:** PRD_v1.3.md Section 9
**Connected to:** docs/prd/00-executive-summary.md
**Critical rules for agents using this file:**
- Nothing in this file should influence implementation decisions. It is documentation only.
- The 5-silo limit IS implemented (it protects the Supabase free tier) — but is not framed as a monetisation gate in the UI.

---

> Rebalancify is and will remain open-source. The following is documented for academic discussion only. No monetisation is implemented in v1.0 or v2.0.

## Option 1: Freemium — Hosted Tier Limits

The hosted instance enforces the 5-silo limit. A future Pro plan could remove limits and add scheduled rebalancing. Self-hosters always get unlimited usage.

## Option 2: Pre-Built Knowledge Base Subscription (v2.0+)

The Research Hub ships with basic `.md` files. A paid subscription could provide a regularly updated, curated knowledge base of financial literature summaries and sector research.

## Option 3: Managed Hosting for Non-Technical Users

One-click hosted instance for users who want a private Rebalancify deployment without managing Vercel + Supabase infrastructure.

## Option 4: Open-Core Model

Core features remain open-source. A closed-source "Rebalancify Pro" binary adds: automated scheduled rebalancing, email reports, multi-user (household) accounts, and priority support.

## Why Not Ads

Conflicts with the transparency and user autonomy core values. The product handles sensitive financial data and decisions — advertising creates conflicts of interest.
