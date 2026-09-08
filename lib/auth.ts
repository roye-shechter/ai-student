import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { logActivity, extractIp, extractUserAgent } from "@/lib/activity-log"

// Validation schemas
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
})

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/",
    error: "/",
  },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        try {
          // Validate input
          const { username, password } = loginSchema.parse(credentials)

          // Find user by username or email
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { username: username },
                { email: username }
              ]
            }
          })

          if (!user || !user.passwordHash) {
            throw new Error("Invalid credentials")
          }

          // Verify password
          const isPasswordValid = await bcrypt.compare(password, user.passwordHash)

          if (!isPasswordValid) {
            throw new Error("Invalid credentials")
          }

          // Update last login
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() }
          })

          // Feeds the admin dashboard's per-user IP history (app/admin).
          // Awaited (not fire-and-forget) — on serverless this function's
          // process can be frozen right after the response goes out, which
          // would silently drop an un-awaited write. req.headers here is a
          // plain object, not a Headers instance, in next-auth v4's
          // CredentialsProvider. logActivity itself never throws.
          const headers = (req?.headers ?? {}) as Record<string, string | string[] | undefined>
          await logActivity({
            userId: user.id,
            type: "login",
            ip: extractIp(headers),
            userAgent: extractUserAgent(headers),
          })

          // Return user object
          return {
            id: user.id,
            email: user.email,
            username: user.username,
            fullName: user.fullName,
            role: user.role,
            avatarUrl: user.avatarUrl,
          }
        } catch (error) {
          console.error("Auth error:", error)
          return null
        }
      }
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign in
      if (user) {
        token.id = user.id
        token.username = user.username
        token.role = user.role
        token.fullName = user.fullName
        token.avatarUrl = user.avatarUrl
      }

      // Update session
      if (trigger === "update" && session) {
        token = { ...token, ...session.user }
      }

      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.username = token.username as string
        session.user.role = token.role as string
        session.user.fullName = token.fullName as string
        session.user.avatarUrl = token.avatarUrl as string
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
}
