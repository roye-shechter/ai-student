"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Loader2 } from "lucide-react"
import { WelcomeSplash } from "@/components/welcome-splash"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  if (status === "loading") {
    return (
      <div className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#ff7a3d] mx-auto mb-4" />
          <p className="text-[#8b93a3]">טוען...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const displayName = session.user?.fullName || session.user?.username || ""

  return (
    <>
      <WelcomeSplash name={displayName} />
      {children}
    </>
  )
}
