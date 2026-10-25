import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { authOptions } from "@/lib/auth"
import { PDF_TYPES, TXT_TYPES, AUDIO_TYPES, IMAGE_TYPES } from "@/lib/rag/extract-text"

/**
 * Issues a short-lived client upload token for Vercel Blob. The file's raw
 * bytes never pass through this (or any) of our functions — the browser PUTs
 * them straight to Blob storage, which structurally bypasses the platform's
 * ~4.5MB serverless request-body cap that broke uploads above that size.
 * See app/api/upload/finalize/route.ts for what happens once the upload
 * completes.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as HandleUploadBody

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        const session = await getServerSession(authOptions)
        const userId = session?.user?.id
        if (!userId) {
          throw new Error("Unauthorized")
        }
        return {
          allowedContentTypes: [...PDF_TYPES, ...TXT_TYPES, ...AUDIO_TYPES, ...IMAGE_TYPES],
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId }),
        }
      },
      onUploadCompleted: async () => {
        // No-op: finalize (chunk/embed/upsert) is triggered explicitly by the
        // client calling /api/upload/finalize, not by this webhook — that
        // keeps the flow testable on localhost, where Vercel can't reach a
        // webhook back.
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error("[CRITICAL_ERROR] Route /api/upload/token failed:", error)
    return NextResponse.json({ error: "אירעה שגיאה בהפקת אישור ההעלאה. נסה שוב." }, { status: 400 })
  }
}
