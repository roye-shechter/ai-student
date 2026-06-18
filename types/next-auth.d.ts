import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string
      role: string
      fullName?: string | null
      avatarUrl?: string | null
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    username: string
    role: string
    fullName?: string | null
    avatarUrl?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    username: string
    role: string
    fullName?: string | null
    avatarUrl?: string | null
  }
}
