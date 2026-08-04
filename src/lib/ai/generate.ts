import { AiError, type AiConfig, type ChatMessage, type GenerateResult } from './types'
import { HANDOFF_SENTINEL, aiRequestTimeoutMs } from './defaults'
import { generateOpenAi } from './providers/openai'
import { generateAnthropic } from './providers/anthropic'
import { generateOpenAiCompatible } from './providers/openai-compatible'

/** Chat Completions endpoint per OpenAI-compatible provider. */
const OPENAI_COMPATIBLE_ENDPOINT: Record<string, { baseUrl: string; providerLabel: string }> = {
  kimi: {
    baseUrl: 'https://api.moonshot.ai/v1/chat/completions',
    providerLabel: 'Kimi',
  },
  grok: {
    baseUrl: 'https://api.x.ai/v1/chat/completions',
    providerLabel: 'Grok',
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    providerLabel: 'Gemini',
  },
}

export interface GenerateArgs {
  config: AiConfig
  /** Fully-built system prompt (see `buildSystemPrompt`). */
  systemPrompt: string
  /** Recent conversation turns, oldest first. */
  messages: ChatMessage[]
}

/**
 * Generate the next reply from the account's configured provider.
 * Dispatches to the right adapter, then parses the handoff sentinel out
 * of the raw text. Throws `AiError` on any provider/network failure.
 */
export async function generateReply(args: GenerateArgs): Promise<GenerateResult> {
  const { config, systemPrompt, messages } = args
  const timeoutMs = aiRequestTimeoutMs()
  const providerArgs = {
    apiKey: config.apiKey,
    model: config.model,
    systemPrompt,
    messages,
    timeoutMs,
  }

  let raw: string
  switch (config.provider) {
    case 'openai':
      raw = await generateOpenAi(providerArgs)
      break
    case 'anthropic':
      raw = await generateAnthropic(providerArgs)
      break
    case 'kimi':
    case 'grok':
    case 'gemini': {
      const endpoint = OPENAI_COMPATIBLE_ENDPOINT[config.provider]
      raw = await generateOpenAiCompatible({ ...providerArgs, ...endpoint })
      break
    }
    default:
      throw new AiError(`Unsupported AI provider: ${config.provider}`, {
        code: 'unsupported_provider',
        status: 400,
      })
  }

  return parseGeneration(raw)
}

/**
 * Split the raw model output into `{ text, handoff }`. The sentinel can
 * appear alone or trailing a partial reply; either way we treat the
 * turn as a handoff and strip the marker from any remaining text.
 */
export function parseGeneration(raw: string): GenerateResult {
  const handoff = raw.includes(HANDOFF_SENTINEL)
  const text = raw.split(HANDOFF_SENTINEL).join('').trim()
  return { text, handoff }
}
