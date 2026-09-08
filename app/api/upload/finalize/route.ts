import { NextResponse, after } from "next/server"
import { getServerSession } from "next-auth"
import { del, get } from "@vercel/blob"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ingestDocument } from "@/lib/rag/ingest"
import { assertEmbeddingEnv } from "@/lib/rag/clients"
import { transcribeAudio } from "@/lib/rag/transcribe"
import { assertUnderDailyLimit, RateLimitExceededError } from "@/lib/rate-limit"
import { isPdf, isTxt, isAudio, extractPdfText } from "@/lib/rag/extract-text"

/**
 * Document ingestion — finalize step.
 *
 * The browser has already PUT the raw file straight to Vercel Blob (see
 * app/api/upload/token/route.ts); this route only ever receives a small JSON
 * body naming that blob. It downloads the file server-side, extracts text
 * (transcribing audio via lib/rag/transcribe.ts when applicable), records a
 * Document row, and responds immediately with status "pending" — the actual
 * chunk/embed/upsert work (lib/rag/ingest.ts) runs afterwards via after(),
 * so a large document's processing time is never blocking the client's
 * request nor gated by a short synchronous timeout. The blob is deleted once
 * ingestion settles (success or failure) since the raw file has no further
 * purpose once its text has been extracted.
 */

export const runtime = "nodejs"
// Vercel Hobby's ceiling (Pro allows up to 300s — bump this if/when the
// project is confirmed to be on Pro) — headroom for the background
// embed/upsert work that now runs via after() below.
export const maxDuration = 60

const MAX_BYTES = 15 * 1024 * 1024 // 15 MB (PDF/TXT)
// OpenAI's transcription endpoint hard-caps uploads at 25MB; stay under it.
const MAX_AUDIO_BYTES = 24 * 1024 * 1024 // 24 MB

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
      await assertUnderDailyLimit(userId, "upload")
    } catch (error) {
      if (error instanceof RateLimitExceededError) {
        return NextResponse.json(
          { error: "הגעת למכסת ההעלאות היומית שלך. נסה שוב מחר." },
          { status: 429 }
        )
      }
      throw error
    }

    assertEmbeddingEnv()

    const payload = (await req.json().catch(() => null)) as
      | { blobUrl?: string; fileName?: string; courseCode?: string; courseId?: string }
      | null
    const blobUrl = payload?.blobUrl
    const fileName = payload?.fileName
    if (!blobUrl || !fileName) {
      return NextResponse.json({ error: "Missing blobUrl or fileName" }, { status: 400 })
    }

    const course = payload?.courseId
      ? await prisma.course.findUnique({ where: { id: payload.courseId } })
      : payload?.courseCode
        ? await prisma.course.findUnique({ where: { courseCode: payload.courseCode } })
        : null

    if (!course) {
      return NextResponse.json(
        { error: "Unknown course (provide a valid courseCode or courseId)" },
        { status: 400 }
      )
    }

    // Download the file from Blob storage — this is the real size/type
    // boundary now (the client's own checks are only a UX guardrail). The
    // blob is private, so this goes through the SDK (authenticates with
    // BLOB_READ_WRITE_TOKEN) rather than a plain fetch(blobUrl).
    let blobResult: Awaited<ReturnType<typeof get>>
    try {
      blobResult = await get(blobUrl, { access: "private" })
      if (!blobResult) throw new Error("Blob not found")
    } catch {
      return NextResponse.json({ error: "Failed to read the uploaded file" }, { status: 502 })
    }

    const contentType = blobResult.blob.contentType ?? ""
    const audio = isAudio(fileName, contentType)
    const pdf = isPdf(fileName, contentType)
    const txt = isTxt(fileName, contentType)
    if (!pdf && !txt && !audio) {
      await del(blobUrl).catch(() => {})
      return NextResponse.json(
        { error: "Unsupported file type (PDF, TXT, or an audio lecture recording)" },
        { status: 415 }
      )
    }

    const bytes = new Uint8Array(await new Response(blobResult.stream).arrayBuffer())
    if (bytes.byteLength === 0) {
      await del(blobUrl).catch(() => {})
      return NextResponse.json({ error: "File is empty" }, { status: 400 })
    }
    if (audio && bytes.byteLength > MAX_AUDIO_BYTES) {
      await del(blobUrl).catch(() => {})
      return NextResponse.json({ error: "Audio file too large (max 24MB)" }, { status: 413 })
    }
    if (!audio && bytes.byteLength > MAX_BYTES) {
      await del(blobUrl).catch(() => {})
      return NextResponse.json({ error: "File too large (max 15MB)" }, { status: 413 })
    }

    let text: string
    try {
      if (audio) {
        text = await transcribeAudio(new File([bytes], fileName, { type: contentType }))
      } else {
        text = pdf ? await extractPdfText(bytes) : new TextDecoder("utf-8").decode(bytes)
      }
    } catch (error) {
      console.error(audio ? "Audio transcription failed:" : "Text extraction failed:", error)
      await del(blobUrl).catch(() => {})
      return NextResponse.json(
        { error: audio ? "תמלול ההקלטה נכשל" : "Failed to read the document" },
        { status: 422 }
      )
    }

    if (!text.trim()) {
      await del(blobUrl).catch(() => {})
      return NextResponse.json(
        {
          error: audio
            ? "לא זוהה דיבור בהקלטה"
            : "No extractable text found (scanned/image-only PDFs are not supported)",
        },
        { status: 422 }
      )
    }

    const fileType = audio ? "audio" : pdf ? "pdf" : "txt"
    const document = await prisma.document.create({
      data: {
        userId,
        courseId: course.id,
        title: fileName,
        fileType,
        fileSizeBytes: BigInt(bytes.byteLength),
      },
    })

    // Respond immediately — the client polls /api/documents for status.
    // Chunk/embed/upsert happens after the response is sent, still within
    // this invocation (up to maxDuration), so it's never blocked by the
    // client's connection nor competing with the body-size boundary above.
    after(async () => {
      try {
        await ingestDocument({
          userId,
          courseId: course.id,
          documentId: document.id,
          fileName,
          uploadTimestamp: document.createdAt.getTime(),
          text,
        })
      } catch (error) {
        // ingestDocument already marks the Document "failed" internally.
        console.error("[CRITICAL_ERROR] Background ingestion failed:", error)
      } finally {
        await del(blobUrl).catch(() => {})
      }
    })

    return NextResponse.json({
      documentId: document.id,
      title: fileName,
      status: document.status,
    })
  } catch (error) {
    console.error("[CRITICAL_ERROR] Route /api/upload/finalize failed:", error)
    const message =
      error instanceof Error ? error.message : "Unexpected server error during upload"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
