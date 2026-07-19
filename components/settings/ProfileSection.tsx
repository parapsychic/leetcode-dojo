"use client";

// Display-name setting (stored in progress.json's profile).

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { SettingRow, inputClass } from "./primitives";
import type { SearchMatch } from "./searchIndex";

interface Props {
  match: SearchMatch | null;
  query: string;
}

export function ProfileSection({ match, query }: Props) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/progress")
      .then((r) => r.json())
      .then((d: { profile?: { name?: string } }) => {
        if (alive && d.profile?.name) setName(d.profile.name);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "profile", name }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingRow
      rowId="profile:name"
      label="Display name"
      description="Shown on the dashboard greeting."
      match={match}
      query={query}
    >
      <div className="flex max-w-sm items-center gap-2">
        <input
          value={name}
          maxLength={40}
          placeholder="Your name"
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        <Button variant="outline" size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {saved && <span className="text-xs text-emerald-400">✓</span>}
      </div>
    </SettingRow>
  );
}
