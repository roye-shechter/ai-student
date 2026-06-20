/**
 * Safely parse a fetch Response as JSON.
 *
 * Returns the parsed body, or `null` if the response is not JSON (e.g. a
 * server crash that produced an HTML error page) or the body is not valid
 * JSON. Callers should treat `null` as a failure and fall back to a clean,
 * status-based message instead of blindly calling `response.json()` (which
 * throws "Unexpected token '<'" on an HTML body and can crash the UI).
 */
export async function readJson<T = unknown>(response: Response): Promise<T | null> {
  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) return null
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}
