# Sub-Component: LLM Settings Section

## 1. The Goal

Allow users to configure their LLM provider, model, and API key from Settings. The section must clearly distinguish free-tier providers from paid ones, pre-select the recommended model per provider, and securely handle the key — never exposing it in any API response or browser network request.

---

## 2. The Problem It Solves

Users need a simple, guided way to connect their own LLM API key (BYOK model). Without a settings UI, they would have no way to configure the Research Hub. The section must prevent users from accidentally selecting a paid provider without understanding the implications, and must never log or return the plaintext key.

---

## 3. The Proposed Solution / Underlying Concept

### Section Placement

`LLMSection` renders below the broker sections in the Settings page (`/settings`).

### Free-Tier Labelling

Six providers are shown in `ProviderSelector`. Free ones are labelled `(Free)`:
- **Google AI Studio (Free)** → `gemini-2.0-flash`
- **Groq (Free)** → `llama-3.3-70b-versatile`
- **DeepSeek (Free)** → `deepseek-chat`
- **OpenAI** → `gpt-4o-mini`
- **Anthropic** → `claude-3-5-haiku-20241022`
- **OpenRouter** → empty (user must select)

### FreeTierNote

A note below the section reads: "Gemini 2.0 Flash (Google AI Studio), Llama 3.3 70B (Groq), and DeepSeek V3 are free."

### Key Input

`LLMKeyInput` uses `type="password"` with a show/hide toggle button. After saving, the UI shows `••••••••` — the plaintext key is never rendered after initial entry.

### Validation on Save

On save, a lightweight ping is made to the selected provider. If the key is invalid, an inline error is shown: "Key validation failed — check your API key."

### API Calls

- `PATCH /api/profile` with `{ llm_provider, llm_key, llm_model }` — encrypts and stores
- `GET /api/profile` returns `{ llm_connected, llm_provider, llm_model }` — never the ciphertext

### Security

The plaintext key travels only from browser → API route (HTTPS), is encrypted server-side using AES-256-GCM (same pattern as broker keys), and is never returned in any response.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| All 6 providers in dropdown | Visual: open ProviderSelector → all 6 present |
| Free tiers labelled (Free) | Visual: Google, Groq, DeepSeek show "(Free)" label |
| Model pre-filled on provider change | Select "Groq" → ModelSelector auto-fills "llama-3.3-70b-versatile" |
| Key shown as `••••••••` after save | Save key → input shows dots, not plaintext |
| Invalid key shows error | Enter bad key + save → inline error appears |
| `llm_connected` returned in GET | `GET /api/profile` → `llm_connected: true/false` in response |
| Key never in GET response | `GET /api/profile` → no `llm_key` or ciphertext field |
