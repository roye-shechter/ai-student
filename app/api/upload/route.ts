import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { PDFParse } from "pdf-parse"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ingestDocument } from "@/lib/rag/ingest"

/**
 * Document ingestion endpoint.
 *
 * Accepts a multipart file upload (PDF or TXT), authenticates the user,
 * extracts the raw text, records a Document row in Postgres, then hands the
 * text to the RAG ingestion pipeline (lib/rag/ingest.ts) which chunks,
 * embeds (OpenAI), and upserts the vectors into Pinecone — tagged with the
 * authenticated userId + the resolved courseId for strict tenant isolation.
 */

// pdf-parse / pdfjs-dist require the Node.js runtime (not edge).
export const runtime = "nodejs"

const MAX_BYTES = 15 * 1024 * 1024 // 15 MB
const PDF_TYPES = ["application/pdf"]
const TXT_TYPES = ["text/plain"]

function isPdf(file: File): boolean {
  return PDF_TYPES.includes(file.type) || file.name.toLowerCase().endsWith(".pdf")
}

function isTxt(file: File): boolean {
  return TXT_TYPES.includes(file.type) || file.name.toLowerCase().endsWith(".txt")
}

/** Extract plain text from a PDF buffer using pdf-parse (pdfjs under the hood). */
async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const parser = new PDFParse({ data: bytes })
  try {
    const result = await parser.getText()
    // Join clean per-page text; result.text adds "-- N of M --" dividers that
    // would otherwise be embedded as noise.
    return result.pages.length
      ? result.pages.map((page) => page.text).join("\n\n")
      : result.text
  } finally {
    await parser.destroy()
  }
}

export async function POST(req: Request) {
  // 1. Authenticate — userId is the hard tenancy key for the embeddings.
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Read the multipart form.
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 15MB)" }, { status: 413 })
  }
  if (!isPdf(file) && !isTxt(file)) {
    return NextResponse.json(
      { error: "Unsupported file type (PDF or TXT only)" },
      { status: 415 }
    )
  }

  // 3. Resolve the course this material belongs to.
  const courseId = typeof form.get("courseId") === "string" ? (form.get("courseId") as string) : undefined
  const courseCode = typeof form.get("courseCode") === "string" ? (form.get("courseCode") as string) : undefined

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

  // 4. Extract raw text.
  const bytes = new Uint8Array(await file.arrayBuffer())
  let text: string
  try {
    text = isPdf(file) ? await extractPdfText(bytes) : new TextDecoder("utf-8").decode(bytes)
  } catch (error) {
    console.error("Text extraction failed:", error)
    return NextResponse.json({ error: "Failed to read the document" }, { status: 422 })
  }

  if (!text.trim()) {
    return NextResponse.json(
      { error: "No extractable text found (scanned/image-only PDFs are not supported)" },
      { status: 422 }
    )
  }

  // 5. Record the document, then run the ingestion pipeline.
  const fileType = isPdf(file) ? "pdf" : "txt"
  const document = await prisma.document.create({
    data: {
      userId,
      courseId: course.id,
      title: file.name,
      fileType,
      fileSizeBytes: BigInt(file.size),
    },
  })

  try {
    const result = await ingestDocument({
      userId,
      courseId: course.id,
      documentId: document.id,
      text,
    })

    return NextResponse.json({
      documentId: result.documentId,
      title: file.name,
      chunkCount: result.chunkCount,
      namespace: result.namespace,
    })
  } catch (error) {
    // ingestDocument marks the row "failed" on its own; surface a clean error.
    console.error("Ingestion failed:", error)
    return NextResponse.json(
      { error: "שגיאה בעיבוד המסמך (Embedding/Pinecone)" },
      { status: 500 }
    )
  }
}
