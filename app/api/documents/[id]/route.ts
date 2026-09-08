import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * Rename / delete a single document. Both require the caller to own the
 * document — checked explicitly (not just relying on the WHERE clause)
 * so a mismatch returns 404, never leaking whether some other user's
 * document id exists.
 */

async function loadOwnedDocument(id: string, userId: string) {
  const document = await prisma.document.findUnique({ where: { id } })
  if (!document || document.userId !== userId) return null
  return document
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await ctx.params
    const document = await loadOwnedDocument(id, userId)
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const body = (await req.json().catch(() => null)) as { title?: unknown } | null
    const title = typeof body?.title === "string" ? body.title.trim() : ""
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    // Keep every chunk's fileName in sync — it's what the AI cites in chat
    // (lib/rag/chat.ts buildPrompt()), so a stale name here would mean the
    // rename never actually reaches the tutor's answers.
    await prisma.$transaction([
      prisma.document.update({ where: { id }, data: { title } }),
      prisma.$executeRaw`UPDATE document_chunks SET "fileName" = ${title} WHERE "documentId" = ${id}`,
    ])

    return NextResponse.json({ id, title })
  } catch (error) {
    console.error("[CRITICAL_ERROR] PATCH /api/documents/[id] failed:", error)
    const message = error instanceof Error ? error.message : "Unexpected server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await ctx.params
    const document = await loadOwnedDocument(id, userId)
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // DocumentChunk.onDelete: Cascade removes every chunk automatically —
    // no Blob cleanup needed, the raw file is already deleted right after
    // ingestion (see app/api/upload/finalize/route.ts).
    await prisma.document.delete({ where: { id } })

    return NextResponse.json({ id, deleted: true })
  } catch (error) {
    console.error("[CRITICAL_ERROR] DELETE /api/documents/[id] failed:", error)
    const message = error instanceof Error ? error.message : "Unexpected server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
