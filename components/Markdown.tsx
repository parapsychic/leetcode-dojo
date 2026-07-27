"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/**
 * Different providers emit LaTeX with different delimiters. remark-math only
 * understands `$…$` / `$$…$$`, but models (notably Gemini) often use the
 * `\(…\)` / `\[…\]` forms. Normalize those to dollar delimiters so all math
 * renders regardless of which provider served the answer.
 */
function normalizeMath(src: string): string {
  return src
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, body) => `$$${body}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, body) => `$${body}$`);
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-chat text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
      >
        {normalizeMath(children)}
      </ReactMarkdown>
    </div>
  );
}
