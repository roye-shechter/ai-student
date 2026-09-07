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
    <div className="space-y-2 text-sm leading-relaxed [&_strong]:text-[#d4b483] [&_a]:text-[#c9a876] [&_a]:underline">
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ children }) => <h1 className="font-serif text-base text-[#d4b483] mt-2 mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="font-serif text-base text-[#d4b483] mt-2 mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="font-serif text-sm text-[#d4b483] mt-2 mb-1">{children}</h3>,
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pr-5 space-y-1 mb-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pr-5 space-y-1 mb-2">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          code: ({ children }) => (
            <code className="bg-[#0d0c0a] border border-[#332b1f] rounded-sm px-1 py-0.5 text-[#d4b483] text-xs">
              {children}
            </code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-r-2 border-[#b08d57]/50 pr-3 text-neutral-300 italic">{children}</blockquote>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  )
}
