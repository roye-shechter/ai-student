/**
 * Live tutor-behavior eval — not unit tests of pure logic (see
 * test-llm-router.mjs for that), but a handful of real conversations run
 * through the actual chatStream pipeline that check the tutor prompt
 * (lib/llm/tutor-prompt.ts) actually behaves the way it's documented to.
 *
 * This consolidates verification that was previously done by hand, live,
 * in chat, every time the prompt changed — exactly the manual process this
 * script replaces. Makes real paid API calls (Opus/Sonnet/Gemini); keep
 * scenarios few and each one worth its cost. Uses one disposable test
 * tenant per run, cleaned up in a finally block even on failure.
 *
 * Run with: npx tsx scripts/test-tutor-prompt.mjs
 */
import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { prisma } from "../lib/prisma.ts"
import { ingestDocument } from "../lib/rag/ingest.ts"
import { chatStream } from "../lib/rag/chat.ts"

let passed = 0
let failed = 0
async function test(name, fn) {
  try {
    await fn()
    passed++
    console.log(`  ok   ${name}`)
  } catch (error) {
    failed++
    console.log(`  FAIL ${name}`)
    console.error(`       ${error instanceof Error ? error.message : error}`)
  }
}

const suffix = randomUUID().slice(0, 8)
const user = await prisma.user.create({ data: { email: `prompt-eval-${suffix}@example.com`, username: `prompt-eval-${suffix}` } })
const course = await prisma.course.create({ data: { courseCode: `prompt-eval-${suffix}`, courseName: "prompt eval course" } })
const doc = await prisma.document.create({ data: { userId: user.id, courseId: course.id, title: "material.txt", fileType: "txt" } })
await ingestDocument({
  userId: user.id,
  courseId: course.id,
  documentId: doc.id,
  fileName: "material.txt",
  uploadTimestamp: Date.now(),
  text: "מעגל RC מורכב מנגד R וקבל C. קבוע הזמן טאו שווה למכפלה של R ו-C. מחסנית (Stack) היא LIFO, תור (Queue) הוא FIFO.",
})

async function newSession() {
  return prisma.chatSession.create({ data: { userId: user.id, courseId: course.id } })
}

async function ask(sessionId, message) {
  let route = null, model = null, text = ""
  for await (const ev of chatStream({ userId: user.id, userName: "בודק", courseId: course.id, sessionId, message })) {
    if (ev.type === "sources") { route = ev.route; model = ev.model }
    if (ev.type === "delta") text += ev.text
  }
  return { route, model, text }
}

try {
  await test("a genuinely multi-step problem routes to hard (Opus) and solves correctly", async () => {
    const s = await newSession()
    const r = await ask(s.id, "פתור את מערכת המשוואות: 2x + y = 7, x - y = 2. מצא את x ו-y.")
    assert.equal(r.route, "hard")
    assert.match(r.model, /opus/)
    assert.match(r.text, /x\s*=\s*3/)
    assert.match(r.text, /y\s*=\s*1/)
  })

  await test("bare arithmetic routes to hard-light (Sonnet, not Opus) and is still correct", async () => {
    const s = await newSession()
    const r = await ask(s.id, "17% מ-250 זה כמה? ענה במספר בלבד.")
    assert.equal(r.route, "hard-light")
    assert.doesNotMatch(r.model, /opus/)
    assert.match(r.text, /42[.,]?5/)
  })

  await test("an explicit confusion signal produces a shorter, simpler re-explanation", async () => {
    const s = await newSession()
    const first = await ask(s.id, "מה ההבדל בין מחסנית לתור?")
    const confused = await ask(s.id, "לא הבנתי, זה מבלבל אותי.")
    assert.ok(confused.text.length < first.text.length, `expected shorter reply (first=${first.text.length}, confused=${confused.text.length})`)
  })

  await test("the weak-topic marker is stripped from persisted history, and is recorded as a signal", async () => {
    // The raw marker IS present in the live-streamed deltas by design (the
    // client hides it the same way it hides $$/```mermaid``` board blocks —
    // see stripBoardBlocks in components/tutor-board.tsx) — only what gets
    // PERSISTED and fed back as future prompt history should be clean.
    const s = await newSession()
    await ask(s.id, "תסביר לי מה זה מעגל RC.")
    await ask(s.id, "זה לא ברור לי בכלל.")
    const persisted = await prisma.chatMessage.findFirst({
      where: { sessionId: s.id, role: "assistant" },
      orderBy: { createdAt: "desc" },
    })
    assert.doesNotMatch(persisted?.content ?? "", /weak-topic/, "raw marker should be stripped before persisting")
    const signal = await prisma.chatWeakSignal.findFirst({ where: { userId: user.id, courseId: course.id }, orderBy: { createdAt: "desc" } })
    assert.ok(signal, "expected a ChatWeakSignal row to be recorded")
    const review = await prisma.topicReview.findFirst({ where: { userId: user.id, courseId: course.id }, orderBy: { createdAt: "desc" } })
    assert.ok(review, "expected a TopicReview row to be recorded")
    assert.equal(review.lastResult, "weak")
  })

  await test("a substantive explanation uses the structured multi-part format (not a one-liner)", async () => {
    const s = await newSession()
    const r = await ask(s.id, "תסביר לי מה זה מעגל RC ומה קורה כשטוענים את הקבל.")
    const headingCount = (r.text.match(/^##\s/gm) ?? []).length
    assert.ok(headingCount >= 2, `expected at least 2 markdown headings for a substantive explanation, got ${headingCount}`)
  })
} finally {
  console.log("\ncleaning up...")
  await prisma.document.delete({ where: { id: doc.id } }).catch(() => {})
  await prisma.chatSession.deleteMany({ where: { userId: user.id } }).catch(() => {})
  await prisma.course.delete({ where: { id: course.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  await prisma.$disconnect()
}

console.log(failed > 0 ? `\nFAILED — ${passed} passed, ${failed} failed.` : `\nAll ${passed} checks passed.`)
if (failed > 0) process.exitCode = 1
