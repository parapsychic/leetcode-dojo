"use client";

import Editor from "@monaco-editor/react";

export const LANGUAGES = ["python", "java", "cpp", "csharp", "javascript", "typescript", "go"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANG_LABELS: Record<Language, string> = {
  python: "Python",
  java: "Java",
  cpp: "C++",
  csharp: "C#",
  javascript: "JavaScript",
  typescript: "TypeScript",
  go: "Go",
};

export function CodeEditor({
  value,
  onChange,
  language,
}: {
  value: string;
  onChange: (v: string) => void;
  language: Language;
}) {
  return (
    <Editor
      height="100%"
      theme="vs-dark"
      language={language === "cpp" ? "cpp" : language}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      options={{
        fontSize: 13,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        padding: { top: 12 },
        fontFamily: "var(--font-mono), monospace",
        tabSize: 2,
        automaticLayout: true,
        wordWrap: "on",
      }}
      loading={<div className="p-4 text-sm text-muted">Loading editor…</div>}
    />
  );
}
