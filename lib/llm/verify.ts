import type { TokenUsage } from "./pricing"
import { streamModel, type ImageInput } from "./stream"
import type { ModelTarget } from "./route"

export type Verdict = { ok: true } | { ok: false; issues: string }

const VERIFIER_INSTRUCTIONS = [
  "You are a strict reviewer of a university tutor's answer (electrical engineering / computer science).",
  "Flag ONLY clear, specific errors: a wrong fact, a wrong calculation, a wrong final result, or a claim that contradicts the provided course material or the image.",
  "Do not flag style, length, or missing extras.",
  "Respond with JSON only, no prose:",
  '{"ok": true}  — if the answer is correct as far as you can tell.',
  '{"ok": false, "issues": "<one or two sentences in Hebrew naming the specific error and the correct value>"}',
].join("\n")

/**
 * Second-model review of an answer. Runs only on the hard and visual routes.
 * Returns null when the reviewer's reply can't be parsed, so a malformed
 * review never shows the student a spurious warning.
 */
export async function verifyAnswer(args: {
  target: ModelTarget
  question: string
  answer: string
  context: string
  image?: ImageInput
  signal?: AbortSignal
}): Promise<{ verdict: Verdict | null; usage: TokenUsage | null }> {
  const userPrompt = [
    "Question asked by the student:",
    args.question,
    "",
    "Course material available to the tutor:",
    args.context || "(none)",
    "",
    "Tutor's answer to review:",
    args.answer,
  ].join("\n")

  let text = ""
  let usage: TokenUsage | null = null
  for await (const part of streamModel({
    target: args.target,
    system: { staticPolicy: VERIFIER_INSTRUCTIONS, dynamic: "" },
    userPrompt,
    image: args.image,
    maxOutputTokens: 600,
    signal: args.signal,
  })) {
    if (part.type === "delta") text += part.text
    else usage = part.usage
  }

  return { verdict: parseVerdict(text), usage }
}

function parseVerdict(text: string): Verdict | null {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start === -1 || end <= start) return null
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as { ok?: unknown; issues?: unknown }
    if (parsed.ok === true) return { ok: true }
    if (parsed.ok === false && typeof parsed.issues === "string" && parsed.issues.trim()) {
      return { ok: false, issues: parsed.issues.trim() }
    }
    return null
  } catch {
    return null
  }
}
