/**
 * lib/llmProviders.ts
 * LLM provider and model configuration for the AI Research Hub.
 * Used by ProviderSelector, ModelSelector, and the validation endpoint.
 */

export interface LLMProvider {
  id: string
  label: string
  free: boolean
  defaultModel: string
}

export const LLM_PROVIDERS: LLMProvider[] = [
  { id: 'google',     label: 'Google AI Studio', free: true,  defaultModel: 'gemini-2.0-flash' },
  { id: 'groq',       label: 'Groq',             free: true,  defaultModel: 'llama-3.3-70b-versatile' },
  { id: 'deepseek',   label: 'DeepSeek',         free: true,  defaultModel: 'deepseek-chat' },
  { id: 'openai',     label: 'OpenAI',           free: false, defaultModel: 'gpt-4o-mini' },
  { id: 'anthropic',  label: 'Anthropic',        free: false, defaultModel: 'claude-3-5-haiku-20241022' },
  { id: 'openrouter', label: 'OpenRouter',       free: false, defaultModel: '' },
]

const PROVIDER_MODELS: Record<string, string[]> = {
  google:     ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  groq:       ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'],
  deepseek:   ['deepseek-chat', 'deepseek-reasoner'],
  openai:     ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
  anthropic:  ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
  openrouter: [],
}

/** Returns the recommended/default model ID for a provider, or '' if unknown. */
export function getDefaultModel(providerId: string): string {
  return LLM_PROVIDERS.find((p) => p.id === providerId)?.defaultModel ?? ''
}

/** Returns the selectable model list for a provider, or [] if unknown/openrouter. */
export function getModelsForProvider(providerId: string): string[] {
  return PROVIDER_MODELS[providerId] ?? []
}
