import type { Metadata } from "next";
import { Heebo, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { MathBackdrop } from "@/components/math-backdrop";

// Heebo: a geometric grotesk purpose-built for Hebrew+Latin, used as the
// single family across the whole product — hierarchy comes from its wide
// weight range (100-900) and scale, not from mixing typefaces.
const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Student - פלטפורמת למידה מבוססת AI",
  description: "מערכת למידה אישית עם AI Tutor ואינטגרציה עם Moodle",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" suppressHydrationWarning>
      <body
        className={`${heebo.variable} ${geistMono.variable} min-h-full flex flex-col antialiased`}
        suppressHydrationWarning
      >
        <MathBackdrop />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
