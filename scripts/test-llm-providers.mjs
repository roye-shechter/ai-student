/**
 * Live provider checks — makes a handful of tiny real calls (a few cents at
 * most) to every model the router uses, and verifies each one streams Hebrew,
 * reports token usage, and that the verifier returns parseable verdicts.
 * Writes nothing to the database.
 *
 * Run with: npx tsx scripts/test-llm-providers.mjs
 */
import "dotenv/config"
import assert from "node:assert/strict"
import { streamModel } from "../lib/llm/stream.ts"
import { ROUTE_TARGETS } from "../lib/llm/route.ts"
import { buildTutorSystem } from "../lib/llm/tutor-prompt.ts"
import { computeCostUsd } from "../lib/llm/pricing.ts"
import { verifyAnswer } from "../lib/llm/verify.ts"
import { GEMINI_VERIFIER_MODEL } from "../lib/rag/clients.ts"

const HEBREW = /[֐-׿]/
// A valid 1x1 PNG — enough to prove the image path reaches the model.
const TINY_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

let failures = 0
async function live(name, target, options = {}) {
  process.stdout.write(`  ${name} (${target.provider}/${target.model}) ... `)
  const started = Date.now()
  let text = ""
  let usage = null
  try {
    for await (const part of streamModel({
      target,
      system: buildTutorSystem("בודק"),
      userPrompt: options.prompt,
      image: options.image,
      maxOutputTokens: 400,
    })) {
      if (part.type === "delta") text += part.text
      else usage = part.usage
    }
    assert.ok(text.trim().length > 0, "empty answer")
    assert.ok(HEBREW.test(text), `answer is not Hebrew: ${text.slice(0, 80)}`)
    assert.ok(usage && usage.inputTokens > 0 && usage.outputTokens > 0, "usage not reported")
    const cost = computeCostUsd(target.model, usage)
    console.log(`ok (${Date.now() - started} ms, in=${usage.inputTokens} out=${usage.outputTokens}, $${cost?.toFixed(6) ?? "?"})`)
  } catch (error) {
    failures++
    console.log("FAIL")
    console.error(`      ${error instanceof Error ? error.message : error}`)
  }
}

async function verifier(name, answer, expectOk) {
  process.stdout.write(`  verifier: ${name} ... `)
  try {
    const { verdict } = await verifyAnswer({
      target: { provider: "gemini", model: GEMINI_VERIFIER_MODEL },
      question: "כמה זה 2 + 2?",
      answer,
      context: "",
    })
    assert.ok(verdict !== null, "verdict could not be parsed")
    assert.equal(verdict.ok, expectOk, `expected ok=${expectOk}, got ${JSON.stringify(verdict)}`)
    console.log(`ok (${JSON.stringify(verdict)})`)
  } catch (error) {
    failures++
    console.log("FAIL")
    console.error(`      ${error instanceof Error ? error.message : error}`)
  }
}

const hebrewPrompt = "הסבר בשתי שורות בעברית מה זה מתח חשמלי."

console.log("streaming, one call per route")
await live("standard", ROUTE_TARGETS.standard, { prompt: hebrewPrompt })
await live("quick", ROUTE_TARGETS.quick, { prompt: hebrewPrompt })
await live("visual (with image)", ROUTE_TARGETS.visual, {
  prompt: "מה הצבע העיקרי בתמונה? ענה במילה אחת בעברית.",
  image: { mimeType: "image/png", base64: TINY_PNG },
})
await live("hard (verified math, Opus)", ROUTE_TARGETS.hard, { prompt: "כמה זה 12 כפול 7? ענה בעברית." })

console.log("verifier")
await verifier("correct answer is accepted", "2 + 2 = 4, לכן התשובה היא 4.", true)
await verifier("wrong answer is flagged", "2 + 2 = 5, לכן התשובה היא 5.", false)

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log("\nall live checks passed")
