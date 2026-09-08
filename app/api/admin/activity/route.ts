import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

const PAGE_SIZE = 50

/** Recent cross-user activity feed, newest first, cursor-paginated by id. */
export async function GET(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get("cursor") ?? undefined

  const events = await prisma.activityEvent.findMany({
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include: { user: { select: { username: true, fullName: true } } },
  })

  const hasMore = events.length > PAGE_SIZE
  const page = hasMore ? events.slice(0, PAGE_SIZE) : events

  return NextResponse.json({
    events: page.map((e) => ({
      id: e.id,
      type: e.type,
      ip: e.ip,
      userAgent: e.userAgent,
      metadata: e.metadata,
      createdAt: e.createdAt,
      user: { username: e.user.username, fullName: e.user.fullName },
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  })
}
