# docs/prd/01-problem-statement.md — Problem Statement

## AGENT CONTEXT

**What this file is:** The detailed problem statement that justifies Rebalancify's existence.
**Derived from:** PRD_v1.3.md Section 1.1–1.3
**Connected to:** docs/prd/02-personas.md, docs/prd/00-executive-summary.md
**Critical rules for agents using this file:**
- Requirements must trace to this problem. If a feature doesn't solve this problem, it's out of scope.

---

## The Problem

Retail investors holding assets across multiple disconnected platforms face a persistent operational challenge: maintaining their desired asset allocation requires tedious manual calculation across accounts that cannot communicate with each other.

### Specific pain points

**1. Manual calculation is error-prone.** A portfolio spread across Alpaca (USD stocks), BITKUB (THB crypto), and DIME (THB/USD equities) requires the investor to: manually note current prices, convert currencies, compute total portfolio value, compute current weights, compute delta from target weights, compute buy/sell quantities, and then execute those orders — across three separate platforms with three separate UIs.

**2. Professional tools don't serve this user.** Robo-advisors (Betterment, Wealthfront) charge ongoing fees, enforce their own allocation models, and only support US platforms. Wealth management software (Quicken, Personal Capital) focuses on tracking, not rebalancing, and doesn't support Thai brokerages.

**3. Free tools are insufficient.** Spreadsheet templates exist but break when holdings change. Portfolio tracker apps (e.g., Delta) show drift but don't calculate rebalancing orders. None support API integration with Thai platforms.

**4. There is no solution for the Thailand + US crossover user.** An investor using both BITKUB and Alpaca has no single tool that understands both platforms, fetches live prices from the right source, and handles THB/USD currency isolation.

### Why "open-source" is part of the solution

Proprietary tools create trust problems for a financial instrument. An investor trusting a tool with their brokerage API keys needs to verify what the tool does with those keys. Open-source code eliminates this problem — the user can read exactly what happens to their credentials.

### The solution space

Rebalancify occupies a gap: more powerful than spreadsheets (live API integration, automatic price fetching, deterministic calculation engine), less restrictive than robo-advisors (user retains full control over target weights and execution), and free (no fees, no subscriptions, self-hostable).
