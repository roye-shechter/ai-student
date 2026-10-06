import {
  CHAT_MODEL,
  GEMINI_VISUAL_FALLBACK_MODEL,
  GEMINI_VISUAL_MODEL,
  GROQ_QUICK_MODEL,
  HARD_CHAT_MODEL,
} from "@/lib/rag/clients"

/**
 * Picks which model answers a tutoring turn. Pure string/flag logic on
 * purpose: a router LLM call would add latency and cost to every message,
 * and the cheap heuristics below already separate the cases that matter.
 *
 *   visual   — the student attached an image (diagram, graph, handwritten
 *              problem). Gemini has the strongest multimodal reading here.
 *   hard     — math/EE computation. Opus with extended thinking + verified
 *              code execution, unchanged from before.
 *   quick    — a short definitional question where latency matters more than
 *              long-form depth. A fast open-weight model on Groq.
 *   standard — everything else: the conversational tutor, Claude Sonnet.
 */
export type Route = "visual" | "hard" | "quick" | "standard"

export type ModelTarget = { provider: "anthropic" | "gemini" | "groq"; model: string }

export const ROUTE_TARGETS: Record<Route, ModelTarget> = {
  visual: { provider: "gemini", model: GEMINI_VISUAL_MODEL },
  hard: { provider: "anthropic", model: HARD_CHAT_MODEL },
  quick: { provider: "groq", model: GROQ_QUICK_MODEL },
  standard: { provider: "anthropic", model: CHAT_MODEL },
}

/** Tried in order after the primary model fails, before the standard Claude path. */
export const ROUTE_FALLBACKS: Record<Route, ModelTarget[]> = {
  visual: [{ provider: "gemini", model: GEMINI_VISUAL_FALLBACK_MODEL }],
  hard: [],
  quick: [],
  standard: [],
}

/**
 * Quick answers are short by design, so they get a smaller context. This also
 * keeps the request under Groq's free-tier tokens-per-minute cap for typical turns.
 */
export const ROUTE_LIMITS: Partial<Record<Route, { topK: number; historyLimit: number; maxOutputTokens: number }>> = {
  quick: { topK: 3, historyLimit: 4, maxOutputTokens: 1536 },
}

/** Models that stream without a long silent reasoning phase, so a missing first token means a hung provider. */
export const FIRST_TOKEN_TIMEOUT_MS: Partial<Record<Route, number>> = {
  quick: 8000,
  visual: 12000,
}

const HARD_MATH_SYMBOLS = /[∫∑∂√≈±×÷]|\\frac|\\int|\\sum|\\sqrt|\bd\/dx\b/i
const HARD_TASK_VERBS =
  /(חשב|פתור|הוכח|גזור|נגזרת|אינטגרל|מטריצ|משוואה|אופטימיזצי|מעגל חשמלי|נוסחה)/
const OPERATOR_CHARS = /[+\-*/=^]/g
const DIGIT_CHARS = /[0-9]/g

export function classifyComplexity(message: string): "simple" | "hard" {
  if (HARD_MATH_SYMBOLS.test(message) || HARD_TASK_VERBS.test(message)) {
    return "hard"
  }
  const digitCount = (message.match(DIGIT_CHARS) ?? []).length
  const operatorCount = (message.match(OPERATOR_CHARS) ?? []).length
  const density = message.length > 0 ? (digitCount + operatorCount) / message.length : 0
  if (digitCount >= 3 && density > 0.15) {
    return "hard"
  }
  return "simple"
}

const QUICK_MAX_CHARS = 140
const QUICK_DEFINITION = /(מה זה|מהו|מהי|הגדר|מה פירוש|what is|define)/i
// Anything asking for explanation, reasoning or comparison needs the depth of
// the standard tutor, even when the question is short.
const NEEDS_DEPTH = /(הסבר|תסביר|למה|איך|הבדל|השווה|דוגמה|compare|why|how)/i

export function chooseRoute(message: string, options: { hasImage: boolean }): Route {
  if (options.hasImage) return "visual"
  if (classifyComplexity(message) === "hard") return "hard"
  if (message.length <= QUICK_MAX_CHARS && QUICK_DEFINITION.test(message) && !NEEDS_DEPTH.test(message)) {
    return "quick"
  }
  return "standard"
}
