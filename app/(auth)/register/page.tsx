"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { readJson } from "@/lib/http"
import { gsap, useGSAP } from "@/lib/gsap"

export default function RegisterPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    fullName: "",
  })

  const rootRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
      tl.fromTo(".login-mark", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6 })
        .fromTo(".login-sub", { opacity: 0 }, { opacity: 1, duration: 0.5 }, "-=0.25")
        .fromTo(".login-trace", { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: "power2.inOut" }, "-=0.2")
        .fromTo(
          ".login-field",
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.45, stagger: 0.07 },
          "-=0.35"
        )
        .fromTo(".login-cta", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5 }, "-=0.15")
    },
    { scope: rootRef }
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    if (formData.password !== formData.confirmPassword) {
      setError("הסיסמאות אינן תואמות")
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          username: formData.username,
          password: formData.password,
          fullName: formData.fullName || undefined,
        }),
      })

      const data = await readJson<{ error?: string }>(response)

      if (!response.ok || !data) {
        setError(data?.error || `אירעה שגיאה בהרשמה (קוד ${response.status})`)
        return
      }

      router.push("/?registered=true")
    } catch {
      setError("אירעה שגיאה בהרשמה")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div ref={rootRef} className="relative z-10 flex min-h-screen items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="login-mark text-center mb-2">
          <h1 className="gradient-text text-4xl font-black tracking-tight">הרשמה למערכת</h1>
        </div>
        <p className="login-sub text-center text-[#8d89ac] mb-8">צור חשבון חדש ב-AI Student</p>

        <div className="glass-panel border border-[#29253f] rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
          <div className="login-trace h-[2px] w-full bg-gradient-to-l from-[#7c5cff] via-[#34e4ea] to-[#7c5cff] origin-right" />

          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            {error && (
              <div className="login-field bg-red-950/40 border border-red-800/60 text-red-200 px-4 py-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            <div className="login-field space-y-2">
              <Label htmlFor="fullName" className="text-[#c9c5e0] text-sm">
                שם מלא (אופציונלי)
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="ירחמיאל ליפשיץ"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="bg-[#1c1a2b] border-[#29253f] text-white h-11 focus-visible:ring-[#7c5cff] focus-visible:border-[#7c5cff]"
                disabled={isLoading}
              />
            </div>
            <div className="login-field space-y-2">
              <Label htmlFor="email" className="text-[#c9c5e0] text-sm">
                כתובת אימייל
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="yerahmiel@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-[#1c1a2b] border-[#29253f] text-white h-11 focus-visible:ring-[#7c5cff] focus-visible:border-[#7c5cff]"
                required
                disabled={isLoading}
              />
            </div>
            <div className="login-field space-y-2">
              <Label htmlFor="username" className="text-[#c9c5e0] text-sm">
                שם משתמש
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="yerahmiel"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="bg-[#1c1a2b] border-[#29253f] text-white h-11 focus-visible:ring-[#7c5cff] focus-visible:border-[#7c5cff]"
                required
                disabled={isLoading}
              />
            </div>
            <div className="login-field space-y-2">
              <Label htmlFor="password" className="text-[#c9c5e0] text-sm">
                סיסמה
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="bg-[#1c1a2b] border-[#29253f] text-white h-11 focus-visible:ring-[#7c5cff] focus-visible:border-[#7c5cff]"
                required
                disabled={isLoading}
                minLength={6}
              />
            </div>
            <div className="login-field space-y-2">
              <Label htmlFor="confirmPassword" className="text-[#c9c5e0] text-sm">
                אימות סיסמה
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="bg-[#1c1a2b] border-[#29253f] text-white h-11 focus-visible:ring-[#7c5cff] focus-visible:border-[#7c5cff]"
                required
                disabled={isLoading}
              />
            </div>

            <div className="login-cta space-y-4 pt-2">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 text-base font-semibold text-white bg-gradient-to-l from-[#7c5cff] to-[#5a3fd6] hover:from-[#8f70ff] hover:to-[#6b4ee8] transition-all duration-300 hover:shadow-lg hover:shadow-[#7c5cff]/40 active:scale-[0.98]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    נרשם...
                  </>
                ) : (
                  "הרשם למערכת"
                )}
              </Button>
              <div className="text-center text-sm text-[#8d89ac]">
                כבר יש לך חשבון?{" "}
                <Link href="/" className="text-[#9b82ff] hover:text-[#34e4ea] font-medium transition-colors">
                  התחבר כאן
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
