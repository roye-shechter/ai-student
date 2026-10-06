export type ChatImage = {
  mimeType: "image/jpeg"
  base64: string
  previewUrl: string
}

const MAX_SIDE_PX = 1600
const JPEG_QUALITY = 0.85

/**
 * Downscale and re-encode a picked image to JPEG so the request body stays
 * far below the server's limit, whatever the original camera resolution was.
 * Transparency is flattened onto white since JPEG has no alpha channel.
 */
export async function prepareChatImage(file: File): Promise<ChatImage> {
  if (!file.type.startsWith("image/")) throw new Error("יש לבחור קובץ תמונה")

  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, MAX_SIDE_PX / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("הדפדפן לא תומך בעיבוד התמונה")
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const previewUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY)
    return { mimeType: "image/jpeg", base64: previewUrl.split(",")[1], previewUrl }
  } finally {
    bitmap.close()
  }
}
