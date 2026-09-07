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
import { markJustLoggedIn } from "@/components/welcome-splash"

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  })

  const rootRef = useRef<HTMLDivElement>(null)

  // One quiet entrance, slower and without bounce — the wordmark settles
  // in, the hairline rule draws itself, the fields follow. Restraint over
  // energy, matching the classic-editorial identity.
  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } })
      tl.fromTo(".login-mark", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.9 })
        .fromTo(".login-sub", { opacity: 0 }, { opacity: 1, duration: 0.7 }, "-=0.4")
        .fromTo(".login-trace", { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: "power1.inOut" }, "-=0.3")
        .fromTo(
          ".login-field",
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.6, stagger: 0.08 },
          "-=0.5"
        )
        .fromTo(".login-cta", { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6 }, "-=0.3")
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
        markJustLoggedIn()
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
          <h1 className="font-serif gold-text text-5xl tracking-tight">AI Student</h1>
        </div>
        <p className="login-sub text-center text-[#8b93a3] mb-8">
          המורה הפרטי שלך, זמין בכל שעה
        </p>

        <div className="glass-panel border border-[#242b3a] rounded-sm overflow-hidden shadow-2xl shadow-black/40">
          <div className="login-trace h-px w-full bg-[#ff7a3d] origin-center" />

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {error && (
              <div className="login-field bg-red-950/40 border border-red-800/60 text-red-200 px-4 py-3 rounded-sm text-sm text-center">
                {error}
              </div>
            )}

            <div className="login-field space-y-2">
              <Label htmlFor="username" className="text-[#c9c9d1] text-sm">
                שם משתמש או אימייל
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="yerahmiel"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="bg-[#161b26] border-[#242b3a] text-white rounded-sm h-12 focus-visible:ring-[#ff7a3d] focus-visible:border-[#ff7a3d] transition-shadow duration-300"
                required
                disabled={isLoading}
              />
            </div>

            <div className="login-field space-y-2">
              <Label htmlFor="password" className="text-[#c9c9d1] text-sm">
                סיסמה
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="bg-[#161b26] border-[#242b3a] text-white rounded-sm h-12 focus-visible:ring-[#ff7a3d] focus-visible:border-[#ff7a3d] transition-shadow duration-300"
                required
                disabled={isLoading}
              />
            </div>

            <div className="login-cta space-y-4 pt-2">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 text-base font-semibold text-[#12161f] bg-[#ff7a3d] hover:bg-[#ffb066] rounded-full transition-all duration-300 active:scale-[0.99]"
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
              <div className="text-center text-sm text-[#8b93a3]">
                אין לך חשבון?{" "}
                <Link href="/register" className="text-[#ffb066] hover:text-[#f5f6f8] font-medium transition-colors">
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
