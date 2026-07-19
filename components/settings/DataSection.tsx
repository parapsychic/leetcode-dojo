"use client";

// Export/Import of the local progress store.

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui";
import { SettingRow } from "./primitives";
import type { SearchMatch } from "./searchIndex";

interface Props {
  match: SearchMatch | null;
  query: string;
}

export function DataSection({ match, query }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function importFile(file: File) {
    setBusy(true);
    setResult(null);
    try {
      let data: unknown;
      try {
        data = JSON.parse(await file.text());
      } catch {
        setResult({ ok: false, message: "That file isn't valid JSON." });
        return;
      }
      const res = await fetch("/api/progress/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, data }),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        problems?: number;
        quizzes?: number;
        message?: string;
      };
      if (res.ok && payload.ok) {
        setResult({
          ok: true,
          message: `Imported (${mode}) — ${payload.problems} problems, ${payload.quizzes} quiz results.`,
        });
      } else {
        setResult({ ok: false, message: payload.message ?? "Import failed." });
      }
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
      setConfirmReplace(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onPickFile() {
    if (mode === "replace" && !confirmReplace) {
      // Two-click confirm for the destructive path.
      setConfirmReplace(true);
      return;
    }
    fileRef.current?.click();
  }

  return (
    <div className="divide-y divide-border">
      <SettingRow
        rowId="data:export"
        label="Export progress"
        description="Download everything — solve status, streak, quiz results — as a JSON file."
        match={match}
        query={query}
      >
        <a href="/api/progress/export" download>
          <Button variant="outline" size="sm">
            <Download size={13} /> Export JSON
          </Button>
        </a>
      </SettingRow>

      <SettingRow
        rowId="data:import"
        label="Import progress"
        description="Restore from an exported file. Merge combines it with what's here (recommended); Replace overwrites this device."
        match={match}
        query={query}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="import-mode"
                checked={mode === "merge"}
                onChange={() => {
                  setMode("merge");
                  setConfirmReplace(false);
                }}
              />
              Merge <span className="text-xs text-muted">(recommended)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="import-mode"
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
              />
              Replace <span className="text-xs text-rose-300">(overwrites this device)</span>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant={confirmReplace ? "primary" : "outline"}
              size="sm"
              onClick={onPickFile}
              disabled={busy}
            >
              <Upload size={13} />
              {busy
                ? "Importing…"
                : confirmReplace
                  ? "Click again to confirm replace"
                  : "Choose file…"}
            </Button>
            {confirmReplace && (
              <button
                className="text-xs text-muted hover:text-foreground"
                onClick={() => setConfirmReplace(false)}
              >
                Cancel
              </button>
            )}
          </div>

          {mode === "replace" && (
            <p className="text-xs text-amber-300/90">
              Note: if sync is on, other devices will still merge their own local data
              back in later — replace only overwrites this device and the sync remote.
            </p>
          )}

          {result && (
            <p className={result.ok ? "text-xs text-emerald-400" : "text-xs text-rose-300"}>
              {result.message}
            </p>
          )}

          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importFile(f);
            }}
          />
        </div>
      </SettingRow>
    </div>
  );
}
