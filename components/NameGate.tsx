"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

/**
 * First-run gate: if no name is set yet, ask the learner what to call them
 * before they start. Persists via the progress store, then refreshes so the
 * rest of the app picks up the name.
 */
export function NameGate() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/progress")
      .then((r) => r.json())
      .then((p: { profile?: { name?: string } }) => {
        if (alive && !p?.profile?.name?.trim()) setOpen(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function save() {
    const n = name.trim();
    if (!n || saving) return;
    setSaving(true);
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "profile", name: n }),
      });
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-1 text-lg font-semibold">Welcome to dx dbye 👋</div>
        <p className="mb-4 text-sm text-muted">
          What should we call you? This personalizes your dashboard and the
          interviewer.
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="Your name"
          maxLength={40}
          className="mb-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent/50"
        />
        <Button onClick={save} disabled={!name.trim() || saving} className="w-full">
          {saving ? "Saving…" : "Let's go"}
        </Button>
      </div>
    </div>
  );
}
