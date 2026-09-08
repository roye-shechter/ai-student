import PDFParser, { type Output } from "pdf2json"

/**
 * File-type detection and text extraction shared by the upload finalize route.
 * Split out of the route itself so the pdf2json wiring has one home.
 */

export const PDF_TYPES = ["application/pdf"]
export const TXT_TYPES = ["text/plain"]
// Formats OpenAI's transcription endpoint accepts.
export const AUDIO_TYPES = ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/wav", "audio/webm", "audio/m4a", "audio/x-m4a", "video/mp4", "video/webm"]
export const AUDIO_EXTENSIONS = [".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm"]

export function isPdf(name: string, type: string): boolean {
  return PDF_TYPES.includes(type) || name.toLowerCase().endsWith(".pdf")
}

export function isTxt(name: string, type: string): boolean {
  return TXT_TYPES.includes(type) || name.toLowerCase().endsWith(".txt")
}

export function isAudio(name: string, type: string): boolean {
  return AUDIO_TYPES.includes(type) || AUDIO_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))
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
