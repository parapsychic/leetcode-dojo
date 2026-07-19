import path from "path";
import os from "os";

// Single source of truth for where the app stores per-user data on disk.
// In packaged Electron, main.js sets EFDX_DATA_DIR to app.getPath('userData').
// In dev, fall back to a project-local .data dir; finally to the OS tmp dir.
export function dataDir(): string {
  if (process.env.EFDX_DATA_DIR) return process.env.EFDX_DATA_DIR;
  if (process.env.NODE_ENV !== "production") {
    return path.join(process.cwd(), ".data");
  }
  return path.join(os.tmpdir(), "leetcode-dojo");
}
