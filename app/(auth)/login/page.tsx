"use client"

import { useRef, useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { gsap, useGSAP } from "@/lib/gsap"

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  })

  const rootRef = useRef<HTMLDivElement>(null)

  // One orchestrated entrance: the wordmark, then the subline, then the
  // panel with the circuit-trace edge drawing itself, then the fields —
  // in reading order, not a blanket fade-up on every element.
  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
      tl.fromTo(".login-mark", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6 })
        .fromTo(".login-sub", { opacity: 0 }, { opacity: 1, duration: 0.5 }, "-=0.25")
        .fromTo(".login-trace", { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: "power2.inOut" }, "-=0.2")
        .fromTo(
          ".login-field",
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.1 },
          "-=0.35"
        )
        .fromTo(".login-cta", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5 }, "-=0.2")
    },
    { scope: rootRef }
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        username: formData.username,
        password: formData.password,
        redirect: false,
      })

      if (result?.error) {
        setError("שם משתמש או סיסמה שגויים")
      } else if (result?.ok) {
        router.push("/dashboard")
        router.refresh()
      }
    } catch {
      setError("אירעה שגיאה בהתחברות")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div ref={rootRef} className="relative z-10 flex min-h-screen items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="login-mark text-center mb-2">
          <h1 className="gradient-text text-5xl font-black tracking-tight">AI Student</h1>
        </div>
        <p className="login-sub text-center text-[#8d89ac] mb-8">
          המורה הפרטי שלך, זמין בכל שעה
        </p>

        <div className="glass-panel border border-[#29253f] rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
          <div className="login-trace h-[2px] w-full bg-gradient-to-l from-[#7c5cff] via-[#34e4ea] to-[#7c5cff] origin-right" />

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {error && (
              <div className="login-field bg-red-950/40 border border-red-800/60 text-red-200 px-4 py-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            <div className="login-field space-y-2">
              <Label htmlFor="username" className="text-[#c9c5e0] text-sm">
                שם משתמש או אימייל
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="yerahmiel"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="bg-[#1c1a2b] border-[#29253f] text-white h-12 focus-visible:ring-[#7c5cff] focus-visible:border-[#7c5cff] transition-shadow duration-300"
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
                className="bg-[#1c1a2b] border-[#29253f] text-white h-12 focus-visible:ring-[#7c5cff] focus-visible:border-[#7c5cff] transition-shadow duration-300"
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
                    מתחבר...
                  </>
                ) : (
                  "התחבר למערכת"
                )}
              </Button>
              <div className="text-center text-sm text-[#8d89ac]">
                אין לך חשבון?{" "}
                <Link href="/register" className="text-[#9b82ff] hover:text-[#34e4ea] font-medium transition-colors">
                  הירשם כאן
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
