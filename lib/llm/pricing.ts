/**
 * USD per 1M tokens. Values checked on the providers' own pricing pages
 * (Anthropic: platform.claude.com/docs/en/about-claude/pricing, Google:
 * ai.google.dev/gemini-api/docs/pricing, Groq: console.groq.com/docs/models),
 * last verified 2026-10-06. Update here when a provider changes its rates.
 */
export type ModelPrice = {
  input: number
  output: number
  cacheRead?: number
  cacheWrite?: number
}

export const MODEL_PRICES: Record<string, ModelPrice> = {
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-opus-4-6": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "gemini-3.8-flash": { input: 0.75, output: 3.75 },
  "gemini-3.6-flash": { input: 0.75, output: 3.75 },
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
  "openai/gpt-oss-120b": { input: 0.15, output: 0.6 },
}

export type TokenUsage = {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

export function fromAnthropicUsage(usage: {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
}): TokenUsage {
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
  }
}

/** Dollar cost of one call, or null when the model has no configured price. */
export function computeCostUsd(model: string, usage: TokenUsage): number | null {
  const price = MODEL_PRICES[model]
  if (!price) return null
  const cost =
    usage.inputTokens * price.input +
    usage.outputTokens * price.output +
    (usage.cacheReadTokens ?? 0) * (price.cacheRead ?? price.input) +
    (usage.cacheWriteTokens ?? 0) * (price.cacheWrite ?? price.input)
  return cost / 1_000_000
}
