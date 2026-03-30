/**
 * lib/llmRouter.ts
 * Provider-aware routing for 6 LLM providers.
 *
 * Supported Providers:
 *   - anthropic  → Anthropic SDK
 *   - openai     → OpenAI SDK (native)
 *   - google     → OpenAI SDK (base_url override)
 *   - groq       → OpenAI SDK (base_url override)
 *   - deepseek   → OpenAI SDK (base_url override)
 *   - openrouter → OpenAI SDK (base_url override)
 */

export async function callLLM(
  provider: string,
  model: string,
  decryptedKey: string,
  messages: any[],
) {
  if (provider === 'anthropic') {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey: decryptedKey })
    return client.messages.create({
      model,
      max_tokens: 1000,
      messages,
    })
  }

  // All others: OpenAI SDK with base_url override
  const baseUrls: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    google: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    groq: 'https://api.groq.com/openai/v1',
    deepseek: 'https://api.deepseek.com',
    openrouter: 'https://openrouter.ai/api/v1',
  }

  const OpenAI = (await import('openai')).default
  const client = new OpenAI({
    apiKey: decryptedKey,
    baseURL: baseUrls[provider] || baseUrls.openai,
    dangerouslyAllowBrowser: false,
  })

  return client.chat.completions.create({
    model,
    messages,
    response_format: { type: 'json_object' },
  })
}
