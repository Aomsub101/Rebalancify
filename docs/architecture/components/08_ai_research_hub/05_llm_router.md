# Sub-Component: LLM Router

## 1. The Goal

Route LLM inference calls to one of six supported providers (Google AI Studio, Groq, DeepSeek, OpenAI, Anthropic, OpenRouter) using the correct SDK per provider. The routing logic is encapsulated in `lib/llmRouter.ts` and is used exclusively by server-side API routes — the user's API key is never accessible to the browser.

---

## 2. The Problem It Solves

Different LLM providers use different SDKs. Anthropic has its own SDK with a distinct API. OpenAI-compatible providers (Google, Groq, DeepSeek, OpenRouter) use the OpenAI SDK with a provider-specific `base_url` override. Without a unified router, the research API would be a tangle of if/else statements per provider.

---

## 3. The Proposed Solution / Underlying Concept

### Provider SDK Mapping

```typescript
// lib/llmRouter.ts

// Anthropic → own SDK
if (provider === 'anthropic') {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey: decryptedKey })
  return client.messages.create({ model, max_tokens: 1000, messages })
}

// All OpenAI-compatible → OpenAI SDK + base_url override
const baseUrls: Record<string, string> = {
  openai:     'https://api.openai.com/v1',
  google:     'https://generativelanguage.googleapis.com/v1beta/openai/',
  groq:       'https://api.groq.com/openai/v1',
  deepseek:   'https://api.deepseek.com',
  openrouter: 'https://openrouter.ai/api/v1',
}
const OpenAI = (await import('openai')).default
const client = new OpenAI({ apiKey: decryptedKey, baseURL: baseUrls[provider] })
return client.chat.completions.create({ model, messages })
```

### Supported Providers and Models

| Provider | Model | SDK | Free Tier |
|---|---|---|---|
| Google AI Studio | `gemini-2.0-flash` | OpenAI SDK + Google base_url | Yes |
| Groq | `llama-3.3-70b-versatile` | OpenAI SDK + Groq base_url | Yes |
| DeepSeek | `deepseek-chat` | OpenAI SDK + DeepSeek base_url | Yes |
| OpenAI | `gpt-4o-mini` | OpenAI SDK (native) | No |
| Anthropic | `claude-3-5-haiku-20241022` | Anthropic SDK | No |
| OpenRouter | User-selected | OpenAI SDK + OpenRouter base_url | No |

### Message Format

All providers receive messages in OpenAI's `messages` format (`{ role: 'system' | 'user' | 'assistant', content: string }`). Anthropic SDK internally maps this format.

### Key Decryption

`lib/llmRouter.ts` accepts a `decryptedKey: string` argument. The calling API route decrypts `user_profiles.llm_key_enc` before passing it in. The decrypted key is used only within the server-side route and is never logged or returned.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Anthropic routes to Anthropic SDK | Unit (mock): call with `provider='anthropic'` → `Anthropic.messages.create` called |
| Google routes to OpenAI SDK + Google base_url | Unit: verify correct `baseURL` passed to OpenAI constructor |
| Groq routes to OpenAI SDK + Groq base_url | Unit: verify `api.groq.com/openai/v1` used |
| DeepSeek routes to OpenAI SDK + DeepSeek base_url | Unit: verify `api.deepseek.com` used |
| OpenRouter routes to OpenAI SDK + OpenRouter base_url | Unit: verify `openrouter.ai/api/v1` used |
| OpenAI routes to OpenAI SDK (native) | Unit: verify default base_url used |
| All 6 providers have unit tests | Unit tests pass for each provider routing |
| `pnpm test` | All tests pass with exit 0 |
