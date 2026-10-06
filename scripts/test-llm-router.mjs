/**
 * Routing + pricing unit tests — pure logic, no network, no database.
 *
 * Run with: npx tsx scripts/test-llm-router.mjs
 */
import "dotenv/config"
import assert from "node:assert/strict"
import { chooseRoute, ROUTE_TARGETS, classifyComplexity } from "../lib/llm/route.ts"
import { computeCostUsd, fromAnthropicUsage } from "../lib/llm/pricing.ts"

let passed = 0
function test(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ok   ${name}`)
  } catch (error) {
    console.error(`  FAIL ${name}`)
    throw error
  }
}

console.log("routing")

test("an attached image always routes to the visual model", () => {
  assert.equal(chooseRoute("מה מתואר בתרשים?", { hasImage: true }), "visual")
  assert.equal(chooseRoute("חשב את ההתנגדות שקולה", { hasImage: true }), "visual")
})

test("hard math/EE questions route to the hard path", () => {
  assert.equal(chooseRoute("פתור את המשוואה 2x + 3 = 11", { hasImage: false }), "hard")
  assert.equal(chooseRoute("מהי הנגזרת של x^2 sin(x)?", { hasImage: false }), "hard")
  assert.equal(chooseRoute("חשב את הזרם כאשר R=10 ו-V=230", { hasImage: false }), "hard")
})

test("a short definitional question routes to the quick path", () => {
  assert.equal(chooseRoute("מה זה מתח חשמלי?", { hasImage: false }), "quick")
  assert.equal(chooseRoute("define impedance", { hasImage: false }), "quick")
})

test("a long definitional question stays on the standard path", () => {
  const long = "מה זה מתח חשמלי? " + "אני רוצה הסבר מעמיק על הקשר בינו לבין זרם ועל כל ההשלכות המעשיות שלו בתכנון מעגלים ".repeat(3)
  assert.equal(chooseRoute(long, { hasImage: false }), "standard")
})

test("a short question that asks for an explanation or comparison stays on the standard path", () => {
  assert.equal(chooseRoute("הסבר לי בקצרה ובעברית מה ההבדל בין מעגל RC למעגל RL.", { hasImage: false }), "standard")
  assert.equal(chooseRoute("מה ההבדל בין AC ל-DC?", { hasImage: false }), "standard")
  assert.equal(chooseRoute("למה מתח RMS שונה מערך השיא?", { hasImage: false }), "standard")
})

test("ordinary conversational questions use the standard tutor", () => {
  assert.equal(chooseRoute("תסביר לי על מה השיעור השלישי עסק", { hasImage: false }), "standard")
})

test("classifyComplexity keeps the original simple/hard split", () => {
  assert.equal(classifyComplexity("שלום, איך אתה?"), "simple")
  assert.equal(classifyComplexity("∫ x dx"), "hard")
})

test("every route has a configured target", () => {
  for (const route of ["visual", "hard", "quick", "standard"]) {
    assert.ok(ROUTE_TARGETS[route].model, `missing model for ${route}`)
  }
  assert.equal(ROUTE_TARGETS.visual.provider, "gemini")
  assert.equal(ROUTE_TARGETS.quick.provider, "groq")
  assert.equal(ROUTE_TARGETS.hard.provider, "anthropic")
  assert.equal(ROUTE_TARGETS.standard.provider, "anthropic")
})

console.log("pricing")

test("one million input tokens on Sonnet cost the listed input rate", () => {
  assert.equal(computeCostUsd("claude-sonnet-4-6", { inputTokens: 1_000_000, outputTokens: 0 }), 3)
})

test("output tokens are billed at the output rate", () => {
  assert.equal(computeCostUsd("claude-opus-4-6", { inputTokens: 0, outputTokens: 1_000_000 }), 25)
})

test("cache reads bill at the discounted cache rate", () => {
  const cost = computeCostUsd("claude-sonnet-4-6", { inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000 })
  assert.equal(cost, 0.3)
})

test("an unknown model has no price rather than a wrong price", () => {
  assert.equal(computeCostUsd("some-unknown-model", { inputTokens: 1000, outputTokens: 1000 }), null)
})

test("Anthropic usage maps onto the internal usage shape", () => {
  assert.deepEqual(
    fromAnthropicUsage({ input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 5, cache_creation_input_tokens: null }),
    { inputTokens: 10, outputTokens: 20, cacheReadTokens: 5, cacheWriteTokens: 0 }
  )
})

console.log(`\n${passed} tests passed`)
