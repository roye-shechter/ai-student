import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

const PAGE_SIZE = 50
const DAY_MS = 24 * 60 * 60 * 1000
const KINDS = ["calls", "activity", "learning"] as const
type Kind = (typeof KINDS)[number]

/**
 * Raw rows behind the admin dashboard's numbers, one page at a time. The
 * dashboard opens these from its drill-down links: every model call, every
 * tracked activity event, or every learning session, optionally narrowed to
 * one user, model or route, and optionally to the last N days (omit `days`
 * for the full history). Paged by id cursor, newest first.
 */
export async function GET(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const params = new URL(req.url).searchParams
  const kind = params.get("kind") as Kind | null
  if (!kind || !KINDS.includes(kind)) {
    return NextResponse.json({ error: "Unknown record kind" }, { status: 400 })
  }

  const userId = params.get("userId") || undefined
  const model = params.get("model") || undefined
  const route = params.get("route") || undefined
  const days = Number(params.get("days"))
  const since = days > 0 ? new Date(Date.now() - days * DAY_MS) : undefined
  const cursor = params.get("cursor")
  // Prisma treats an undefined cursor as "start from the newest row".
  const page = { cursor: cursor ? { id: cursor } : undefined, skip: cursor ? 1 : undefined }

  if (kind === "calls") {
    const rows = await prisma.modelUsageEvent.findMany({
      where: { userId, model, route, createdAt: since ? { gte: since } : undefined },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...page,
      select: {
        id: true,
        createdAt: true,
        provider: true,
        model: true,
        route: true,
        feature: true,
        inputTokens: true,
        outputTokens: true,
        costUsd: true,
        latencyMs: true,
        ok: true,
        fallbackFrom: true,
        user: { select: { username: true, fullName: true } },
      },
    })
    const more = rows.length > PAGE_SIZE
    const pageRows = rows.slice(0, PAGE_SIZE)
    return NextResponse.json({
      rows: pageRows.map((c) => ({
        id: c.id,
        at: c.createdAt.toISOString(),
        user: c.user.fullName ?? c.user.username,
        provider: c.provider,
        model: c.model,
        route: c.route,
        feature: c.feature,
        inputTokens: c.inputTokens,
        outputTokens: c.outputTokens,
        costUsd: c.costUsd,
        latencyMs: c.latencyMs,
        ok: c.ok,
        fallbackFrom: c.fallbackFrom,
      })),
      nextCursor: more ? pageRows[pageRows.length - 1].id : null,
    })
  }

  if (kind === "activity") {
    const rows = await prisma.activityEvent.findMany({
      where: { userId, createdAt: since ? { gte: since } : undefined },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...page,
      select: {
        id: true,
        createdAt: true,
        type: true,
        ip: true,
        userAgent: true,
        user: { select: { username: true, fullName: true } },
      },
    })
    const more = rows.length > PAGE_SIZE
    const pageRows = rows.slice(0, PAGE_SIZE)
    return NextResponse.json({
      rows: pageRows.map((e) => ({
        id: e.id,
        at: e.createdAt.toISOString(),
        user: e.user.fullName ?? e.user.username,
        type: e.type,
        ip: e.ip,
        userAgent: e.userAgent,
      })),
      nextCursor: more ? pageRows[pageRows.length - 1].id : null,
    })
  }

  // Learning sessions are dated by when the session started, not when the row was written.
  const rows = await prisma.learningSession.findMany({
    where: { userId, sessionStart: since ? { gte: since } : undefined },
    orderBy: [{ sessionStart: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
      ...page,
    select: {
      id: true,
      sessionStart: true,
      durationMinutes: true,
      activityType: true,
      user: { select: { username: true, fullName: true } },
      course: { select: { courseName: true } },
    },
  })
  const more = rows.length > PAGE_SIZE
  const pageRows = rows.slice(0, PAGE_SIZE)
  return NextResponse.json({
    rows: pageRows.map((s) => ({
      id: s.id,
      at: s.sessionStart.toISOString(),
      user: s.user.fullName ?? s.user.username,
      course: s.course.courseName,
      durationSeconds: s.durationMinutes === null ? null : s.durationMinutes * 60,
      activityType: s.activityType,
    })),
    nextCursor: more ? pageRows[pageRows.length - 1].id : null,
  })
}
