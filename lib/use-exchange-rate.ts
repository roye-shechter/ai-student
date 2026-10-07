"use client"

import { useEffect, useState } from "react"
import { readJson } from "@/lib/http"
import { FALLBACK_USD_TO_ILS } from "@/lib/admin-time"

// Shared across every component instance for this page load, so only the
// first mounted admin component actually fetches — the rest start from the
// cached value immediately instead of each firing their own request.
let cachedRate: number | null = null
let cachedAt = 0
const CLIENT_CACHE_MS = 60 * 60 * 1000 // re-fetch at most once an hour per browser session

/**
 * The live USD→ILS rate for the admin panel's cost figures (see
 * lib/exchange-rate.ts). Starts from the fixed fallback so numbers render
 * immediately on mount, then swaps to the live rate once the request
 * resolves — callers don't need a loading state for this, just a brief
 * one-render correction.
 */
export function useUsdToIlsRate(): number {
  const [rate, setRate] = useState(cachedRate ?? FALLBACK_USD_TO_ILS)

  useEffect(() => {
    if (cachedRate !== null && Date.now() - cachedAt < CLIENT_CACHE_MS) return
    let cancelled = false
    fetch("/api/admin/exchange-rate")
      .then((res) => readJson<{ usdToIls?: number }>(res))
      .then((data) => {
        if (cancelled || typeof data?.usdToIls !== "number") return
        cachedRate = data.usdToIls
        cachedAt = Date.now()
        setRate(data.usdToIls)
      })
      .catch(() => {
        // Stay on the fallback rate — formatIls already defaults to it.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return rate
}
