# docs/design/00-brand-identity.md — Brand Identity

## AGENT CONTEXT

**What this file is:** Brand positioning, voice, tone, logo, and personality guidelines.
**Derived from:** design_preferences.md Section 1
**Connected to:** docs/design/01-design-system.md (tokens from brand), docs/design/CLAUDE_FRONTEND.md (copy rules)
**Critical rules for agents using this file:**
- Copy that contradicts the Do/Don't table in Section 1.2 is a bug, not a style choice.
- Never use emoji in UI copy. Never write "journey", "exciting", or "amazing" in product copy.

---

## Positioning

Rebalancify is a **decision-support tool for self-directed investors**. It is not a trading app, not a social platform, and not a beginner education product. The brand should feel like a high-quality professional instrument — the financial equivalent of a well-made calculator or a Bloomberg terminal that someone actually wants to look at.

**One-sentence brand:** Rebalancify gives self-directed investors the clarity to act on their own convictions — precise calculations, no noise, no advice.

**Brand archetype:** The Trusted Instrument — precise, reliable, transparent. Does exactly what it says. Never pretends to know more than the user.

**Personality axes:**
- Empowering ←→ Neutral (70% empowering, 30% neutral)
- Precise ←→ Approachable (65% precise, 35% approachable)
- Professional ←→ Modern (55% professional, 45% modern)

---

## Voice & Tone

**Principles:**
- **Numbers first** — lead with the data, explain second
- **Active and direct** — "Rebalance now" not "You may want to consider rebalancing"
- **Confident without arrogance** — state facts, never hype
- **Globally readable** — simple English, no idioms, no slang
- **No financial advice language** — never say "you should buy", "this is a good investment", "we recommend"

**Do / Don't:**

| Context | Do | Don't |
|---|---|---|
| Empty silo state | "Add your first holding to get started" | "Your portfolio journey begins here! 🚀" |
| Drift alert | "AAPL is 6.2% above target. Threshold: 5.0%" | "Looks like AAPL needs some attention!" |
| Rebalance complete | "3 orders submitted to Alpaca" | "Great job rebalancing your portfolio!" |
| Error state | "Price data unavailable — showing last updated 14 min ago" | "Oops! We couldn't load prices 😅" |
| Disclaimer | "This is not financial advice" | "Please note that this tool is for informational purposes only and should not be construed as..." |
| Weight warning | "Weights sum to 85%. The remaining 15% will be held as cash." | "Warning: Your weights don't add up to 100%!" |

---

## Logo & Wordmark

**Concept:** A minimal geometric mark — a balance scale reduced to two weighted squares on a horizontal line. Suggests balance, precision, equality.

**Implementation:**
```tsx
<div className="flex items-center gap-2">
  {/* bg-primary = Action Blue (#2E75B6) on the dark navy sidebar — intentional branded accent mark */}
  <div className="w-7 h-7 bg-primary rounded-sm flex items-center justify-center">
    <span className="text-xs font-mono font-bold text-primary-foreground">R</span>
  </div>
  <span className="font-sans font-semibold text-lg tracking-tight">Rebalancify</span>
</div>
```

**Context variations:**
- Full: `Rebalancify` (sans-serif, semibold, `tracking-tight`)
- Short: `RB` monogram in the square mark (icon-only sidebar collapsed state)
- Tagline: `Rebalancify — Portfolio clarity for every platform`
