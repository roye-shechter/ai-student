import JSZip from "jszip"

/**
 * Text extraction for Word (.docx) and PowerPoint (.pptx). Both are zip
 * archives of XML, so JSZip plus a small tag scanner is enough — no native
 * dependencies, runs in a serverless function. Legacy binary .doc/.ppt are not
 * supported (the upload UI tells the user to re-save them as docx/pptx).
 */

// Guards against zip bombs: a tiny archive that inflates to gigabytes.
const MAX_ENTRY_UNCOMPRESSED_BYTES = 100 * 1024 * 1024
const MAX_TEXT_CHARS = 20_000_000

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

function safeFromCodePoint(code: number): string {
  try {
    return String.fromCodePoint(code)
  } catch {
    return ""
  }
}

async function readEntry(zip: JSZip, name: string): Promise<string> {
  const entry = zip.file(name)
  if (!entry) return ""
  const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize
  if (typeof size === "number" && size > MAX_ENTRY_UNCOMPRESSED_BYTES) {
    throw new Error(`Archive entry too large: ${name}`)
  }
  return entry.async("string")
}

/** Walks `xml`, turning paragraph ends/breaks/tabs into whitespace and collecting the text inside `textTag` elements. */
function collectText(xml: string, textTag: "w:t" | "a:t", paragraphEnd: string, breakTag: string): string {
  const out: string[] = []
  const re = new RegExp(`<${textTag}(?:\\s[^>]*)?>([^<]*)</${textTag}>|${paragraphEnd}|<${breakTag}\\s*/>|<w:tab\\s*/>`, "g")
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    if (m[1] !== undefined) out.push(decodeXmlEntities(m[1]))
    else if (m[0].startsWith("<w:tab")) out.push("\t")
    else out.push("\n") // paragraph end or line break
  }
  return out.join("").replace(/\n{3,}/g, "\n\n").trim()
}

export async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes)
  const body = await readEntry(zip, "word/document.xml")
  if (!body) throw new Error("Not a valid .docx (word/document.xml missing)")
  const parts = [collectText(body, "w:t", "</w:p>", "w:br")]
  // Footnotes/endnotes often hold citations and clarifications students want searchable.
  for (const extra of ["word/footnotes.xml", "word/endnotes.xml"]) {
    const xml = await readEntry(zip, extra)
    const text = xml ? collectText(xml, "w:t", "</w:p>", "w:br") : ""
    if (text) parts.push(text)
  }
  return parts.filter(Boolean).join("\n\n").slice(0, MAX_TEXT_CHARS)
}

function slideNumber(path: string): number {
  return Number(/(\d+)\.xml$/.exec(path)?.[1] ?? 0)
}

export async function extractPptxText(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes)
  const slidePaths = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => slideNumber(a) - slideNumber(b))
  if (slidePaths.length === 0) throw new Error("Not a valid .pptx (no slides found)")

  const out: string[] = []
  let total = 0
  for (const path of slidePaths) {
    const n = slideNumber(path)
    // Drop auto-fields (slide number/date) so they don't pollute the text.
    const clean = (xml: string) => xml.replace(/<a:fld\b[\s\S]*?<\/a:fld>/g, "")
    const slideText = collectText(clean(await readEntry(zip, path)), "a:t", "</a:p>", "a:br")
    const notesXml = await readEntry(zip, `ppt/notesSlides/notesSlide${n}.xml`)
    const notesText = notesXml ? collectText(clean(notesXml), "a:t", "</a:p>", "a:br") : ""
    if (!slideText && !notesText) continue
    let block = `[שקופית ${n}]\n${slideText}`
    if (notesText) block += `\n(הערות מרצה: ${notesText})`
    out.push(block)
    total += block.length
    if (total > MAX_TEXT_CHARS) break
  }
  return out.join("\n\n")
}
