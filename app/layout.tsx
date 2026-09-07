import type { Metadata } from "next";
import { Heebo, Frank_Ruhl_Libre, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AmbientTexture } from "@/components/ambient-texture";

// Two families, deliberately: Frank Ruhl Libre — a serif with real literary
// Hebrew pedigree — carries every headline and display number, the way a
// premium editorial/photography site leans on type instead of chrome.
// Heebo stays for body copy and UI controls, where a serif would fight
// legibility at small sizes.
const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const frankRuhlLibre = Frank_Ruhl_Libre({
  variable: "--font-serif-display",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700", "900"],
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
        className={`${heebo.variable} ${frankRuhlLibre.variable} ${geistMono.variable} min-h-full flex flex-col antialiased`}
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
