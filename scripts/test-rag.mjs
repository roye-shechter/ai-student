/**
 * RAG pipeline tests — chunking/formatting (pure, free, fast) plus a real
 * ingest -> retrieve integration check (needs DATABASE_URL + OPENAI_API_KEY;
 * makes a handful of real, cheap text-embedding-3-small calls and writes/
 * cleans up its own temporary rows — never touches real user data).
 *
 * Run with: npx tsx scripts/test-rag.mjs
 */
import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { chunkText, ingestDocument } from "../lib/rag/ingest.ts"
import { retrieveContext } from "../lib/rag/chat.ts"
import { toVectorSql } from "../lib/rag/clients.ts"
import { prisma } from "../lib/prisma.ts"

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

console.log("chunkText():")

await test("empty/whitespace-only text produces no chunks", () => {
  assert.deepEqual(chunkText(""), [])
  assert.deepEqual(chunkText("   \n\n  "), [])
})

await test("text shorter than chunkSize stays one chunk", () => {
  const chunks = chunkText("A short sentence.", { chunkSize: 1000 })
  assert.equal(chunks.length, 1)
  assert.equal(chunks[0], "A short sentence.")
})

await test("no content is silently dropped (head and tail survive)", () => {
  const text = "START-MARKER " + "filler word ".repeat(400) + "END-MARKER"
  const chunks = chunkText(text, { chunkSize: 500, chunkOverlap: 50 })
  assert.ok(chunks.length > 1, "expected multiple chunks for long input")
  assert.ok(chunks[0].includes("START-MARKER"), "first chunk should contain the start of the text")
  assert.ok(chunks[chunks.length - 1].includes("END-MARKER"), "last chunk should contain the end of the text")
})

await test("smaller chunkSize produces more, smaller chunks", () => {
  const text = "Paragraph one.\n\nParagraph two.\n\n" + "Sentence. ".repeat(200)
  const big = chunkText(text, { chunkSize: 2000, chunkOverlap: 100 })
  const small = chunkText(text, { chunkSize: 200, chunkOverlap: 20 })
  assert.ok(small.length > big.length, "smaller chunkSize should yield more chunks")
  for (const c of small) assert.ok(c.length <= 260, `chunk exceeded expected bound: ${c.length} chars`)
})

console.log("\ntoVectorSql():")

await test("formats a numeric array as a Postgres vector literal", () => {
  const sql = toVectorSql([0.1, -0.2, 3])
  assert.equal(sql, "[0.1,-0.2,3]")
})

console.log("\ningestDocument() -> retrieveContext() integration (real DB + embeddings):")

const suffix = randomUUID().slice(0, 8)
const tenants = []

async function makeTenant(label) {
  const user = await prisma.user.create({
    data: { email: `rag-test-${label}-${suffix}@example.com`, username: `rag-test-${label}-${suffix}` },
  })
  const course = await prisma.course.create({
    data: { courseCode: `rag-test-${label}-${suffix}`, courseName: `RAG test course ${label}` },
  })
  tenants.push({ user, course })
  return { user, course }
}

try {
  const a = await makeTenant("a")
  const b = await makeTenant("b")

  const docA = await prisma.document.create({
    data: { userId: a.user.id, courseId: a.course.id, title: "a.txt", fileType: "txt" },
  })
  const docB = await prisma.document.create({
    data: { userId: b.user.id, courseId: b.course.id, title: "b.txt", fileType: "txt" },
  })

  // Deliberately near-identical content so the two tenants' chunks are close
  // neighbors in vector space — if tenant isolation were ever broken, this
  // is exactly the scenario that would leak B's chunk into A's results.
  await ingestDocument({
    userId: a.user.id,
    courseId: a.course.id,
    documentId: docA.id,
    fileName: "a.txt",
    uploadTimestamp: Date.now(),
    text: "The secret code for tenant Alpha is ALPHA-MARKER-19284.",
  })
  await ingestDocument({
    userId: b.user.id,
    courseId: b.course.id,
    documentId: docB.id,
    fileName: "b.txt",
    uploadTimestamp: Date.now(),
    text: "The secret code for tenant Beta is BETA-MARKER-77531.",
  })

  await test("ingestDocument() writes retrievable chunks for the ingesting tenant", async () => {
    const results = await retrieveContext({ userId: a.user.id, courseId: a.course.id, query: "secret code", topK: 5 })
    assert.ok(results.length > 0, "expected at least one chunk back")
    assert.ok(results.some((r) => r.text.includes("ALPHA-MARKER-19284")), "expected tenant A's own chunk")
  })

  await test("retrieveContext() never returns another tenant's chunks, even near-identical ones", async () => {
    const results = await retrieveContext({ userId: a.user.id, courseId: a.course.id, query: "secret code", topK: 5 })
    assert.ok(!results.some((r) => r.text.includes("BETA-MARKER")), "tenant B's chunk leaked into tenant A's results")

    const resultsB = await retrieveContext({ userId: b.user.id, courseId: b.course.id, query: "secret code", topK: 5 })
    assert.ok(!resultsB.some((r) => r.text.includes("ALPHA-MARKER")), "tenant A's chunk leaked into tenant B's results")
  })

  await test("deleting a Document cascades to its DocumentChunk rows", async () => {
    await prisma.document.delete({ where: { id: docA.id } })
    const remaining = await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM document_chunks WHERE "documentId" = ${docA.id}`
    assert.equal(remaining[0].count, 0)
  })
} finally {
  // Always clean up, even on assertion failure — never leaves rows behind.
  for (const { user, course } of tenants) {
    await prisma.document.deleteMany({ where: { userId: user.id } }).catch(() => {})
    await prisma.course.delete({ where: { id: course.id } }).catch(() => {})
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  }
  await prisma.$disconnect()
}

console.log(
  process.exitCode === 1
    ? `\nFAILED — ${passed} passed, see errors above.`
    : `\nAll ${passed} checks passed.`
)
