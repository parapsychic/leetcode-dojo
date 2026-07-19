// Folder-mirror backend (the Syncthing option — works with any folder syncer).
// The app keeps progress.sync.json inside a user-chosen folder; Syncthing moves
// the folder between devices, and the field-level merge reconciles both sides.

import { constants, promises as fs } from "fs";
import path from "path";
import type { ProgressData } from "@/lib/store/progress";
import { parseProgressDoc } from "../schema";
import { SyncError, type SyncBackend } from "../types";

export const SYNC_FILE_NAME = "progress.sync.json";

export function folderBackend(folderPath: string): SyncBackend {
  const file = path.join(folderPath, SYNC_FILE_NAME);
  return {
    id: "folder",
    label: "Syncthing folder",

    async pull(): Promise<ProgressData | null> {
      let raw: string;
      try {
        raw = await fs.readFile(file, "utf8");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw new SyncError(
          `Couldn't read ${file}: ${err instanceof Error ? err.message : String(err)}`,
          "other",
          "folder",
        );
      }
      const doc = parseProgressDoc(raw); // throws SyncError("other") when invalid
      return doc;
    },

    async push(data: ProgressData): Promise<void> {
      try {
        await fs.mkdir(folderPath, { recursive: true });
        // Atomic tmp+rename, same as the local store — Syncthing never observes
        // a half-written file.
        const tmp = `${file}.${process.pid}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
        await fs.rename(tmp, file);
      } catch (err) {
        throw new SyncError(
          `Couldn't write ${file}: ${err instanceof Error ? err.message : String(err)}`,
          "other",
          "folder",
        );
      }
    },

    async healthCheck() {
      if (!path.isAbsolute(folderPath)) {
        return { ok: false, error: "Folder path must be absolute." };
      }
      try {
        await fs.mkdir(folderPath, { recursive: true });
        await fs.access(folderPath, constants.W_OK);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: `Folder isn't writable: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  };
}
