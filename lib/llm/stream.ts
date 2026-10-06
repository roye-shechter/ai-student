import type Anthropic from "@anthropic-ai/sdk"
import type { Part } from "@google/genai"
import { getAnthropic, getGemini, getGroq } from "@/lib/rag/clients"
import type { TokenUsage } from "./pricing"
import type { ModelTarget } from "./route"
import { joinSystem, type TutorSystem } from "./tutor-prompt"

export type ImageInput = {
  mimeType: "image/jpeg" | "image/png" | "image/webp"
  base64: string
}

export type ModelCall = {
  target: ModelTarget
  system: TutorSystem
  userPrompt: string
  image?: ImageInput
  /** Claude only: adaptive extended thinking + hosted code execution for verified math. */
  verifiedMath?: boolean
  maxOutputTokens: number
  signal?: AbortSignal
}

export type StreamPart = { type: "delta"; text: string } | { type: "usage"; usage: TokenUsage }

/**
 * One streaming interface over Anthropic, Gemini and Groq. Every provider
 * yields the same text deltas and a final usage record, so the chat pipeline,
 * the verifier and analytics never branch on the provider.
 */
export async function* streamModel(call: ModelCall): AsyncGenerator<StreamPart> {
  if (call.target.provider === "anthropic") yield* streamAnthropic(call)
  else if (call.target.provider === "gemini") yield* streamGemini(call)
  else yield* streamGroq(call)
}

async function* streamAnthropic(call: ModelCall): AsyncGenerator<StreamPart> {
  const anthropic = getAnthropic()
  const content: Anthropic.ContentBlockParam[] = []
  if (call.image) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: call.image.mimeType, data: call.image.base64 },
    })
  }
  content.push({ type: "text", text: call.userPrompt })

  const stream = anthropic.messages.stream(
    {
      model: call.target.model,
      max_tokens: call.maxOutputTokens,
      system: [
        { type: "text", text: call.system.staticPolicy, cache_control: { type: "ephemeral" } },
        ...(call.system.dynamic ? [{ type: "text" as const, text: call.system.dynamic }] : []),
      ],
      messages: [{ role: "user", content }],
      ...(call.verifiedMath
        ? {
            thinking: { type: "adaptive" as const },
            output_config: { effort: "high" as const },
            tools: [{ type: "code_execution_20260521" as const, name: "code_execution" as const }],
          }
        : {}),
    },
    { signal: call.signal }
  )

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield { type: "delta", text: event.delta.text }
    }
  }

  const final = await stream.finalMessage()
  yield {
    type: "usage",
    usage: {
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
      cacheReadTokens: final.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: final.usage.cache_creation_input_tokens ?? 0,
    },
  }
}

async function* streamGemini(call: ModelCall): AsyncGenerator<StreamPart> {
  const gemini = getGemini()
  const parts: Part[] = []
  if (call.image) {
    parts.push({ inlineData: { mimeType: call.image.mimeType, data: call.image.base64 } })
  }
  parts.push({ text: call.userPrompt })

  const request = {
    model: call.target.model,
    contents: [{ role: "user" as const, parts }],
    config: {
      systemInstruction: joinSystem(call.system),
      maxOutputTokens: call.maxOutputTokens,
      abortSignal: call.signal,
    },
  }
  const stream = await openGeminiStream(() => gemini.models.generateContentStream(request))

  let lastUsage: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    thoughtsTokenCount?: number
    cachedContentTokenCount?: number
  } | undefined
  for await (const chunk of stream) {
    if (chunk.text) yield { type: "delta", text: chunk.text }
    if (chunk.usageMetadata) lastUsage = chunk.usageMetadata
  }

  const cached = lastUsage?.cachedContentTokenCount ?? 0
  yield {
    type: "usage",
    usage: {
      inputTokens: Math.max(0, (lastUsage?.promptTokenCount ?? 0) - cached),
      outputTokens: (lastUsage?.candidatesTokenCount ?? 0) + (lastUsage?.thoughtsTokenCount ?? 0),
      cacheReadTokens: cached,
    },
  }
}

/**
 * Gemini returns transient 503/429 "high demand" errors on busy models. One
 * short retry before the stream starts recovers most of them without the
 * student seeing a fallback.
 */
async function openGeminiStream<T>(open: () => Promise<T>): Promise<T> {
  try {
    return await open()
  } catch (error) {
    const status = (error as { status?: number }).status
    const message = error instanceof Error ? error.message : String(error)
    const transient = status === 503 || status === 429 || /\b(503|429)\b/.test(message)
    if (!transient) throw error
    await new Promise((resolve) => setTimeout(resolve, 1200))
    return open()
  }
}

async function* streamGroq(call: ModelCall): AsyncGenerator<StreamPart> {
  const groq = getGroq()
  const stream = await groq.chat.completions.create(
    {
      model: call.target.model,
      messages: [
        { role: "system", content: joinSystem(call.system) },
        { role: "user", content: call.userPrompt },
      ],
      stream: true,
      stream_options: { include_usage: true },
      max_completion_tokens: call.maxOutputTokens,
      reasoning_effort: "low",
    },
    { signal: call.signal }
  )

  let usage: TokenUsage | null = null
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content
    if (text) yield { type: "delta", text }
    if (chunk.usage) {
      usage = { inputTokens: chunk.usage.prompt_tokens, outputTokens: chunk.usage.completion_tokens }
    }
  }
  if (usage) yield { type: "usage", usage }
}
