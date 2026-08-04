import { AiError } from '../types'
import { MAX_OUTPUT_TOKENS } from '../defaults'
import {
  mergeConsecutive,
  providerHttpError,
  toNetworkError,
  type ProviderArgs,
} from './shared'

interface OpenAiCompatibleResponse {
  choices?: { message?: { content?: string } }[]
}

/**
 * Call any OpenAI-compatible Chat Completions endpoint (Kimi/Moonshot,
 * Grok/xAI, Gemini, …) with the caller's own key. Same wire format as
 * `generateOpenAi`, parametrized by base URL and display name.
 * Returns the raw assistant text (handoff parsing happens in
 * `generateReply`).
 */
export async function generateOpenAiCompatible(
  args: ProviderArgs & { baseUrl: string; providerLabel: string },
): Promise<string> {
  const { apiKey, model, systemPrompt, messages, timeoutMs, baseUrl, providerLabel } = args

  let res: Response
  try {
    res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...mergeConsecutive(messages),
        ],
        max_completion_tokens: MAX_OUTPUT_TOKENS,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    throw toNetworkError(err)
  }

  if (!res.ok) {
    throw await providerHttpError(providerLabel, res)
  }

  const data = (await res.json().catch(() => null)) as OpenAiCompatibleResponse | null
  const text = data?.choices?.[0]?.message?.content
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new AiError(`${providerLabel} returned an empty response.`, {
      code: 'empty_response',
    })
  }
  return text
}
