import { FALLBACK_USD_TO_ILS } from "@/lib/admin-time"

const CACHE_MS = 6 * 60 * 60 * 1000 // 6h — close enough for cost estimates, without hammering a free API on every admin page load
let cachedRate: number | null = null
let cachedAt = 0

/**
 * Current USD→ILS rate from a free, no-key exchange-rate API (Frankfurter,
 * backed by the European Central Bank's daily reference rates), cached
 * in-memory per server instance. Falls back to the fixed estimate in
 * lib/admin-time.ts if the fetch fails, times out, or returns something
 * malformed — the admin panel's cost figures should never break just
 * because a currency API is unreachable.
 */
export async function getUsdToIlsRate(): Promise<number> {
  if (cachedRate !== null && Date.now() - cachedAt < CACHE_MS) return cachedRate
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=ILS", {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`exchange rate API returned ${res.status}`)
    const data = (await res.json()) as { rates?: { ILS?: number } }
    const rate = data.rates?.ILS
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error("malformed exchange rate response")
    }
    cachedRate = rate
    cachedAt = Date.now()
    return rate
  } catch {
    return cachedRate ?? FALLBACK_USD_TO_ILS
  }
}
