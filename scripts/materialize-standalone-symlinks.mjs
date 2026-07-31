// Replace symlinks in the Next standalone output with the real files.
//
// `next build` emits at least one symlink into .next/standalone that points at
// an absolute path in the *build machine's* node_modules, e.g.
//
//   .next/standalone/.next/node_modules/@anthropic-ai/claude-agent-sdk-<hash>
//     -> /home/runner/work/leetcode-dojo/leetcode-dojo/node_modules/@anthropic-ai/claude-agent-sdk
//
// electron-builder copies that link verbatim into the app, which breaks two
// ways. It dangles on every user's machine, since nothing lives at the build
// machine's path. And rpmbuild refuses to package it at all: the entry never
// materialises in the buildroot, so `%files` fails with
// "error: File not found: .../@anthropic-ai/claude-agent-sdk-<hash>" and the
// whole Linux build dies before the .rpm and .pacman targets are reached.
// dpkg is happy to ship the dangling link, which is why only rpm complained.
//
// Runs between `next build` and `electron-builder`, so every target — deb, rpm,
// pacman, AppImage, nsis, dmg — packages a self-contained tree.

import { existsSync, lstatSync, readdirSync, readlinkSync, rmSync, cpSync } from "node:fs";
import { dirname, join, resolve, relative, isAbsolute } from "node:path";

const root = resolve(process.cwd(), ".next/standalone");

if (!existsSync(root)) {
  console.error(`[standalone-symlinks] ${root} not found — run \`next build\` first`);
  process.exit(1);
}

/** Collect symlinks depth-first without ever following one. */
function findSymlinks(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) found.push(path);
    else if (entry.isDirectory()) findSymlinks(path, found);
  }
  return found;
}

/** True when `parent` contains `child` (or they are the same path). */
function contains(parent, child) {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

const links = findSymlinks(root);
let materialized = 0;
let removed = 0;

for (const link of links) {
  const target = resolve(dirname(link), readlinkSync(link));

  if (!existsSync(target)) {
    rmSync(link, { recursive: true, force: true });
    removed++;
    console.log(`[standalone-symlinks] removed dangling ${relative(root, link)} -> ${target}`);
    continue;
  }

  // Copying a link that lives inside its own target would recurse forever.
  if (contains(target, link)) {
    rmSync(link, { recursive: true, force: true });
    removed++;
    console.log(`[standalone-symlinks] removed self-referential ${relative(root, link)}`);
    continue;
  }

  const isDir = lstatSync(target).isDirectory();
  rmSync(link, { recursive: true, force: true });
  cpSync(target, link, { recursive: isDir, dereference: true });
  materialized++;
  console.log(`[standalone-symlinks] materialized ${relative(root, link)} <- ${target}`);
}

console.log(
  `[standalone-symlinks] ${links.length} symlink(s): ${materialized} materialized, ${removed} removed`
);
