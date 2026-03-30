# STORY-030 — LLM Key Storage & Settings (v2.0)

## AGENT CONTEXT

**What this file is:** A user story specification for LLM API key storage (6 providers, AES-256-GCM encrypted) and the LLM settings section with provider/model selectors. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F3-R1 (LLM key BYOK), F3-R2 (provider selection and model defaults)
**Connected to:** `docs/architecture/02-database-schema.md` (user_profiles llm_key_enc, llm_provider, llm_model columns), `docs/architecture/03-api-contract.md` (profile PATCH/GET LLM fields), `docs/architecture/04-component-tree.md` (LLMSection, ProviderSelector, ModelSelector, LLMKeyInput)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-09 — AI Research Hub
**Phase:** 8
**Estimate:** 1 developer-day
**Status:** 🔲 Not started
**Depends on:** STORY-009 (encryption pattern), STORY-016 (Settings page complete)
**Blocks:** STORY-031, STORY-032

---

## User Story

As a user wanting to use the AI Research Hub, I can store my LLM API key from one of six supported providers in Settings, with free-tier options clearly labelled.

---

## Acceptance Criteria

1. `PATCH /api/profile` with `llm_provider`, `llm_key`, and `llm_model` encrypts `llm_key` using the same AES-256-GCM pattern as broker keys. Returns `{ llm_connected: true }`.
2. `GET /api/profile` returns `{ llm_connected: bool, llm_provider: string | null, llm_model: string | null }`. Never returns the encrypted key or ciphertext.
3. Settings page: `LLMSection` renders below the broker sections. Shows `FreeTierNote`: "Gemini 2.0 Flash (Google AI Studio), Llama 3.3 70B (Groq), and DeepSeek V3 are free."
4. `ProviderSelector` dropdown shows all 6 providers. Free-tier ones are labelled `(Free)`: Google AI Studio (Free), Groq (Free), DeepSeek (Free). Paid ones: OpenAI, Anthropic, OpenRouter.
5. `ModelSelector` is filtered by the selected provider. Pre-fills with the recommended model for each provider:
   - Google → `gemini-2.0-flash`
   - Groq → `llama-3.3-70b-versatile`
   - DeepSeek → `deepseek-chat`
   - OpenAI → `gpt-4o-mini`
   - Anthropic → `claude-3-5-haiku-20241022`
   - OpenRouter → empty (user chooses)
6. `LLMKeyInput` is `type="password"` with show/hide toggle. Shows `••••••••` after save.
7. If the configured LLM key is invalid (test via a ping call to the provider): Settings shows an inline error "Key validation failed — check your API key."
8. Security: LLM key never appears in any API response or browser network request.

---

## Tasks

- [x] Update `app/api/profile/route.ts` PATCH: LLM key encryption
- [x] Update Settings page: add `LLMSection` below broker sections
- [x] Write `ProviderSelector` and `ModelSelector` components
- [x] Add key validation ping call (optional lightweight verify on save)
- [x] Security test: LLM key not in any response
- [x] Unit test: encryption round trip (same as broker key test)

---

## Definition of Done

- [ ] All 8 acceptance criteria verified
- [ ] All 6 providers + correct pre-filled models in the selector
- [ ] Security test documented
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] `bd close <task-id> "STORY-030 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] Every page implemented in this story exports a `metadata` object or `generateMetadata` function following the format `[Page Name] | Rebalancify`
