/**
 * lib/llmProviders.test.ts
 * TDD unit tests for LLM provider/model configuration.
 */
import { describe, it, expect } from 'vitest'
import {
  LLM_PROVIDERS,
  getDefaultModel,
  getModelsForProvider,
  type LLMProvider,
} from './llmProviders'

describe('LLM_PROVIDERS', () => {
  it('has exactly 6 providers', () => {
    expect(LLM_PROVIDERS).toHaveLength(6)
  })

  it('each provider has id, label, free, and defaultModel fields', () => {
    for (const p of LLM_PROVIDERS) {
      expect(p).toHaveProperty('id')
      expect(p).toHaveProperty('label')
      expect(p).toHaveProperty('free')
      expect(p).toHaveProperty('defaultModel')
    }
  })

  it('Google AI Studio, Groq, and DeepSeek are free', () => {
    const freeIds = LLM_PROVIDERS.filter((p: LLMProvider) => p.free).map((p: LLMProvider) => p.id)
    expect(freeIds).toContain('google')
    expect(freeIds).toContain('groq')
    expect(freeIds).toContain('deepseek')
    expect(freeIds).toHaveLength(3)
  })

  it('OpenAI, Anthropic, and OpenRouter are not free', () => {
    const paidIds = LLM_PROVIDERS.filter((p: LLMProvider) => !p.free).map((p: LLMProvider) => p.id)
    expect(paidIds).toContain('openai')
    expect(paidIds).toContain('anthropic')
    expect(paidIds).toContain('openrouter')
    expect(paidIds).toHaveLength(3)
  })
})

describe('getDefaultModel', () => {
  it('returns gemini-2.0-flash for google', () => {
    expect(getDefaultModel('google')).toBe('gemini-2.0-flash')
  })

  it('returns llama-3.3-70b-versatile for groq', () => {
    expect(getDefaultModel('groq')).toBe('llama-3.3-70b-versatile')
  })

  it('returns deepseek-chat for deepseek', () => {
    expect(getDefaultModel('deepseek')).toBe('deepseek-chat')
  })

  it('returns gpt-4o-mini for openai', () => {
    expect(getDefaultModel('openai')).toBe('gpt-4o-mini')
  })

  it('returns claude-3-5-haiku-20241022 for anthropic', () => {
    expect(getDefaultModel('anthropic')).toBe('claude-3-5-haiku-20241022')
  })

  it('returns empty string for openrouter', () => {
    expect(getDefaultModel('openrouter')).toBe('')
  })

  it('returns empty string for unknown provider', () => {
    expect(getDefaultModel('unknown')).toBe('')
  })
})

describe('getModelsForProvider', () => {
  it('returns non-empty list for google', () => {
    expect(getModelsForProvider('google').length).toBeGreaterThan(0)
    expect(getModelsForProvider('google')).toContain('gemini-2.0-flash')
  })

  it('returns non-empty list for groq', () => {
    expect(getModelsForProvider('groq').length).toBeGreaterThan(0)
    expect(getModelsForProvider('groq')).toContain('llama-3.3-70b-versatile')
  })

  it('returns non-empty list for deepseek', () => {
    expect(getModelsForProvider('deepseek').length).toBeGreaterThan(0)
    expect(getModelsForProvider('deepseek')).toContain('deepseek-chat')
  })

  it('returns non-empty list for openai', () => {
    expect(getModelsForProvider('openai').length).toBeGreaterThan(0)
    expect(getModelsForProvider('openai')).toContain('gpt-4o-mini')
  })

  it('returns non-empty list for anthropic', () => {
    expect(getModelsForProvider('anthropic').length).toBeGreaterThan(0)
    expect(getModelsForProvider('anthropic')).toContain('claude-3-5-haiku-20241022')
  })

  it('returns empty array for openrouter (user types model manually)', () => {
    expect(getModelsForProvider('openrouter')).toEqual([])
  })

  it('returns empty array for unknown provider', () => {
    expect(getModelsForProvider('unknown')).toEqual([])
  })
})
