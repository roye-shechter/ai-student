import type { Metadata } from "next";
import { Rubik, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AmbientTexture } from "@/components/ambient-texture";

// One family carries the whole app now: Rubik is a geometric, rounded sans
// designed with native Hebrew glyphs from the start (not a Latin face with
// Hebrew bolted on), which is why it's the default look of most Israeli
// tech products — display weights (700/900) for headlines, regular/medium
// for body, so hierarchy comes from weight, not from switching typefaces.
const rubik = Rubik({
  variable: "--font-rubik",
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
        className={`${rubik.variable} ${geistMono.variable} min-h-full flex flex-col antialiased`}
        suppressHydrationWarning
      >
        <AmbientTexture />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
