# TS.1.3 — LLM Key Gate

## Task
Build LLMKeyGate component that blocks Research Hub access when no LLM key is configured.

## Target
`components/research/LLMKeyGate.tsx`

## Inputs
- `docs/architecture/components/08_ai_research_hub/02_llm_key_gate.md`

## Process
1. Create `components/research/LLMKeyGate.tsx`:
   - Reads `llm_connected` from SessionContext/profile
   - If `llm_connected = false`: render gate message
     - "To use the Research Hub, add your LLM API key in Settings."
     - Link to `/settings` (scrolls to LLM section)
   - If `llm_connected = true`: render children (research UI)
   - No research UI rendered behind this gate — not even loading skeletons
2. Used in `/research/[ticker]` page as outer wrapper

## Outputs
- `components/research/LLMKeyGate.tsx`

## Verify
- No key → gate message shown, no research UI
- Key configured → research UI shown
- Settings link navigates correctly

## Handoff
→ Sprint 2 (Knowledge base)
