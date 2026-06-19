"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  })

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
    } catch (err) {
      setError("אירעה שגיאה בהתחברות")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-4" dir="rtl">
      <Card className="w-full max-w-md bg-[#141414] text-white border-[#d4af37]/30 shadow-2xl shadow-[#d4af37]/10">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] to-[#FFD700] mb-2">
            AI Student
          </CardTitle>
          <CardDescription className="text-neutral-400 text-lg">
            הזן את פרטי ההתחברות שלך למערכת
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6 mt-4">
            {error && (
              <div className="bg-red-950/50 border border-red-800 text-red-200 px-4 py-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-neutral-300 text-md">
                שם משתמש או אימייל
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="yerahmiel"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="bg-[#1f1f1f] border-[#2a2a2a] text-white focus-visible:ring-[#d4af37] focus-visible:border-[#d4af37] h-12"
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-neutral-300 text-md">
                סיסמה
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="bg-[#1f1f1f] border-[#2a2a2a] text-white focus-visible:ring-[#d4af37] focus-visible:border-[#d4af37] h-12"
                required
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#d4af37] hover:bg-[#FFD700] text-black h-12 text-lg font-semibold transition-colors"
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
            <div className="text-center text-sm text-neutral-400">
              אין לך חשבון?{" "}
              <Link href="/register" className="text-[#d4af37] hover:text-[#FFD700] font-medium">
                הירשם כאן
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
