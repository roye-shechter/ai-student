import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { chat } from "@/lib/rag/chat"
import { assertEmbeddingEnv, assertLlmEnv } from "@/lib/rag/clients"

/**
 * Chat endpoint — drives the enterprise RAG pipeline (lib/rag/chat.ts):
 * embed the question (OpenAI) → retrieve from Pinecone (scoped to the
 * authenticated user + course) → answer with Anthropic Claude → persist the
 * turn in Postgres.
 *
 * The browser only sends the message and which course it is asking about.
 * `userId` is taken from the authenticated session (never trusted from the
 * client), and a ChatSession is resolved/created server-side so the pipeline
 * has the `sessionId` it needs for conversational memory.
 */

type ChatRequestBody = {
  message?: unknown
  courseCode?: unknown
  courseId?: unknown
  sessionId?: unknown
}

export async function POST(req: Request) {
  // Everything runs inside one comprehensive try/catch so that ANY failure
  // (missing env keys, DB errors, OpenAI/Pinecone/Anthropic timeouts, etc.) is
  // logged and returned as JSON — never Next's default HTML error page, which
  // would break the client's response.json().
  try {
    // 1. Authenticate — the user id is the hard tenancy key for retrieval.
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // The tutor persona greets the student by name. Prefer the full name, fall
    // back to the username, then to a neutral Hebrew default.
    const userName = session?.user?.fullName || session?.user?.username || "סטודנט"

    // 2. Validate required keys up front (throws a precise, catchable error).
    assertEmbeddingEnv()
    assertLlmEnv()

    // 3. Parse and validate the request.
    let body: ChatRequestBody
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const message = typeof body.message === "string" ? body.message.trim() : ""
    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 })
    }

    // 4. Resolve the course. The UI identifies a course by its human courseCode
    //    (e.g. "matap1"); a raw courseId is also accepted.
    const courseId = typeof body.courseId === "string" ? body.courseId : undefined
    const courseCode = typeof body.courseCode === "string" ? body.courseCode : undefined

    const course = courseId
      ? await prisma.course.findUnique({ where: { id: courseId } })
      : courseCode
        ? await prisma.course.findUnique({ where: { courseCode } })
        : null

    if (!course) {
      return NextResponse.json(
        { error: "Unknown course (provide a valid courseCode or courseId)" },
        { status: 400 }
      )
    }

    // 5. Resolve the conversation thread. Reuse the supplied session if it
    //    belongs to this user+course, otherwise reuse the latest thread or
    //    open a new one.
    const requestedSessionId =
      typeof body.sessionId === "string" ? body.sessionId : undefined

    let chatSession = requestedSessionId
      ? await prisma.chatSession.findFirst({
          where: { id: requestedSessionId, userId, courseId: course.id },
        })
      : await prisma.chatSession.findFirst({
          where: { userId, courseId: course.id },
          orderBy: { updatedAt: "desc" },
        })

    if (!chatSession) {
      chatSession = await prisma.chatSession.create({
        data: { userId, courseId: course.id },
      })
    }

    // 6. Run the full RAG turn.
    const reply = await chat({
      userId,
      userName,
      courseId: course.id,
      sessionId: chatSession.id,
      message,
    })

    return NextResponse.json({
      text: reply.answer,
      answer: reply.answer,
      chunks: reply.chunks,
      sessionId: chatSession.id,
    })
  } catch (error) {
    console.error("[CRITICAL_ERROR] Route /api/chat failed:", error)
    const message =
      error instanceof Error ? error.message : "Unexpected server error during chat"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
