import { describe, it, expect, vi, beforeEach } from 'vitest'
import { callLLM } from './llmRouter'

// Mock SDKs
const mockAnthropicCreate = vi.fn()
const mockOpenAICreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockAnthropicCreate,
      },
    })),
  }
})

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation((config) => ({
      config, // Store config for inspection in tests
      chat: {
        completions: {
          create: mockOpenAICreate,
        },
      },
    })),
  }
})

describe('lib/llmRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes to Anthropic SDK for anthropic provider', async () => {
    mockAnthropicCreate.mockResolvedValue({ id: 'msg_123' })
    const messages = [{ role: 'user', content: 'hello' }]
    
    const result = await callLLM('anthropic', 'claude-3', 'key_abc', messages)
    
    expect(mockAnthropicCreate).toHaveBeenCalledWith({
      model: 'claude-3',
      max_tokens: 1000,
      messages,
    })
    expect(result).toEqual({ id: 'msg_123' })
  })

  it('routes to OpenAI SDK with correct baseURL for openai provider', async () => {
    mockOpenAICreate.mockResolvedValue({ id: 'chat_123' })
    const messages = [{ role: 'user', content: 'hello' }]
    
    await callLLM('openai', 'gpt-4', 'key_abc', messages)
    
    const OpenAI = (await import('openai')).default
    expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'key_abc',
      baseURL: 'https://api.openai.com/v1',
    }))
    expect(mockOpenAICreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gpt-4',
      messages,
    }))
  })

  it('routes to OpenAI SDK with correct baseURL for groq provider', async () => {
    mockOpenAICreate.mockResolvedValue({ id: 'chat_123' })
    const messages = [{ role: 'user', content: 'hello' }]
    
    await callLLM('groq', 'llama3', 'key_abc', messages)
    
    const OpenAI = (await import('openai')).default
    expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'key_abc',
      baseURL: 'https://api.groq.com/openai/v1',
    }))
  })

  it('routes to OpenAI SDK with correct baseURL for google provider', async () => {
    mockOpenAICreate.mockResolvedValue({ id: 'chat_123' })
    const messages = [{ role: 'user', content: 'hello' }]
    
    await callLLM('google', 'gemini-1.5', 'key_abc', messages)
    
    const OpenAI = (await import('openai')).default
    expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'key_abc',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    }))
  })

  it('routes to OpenAI SDK with correct baseURL for deepseek provider', async () => {
    mockOpenAICreate.mockResolvedValue({ id: 'chat_123' })
    const messages = [{ role: 'user', content: 'hello' }]
    
    await callLLM('deepseek', 'deepseek-chat', 'key_abc', messages)
    
    const OpenAI = (await import('openai')).default
    expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'key_abc',
      baseURL: 'https://api.deepseek.com',
    }))
  })

  it('routes to OpenAI SDK with correct baseURL for openrouter provider', async () => {
    mockOpenAICreate.mockResolvedValue({ id: 'chat_123' })
    const messages = [{ role: 'user', content: 'hello' }]
    
    await callLLM('openrouter', 'any-model', 'key_abc', messages)
    
    const OpenAI = (await import('openai')).default
    expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'key_abc',
      baseURL: 'https://openrouter.ai/api/v1',
    }))
  })

  it('defaults to OpenAI baseURL for unknown provider', async () => {
    mockOpenAICreate.mockResolvedValue({ id: 'chat_123' })
    
    await callLLM('unknown', 'model', 'key_abc', [])
    
    const OpenAI = (await import('openai')).default
    expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: 'https://api.openai.com/v1',
    }))
  })
})
