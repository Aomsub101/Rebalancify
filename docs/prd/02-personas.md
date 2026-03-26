# docs/prd/02-personas.md — Target User Personas

## AGENT CONTEXT

**What this file is:** The persona definitions that every UI and feature decision must serve.
**Derived from:** PRD_v1.3.md Section 2
**Connected to:** docs/prd/features/*.md (every feature must trace to a persona need)
**Critical rules for agents using this file:**
- When copy is ambiguous, default to the Primary Persona's preferences: data-first, no jargon, professional tone.
- The Technical Comfort Matrix governs what complexity is acceptable in the UI.

---

## Primary Persona — The Long-Term Self-Directed Investor

**Profile:** Holds a diversified portfolio across two or more platforms simultaneously. Follows a passive or semi-passive investment strategy with infrequent rebalancing (quarterly or annually). Understands investment concepts — asset allocation, target weights, market sectors, drift — but is not a software developer.

**Key characteristics:**
- Has accounts on 2–4 platforms. May include a US brokerage (Alpaca, Schwab, Webull) and a Thai exchange (BITKUB, InnovestX, DIME).
- Comfortable doing research but finds manual rebalancing calculations tedious and error-prone.
- Trusts a tool that shows its work — wants to see the calculation, not just the result.
- Will not and should not need to interact with API keys unless they choose to enable advanced integrations.
- Reads English fluently but may be a non-native speaker. Simple English, no idioms.

**What this persona does NOT want:**
- The app making decisions for them.
- Recommendations about what to buy.
- Having to re-enter prices manually.
- Reconfiguring the same asset mapping twice.

---

## Geographic Scope

**Global audience, English interface.** Initial platform integrations reflect the developer's context (Thailand + US) but the architecture accommodates any platform that exposes a REST API or accepts manual data entry.

Thai users are in scope for PDPA compliance (data controller requirements). See `docs/architecture/06-security-privacy.md`.

---

## Technical Comfort Matrix

| Capability | Required? | UX Implications |
|---|---|---|
| Create account / log in | Yes — all users | Standard email + password flow. No OAuth required. |
| Manual data entry (holdings quantities, target weights) | Yes — all users | Core workflow. Keep forms simple. Validation inline, not on submit. |
| Confirm asset ticker mapping (one-time per asset) | Yes — manual silo users | Simple search-and-confirm. One-time friction is acceptable. Show clearly it won't repeat. |
| Configure platform API key (Alpaca, BITKUB, etc.) | Optional | Step-by-step instructions provided in-app. Key inputs masked. Clear connection status. |
| Supply LLM API key (v2.0) | Optional | Required for AI Research Hub only. Multiple free options available. Links to key generation pages. |
| Clone the GitHub repository | Optional | Self-hosters only. Not a UX concern for the hosted product. |

---

## Silo Limit

Each user account is limited to a maximum of **5 active platform silos**. This protects database storage on the free Supabase tier. The target persona typically uses 2–4 platforms — 5 is sufficient. The limit is shown visually in the UI at all times (SiloCountBadge `[3/5]` in the sidebar, `SiloUsageBar` in Settings).
