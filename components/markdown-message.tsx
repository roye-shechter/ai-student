"use client"

import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"

/**
 * Renders an assistant chat message as rich Markdown, styled for the
 * dark/RTL theme. The tutor system prompt emits headings, bullet lists,
 * bold key terms, and LaTeX math ($...$ / $$...$$ — Claude reasons in
 * standard math notation, especially on the "hard" thinking path); without
 * remark-math + rehype-katex those would show as literal "$$...$$" text
 * instead of typeset equations.
 */
export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed [&_strong]:text-[#9b82ff] [&_a]:text-[#34e4ea] [&_a]:underline">
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ children }) => <h1 className="text-base font-bold text-[#9b82ff] mt-2 mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-bold text-[#9b82ff] mt-2 mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold text-[#9b82ff] mt-2 mb-1">{children}</h3>,
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pr-5 space-y-1 mb-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pr-5 space-y-1 mb-2">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          code: ({ children }) => (
            <code className="bg-[#0a0a12] border border-[#29253f] rounded px-1 py-0.5 text-[#34e4ea] text-xs">
              {children}
            </code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-r-2 border-[#7c5cff]/50 pr-3 text-neutral-300 italic">{children}</blockquote>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  )
}
