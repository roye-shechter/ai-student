"use client"

import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

/**
 * Renders an assistant chat message as rich Markdown, styled for the dark/RTL
 * theme. The tutor system prompt emits headings, bullet lists, and bold key
 * terms; without this renderer those would show as literal "##"/"**" and the
 * newlines would collapse into one unreadable wall of text.
 */
export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed [&_strong]:text-[#FFD700] [&_a]:text-[#d4af37] [&_a]:underline">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-base font-bold text-[#d4af37] mt-2 mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-bold text-[#d4af37] mt-2 mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold text-[#d4af37] mt-2 mb-1">{children}</h3>,
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pr-5 space-y-1 mb-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pr-5 space-y-1 mb-2">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          code: ({ children }) => (
            <code className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-1 py-0.5 text-[#FFD700] text-xs">
              {children}
            </code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-r-2 border-[#d4af37]/50 pr-3 text-neutral-300 italic">{children}</blockquote>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  )
}
