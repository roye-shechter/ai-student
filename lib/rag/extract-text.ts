import PDFParser, { type Output } from "pdf2json"
import { getGemini, GEMINI_VISUAL_MODEL, GEMINI_VISUAL_FALLBACK_MODEL } from "./clients"

/**
 * File-type detection and text extraction shared by the upload finalize route.
 * Split out of the route itself so the pdf2json wiring has one home.
 */

export const PDF_TYPES = ["application/pdf"]
export const TXT_TYPES = ["text/plain"]
// Formats OpenAI's transcription endpoint accepts.
export const AUDIO_TYPES = ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/wav", "audio/webm", "audio/m4a", "audio/x-m4a", "video/mp4", "video/webm"]
export const AUDIO_EXTENSIONS = [".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm"]
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
export const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"]

export function isPdf(name: string, type: string): boolean {
  return PDF_TYPES.includes(type) || name.toLowerCase().endsWith(".pdf")
}

export function isTxt(name: string, type: string): boolean {
  return TXT_TYPES.includes(type) || name.toLowerCase().endsWith(".txt")
}

export function isAudio(name: string, type: string): boolean {
  return AUDIO_TYPES.includes(type) || AUDIO_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))
}

export function isImage(name: string, type: string): boolean {
  return IMAGE_TYPES.includes(type) || IMAGE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))
}

/** decodeURIComponent that never throws on malformed/partial escape sequences. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Extract plain text from a PDF buffer using pdf2json — a pure-JS parser with
 * no native/canvas dependencies, so it runs cleanly in Vercel's serverless
 * containers. (pdf-parse pulled in pdfjs-dist, which crashed trying to load the
 * native @napi-rs/canvas binary that doesn't exist in the Vercel image.)
 *
 * pdf2json is event-based, so we wrap it in a Promise and assemble clean
 * per-page text from the decoded text runs (avoiding the page-break divider
 * markers that getRawTextContent() would inject).
 */
export function extractPdfText(bytes: Uint8Array): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const parser = new PDFParser(null, true)

    parser.on("pdfParser_dataError", (err) => {
      const message = err instanceof Error ? err.message : err.parserError.message
      reject(new Error(message || "Failed to parse PDF"))
    })

    parser.on("pdfParser_dataReady", (data: Output) => {
      const text = data.Pages.map((page) =>
        page.Texts.map((t) => t.R.map((run) => safeDecode(run.T)).join("")).join(" ")
      ).join("\n\n")
      resolve(text)
    })

    parser.parseBuffer(Buffer.from(bytes))
  })
}

const OCR_PROMPT =
  "העתק את כל הטקסט הקריא מהמסמך/התמונה הזו, בדיוק כפי שהוא כתוב ולפי סדר הקריאה הטבעי " +
  "(עמוד אחר עמוד אם יש כמה עמודים). אל תסכם, אל תתרגם ואל תוסיף הערות, כותרות או תיאורים " +
  "משלך — רק את הטקסט הגולמי מתוך המסמך עצמו, ושום דבר נוסף."

/** Gemini returns transient 503/429 "high demand" errors on busy models; one retry recovers most (mirrors lib/llm/stream.ts's openGeminiStream). */
async function withGeminiRetry<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    const status = (error as { status?: number }).status
    const message = error instanceof Error ? error.message : String(error)
    const transient = status === 503 || status === 429 || /\b(503|429)\b/.test(message)
    if (!transient) throw error
    await new Promise((resolve) => setTimeout(resolve, 1200))
    return call()
  }
}

async function ocrWithModel(model: string, bytes: Uint8Array, mimeType: string): Promise<string> {
  const gemini = getGemini()
  const stream = await withGeminiRetry(() =>
    gemini.models.generateContentStream({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: Buffer.from(bytes).toString("base64") } },
            { text: OCR_PROMPT },
          ],
        },
      ],
    })
  )
  let text = ""
  for await (const chunk of stream) {
    if (chunk.text) text += chunk.text
  }
  return text
}

/**
 * Last-resort text extraction for material with no text layer at all — a
 * scanned/photographed PDF, or a direct photo of a page (image/*). Gemini
 * already does the app's multimodal reading (the chat's "visual" route, see
 * lib/llm/route.ts — "Gemini has the strongest multimodal reading here"),
 * and it reads whole PDFs natively too, so this needs no PDF-to-image
 * rendering step (which would've meant a new canvas dependency — see the
 * comment on extractPdfText for why that was already ruled out once).
 *
 * Falls back to the same secondary model the chat's visual route uses
 * (GEMINI_VISUAL_FALLBACK_MODEL) if the primary model is still down after
 * withGeminiRetry's one retry — seen in practice: the primary model held a
 * sustained "high demand" 503 for several minutes straight, not just a
 * one-off blip.
 */
export async function extractViaOcr(bytes: Uint8Array, mimeType: string): Promise<string> {
  try {
    return await ocrWithModel(GEMINI_VISUAL_MODEL, bytes, mimeType)
  } catch (error) {
    console.error(`[ocr] ${GEMINI_VISUAL_MODEL} failed, trying fallback model:`, error instanceof Error ? error.message : error)
    return await ocrWithModel(GEMINI_VISUAL_FALLBACK_MODEL, bytes, mimeType)
  }
}
