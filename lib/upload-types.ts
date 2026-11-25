/**
 * File-type knowledge shared by the browser (upload picker, chat attach) and
 * the server (upload token + finalize). Kept free of server-only imports
 * (pdf2json etc.) so client components can use it too.
 */

export const PDF_TYPES = ["application/pdf"]
export const TXT_TYPES = ["text/plain", "text/markdown", "text/csv"]
export const TXT_EXTENSIONS = [".txt", ".md", ".csv"]
export const DOCX_TYPES = ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
export const PPTX_TYPES = ["application/vnd.openxmlformats-officedocument.presentationml.presentation"]

// Size ceilings. Documents are downloaded into function memory and parsed;
// audio is capped by OpenAI's transcription endpoint (25MB hard limit).
export const MAX_DOC_BYTES = 50 * 1024 * 1024
export const MAX_AUDIO_BYTES = 24 * 1024 * 1024
// Formats OpenAI's transcription endpoint accepts, plus the MIME aliases
// browsers/OSes actually report for them (e.g. Chrome/Firefox on Windows
// report WAV as audio/x-wav or audio/wave, macOS reports M4A as audio/x-m4a).
export const AUDIO_TYPES = [
  "audio/mpeg", "audio/mp3", "audio/x-mpeg", "audio/mpeg3", "audio/x-mpeg-3",
  "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac",
  "audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave",
  "audio/webm", "video/mp4", "video/webm",
]
export const AUDIO_EXTENSIONS = [".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm"]
export const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
export const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"]

export const ALL_UPLOAD_TYPES = [...PDF_TYPES, ...TXT_TYPES, ...DOCX_TYPES, ...PPTX_TYPES, ...AUDIO_TYPES, ...IMAGE_TYPES]

/** `accept` attribute value for file inputs that take any supported material. */
export const MATERIAL_ACCEPT = [
  ".pdf", ".docx", ".pptx", ...TXT_EXTENSIONS, ...IMAGE_EXTENSIONS, ...AUDIO_EXTENSIONS,
  ...PDF_TYPES, ...DOCX_TYPES, ...PPTX_TYPES, ...TXT_TYPES, "image/jpeg", "image/png", "image/webp", "audio/*", "video/mp4", "video/webm",
].join(",")

export const UNSUPPORTED_FILE_MESSAGE = "סוג קובץ לא נתמך. אפשר להעלות PDF, Word (DOCX), PowerPoint (PPTX), TXT, תמונה (JPG/PNG/WEBP) או הקלטת שיעור (MP3/M4A/WAV/MP4/WEBM). קבצי DOC/PPT ישנים — שמור אותם כ-DOCX/PPTX."

function hasExt(name: string, exts: string[]): boolean {
  const lower = name.toLowerCase()
  return exts.some((ext) => lower.endsWith(ext))
}

export function isPdf(name: string, type: string): boolean {
  return PDF_TYPES.includes(type) || name.toLowerCase().endsWith(".pdf")
}

export function isTxt(name: string, type: string): boolean {
  return TXT_TYPES.includes(type) || hasExt(name, TXT_EXTENSIONS)
}

export function isDocx(name: string, type: string): boolean {
  return DOCX_TYPES.includes(type) || name.toLowerCase().endsWith(".docx")
}

export function isPptx(name: string, type: string): boolean {
  return PPTX_TYPES.includes(type) || name.toLowerCase().endsWith(".pptx")
}

export function isAudio(name: string, type: string): boolean {
  return AUDIO_TYPES.includes(type) || hasExt(name, AUDIO_EXTENSIONS)
}

export function isImage(name: string, type: string): boolean {
  return IMAGE_TYPES.includes(type) || hasExt(name, IMAGE_EXTENSIONS)
}

export function isSupportedMaterial(name: string, type: string): boolean {
  return (
    isPdf(name, type) || isTxt(name, type) || isDocx(name, type) || isPptx(name, type) ||
    isAudio(name, type) || isImage(name, type)
  )
}

const EXTENSION_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".txt": "text/plain", ".md": "text/markdown", ".csv": "text/csv",
  ".docx": DOCX_TYPES[0], ".pptx": PPTX_TYPES[0],
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".mp3": "audio/mpeg", ".mpga": "audio/mpeg", ".mpeg": "audio/mpeg",
  ".m4a": "audio/mp4", ".wav": "audio/wav", ".mp4": "video/mp4", ".webm": "audio/webm",
}

/**
 * The content type to upload a file with. Browsers often report an empty or
 * unusual `file.type` (notably on Windows for .m4a/.wav/.txt), which the
 * upload token's allow-list then rejects. When the reported type isn't one we
 * accept, fall back to the one implied by the file extension.
 */
export function resolveContentType(name: string, reported: string): string {
  if (ALL_UPLOAD_TYPES.includes(reported)) return reported
  const lower = name.toLowerCase()
  const ext = Object.keys(EXTENSION_MIME).find((e) => lower.endsWith(e))
  return ext ? EXTENSION_MIME[ext] : reported
}
