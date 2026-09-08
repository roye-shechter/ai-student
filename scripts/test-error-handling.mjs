/**
 * Lightweight test script for the error-handling hardening.
 *
 * Verifies:
 *  1. requireEnv / assertEmbeddingEnv / assertLlmEnv throw a clear, catchable
 *     error naming exactly which key is missing.
 *  2. readJson() safely returns null for non-JSON (HTML error pages) and
 *     malformed bodies instead of throwing — so the UI never crashes on a
 *     server 500 that returns "<!DOCTYPE ...".
 *
 * Run with: npx tsx scripts/test-error-handling.mjs
 */
import assert from "node:assert/strict"
import { requireEnv, assertEmbeddingEnv, assertLlmEnv } from "../lib/rag/clients.ts"
import { readJson } from "../lib/http.ts"

let passed = 0
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++
      console.log(`  ✓ ${name}`)
    })
    .catch((err) => {
      console.error(`  ✗ ${name}\n    ${err.message}`)
      process.exitCode = 1
    })
}

// DATABASE_URL isn't checked here — Prisma requires it just to import
// lib/prisma.ts (which lib/rag/clients.ts doesn't touch), so it's already a
// hard prerequisite for the app to run at all, not something
// assertEmbeddingEnv/assertLlmEnv need to re-verify.
const ENV_KEYS = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"]
const clearKeys = () => ENV_KEYS.forEach((k) => delete process.env[k])
const setAll = () => ENV_KEYS.forEach((k) => (process.env[k] = "test-value"))

console.log("env validation:")
await test("requireEnv throws naming the missing key", () => {
  clearKeys()
  assert.throws(() => requireEnv("OPENAI_API_KEY"), /Missing required environment variable: OPENAI_API_KEY/)
})
await test("requireEnv treats empty/whitespace as missing", () => {
  process.env.OPENAI_API_KEY = "   "
  assert.throws(() => requireEnv("OPENAI_API_KEY"), /OPENAI_API_KEY/)
})
await test("requireEnv returns the value when present", () => {
  process.env.OPENAI_API_KEY = "sk-abc"
  assert.equal(requireEnv("OPENAI_API_KEY"), "sk-abc")
})
await test("assertEmbeddingEnv flags OPENAI_API_KEY when missing (no vector-DB key needed anymore — pgvector lives in Postgres)", () => {
  setAll()
  delete process.env.OPENAI_API_KEY
  assert.throws(() => assertEmbeddingEnv(), /OPENAI_API_KEY/)
})
await test("assertLlmEnv flags ANTHROPIC_API_KEY when missing", () => {
  setAll()
  delete process.env.ANTHROPIC_API_KEY
  assert.throws(() => assertLlmEnv(), /ANTHROPIC_API_KEY/)
})
await test("asserts pass when every key is present", () => {
  setAll()
  assert.doesNotThrow(() => {
    assertEmbeddingEnv()
    assertLlmEnv()
  })
})

console.log("safe json parsing (readJson):")
await test("returns null for an HTML error page", async () => {
  const res = new Response("<!DOCTYPE html><html><body>500</body></html>", {
    status: 500,
    headers: { "content-type": "text/html" },
  })
  assert.equal(await readJson(res), null)
})
await test("parses a JSON error body", async () => {
  const res = new Response(JSON.stringify({ error: "Missing required environment variable: OPENAI_API_KEY" }), {
    status: 500,
    headers: { "content-type": "application/json" },
  })
  assert.deepEqual(await readJson(res), { error: "Missing required environment variable: OPENAI_API_KEY" })
})
await test("returns null for a malformed JSON body", async () => {
  const res = new Response("not really json", {
    status: 200,
    headers: { "content-type": "application/json" },
  })
  assert.equal(await readJson(res), null)
})

console.log(
  process.exitCode === 1
    ? `\nFAILED — ${passed} passed, see errors above.`
    : `\nAll ${passed} checks passed.`
)
