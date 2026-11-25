/**
 * Make extracted text safe to store in Postgres. PDF parsers, OCR and
 * transcription can emit NUL bytes (\u0000), which Postgres TEXT columns
 * reject outright ("invalid byte sequence for encoding UTF8: 0x00") — that
 * made background ingestion fail for those documents. Lone UTF-16 surrogates
 * are also not valid UTF-8 and are replaced.
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "�")
}
