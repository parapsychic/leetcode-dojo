// Enforces conventional commit subjects. Two callers, one rule set:
//   .husky/commit-msg               → verify-commit-msg.mjs <commit-msg-file>
//   .github/workflows/commitlint.yml → git log ... | verify-commit-msg.mjs --stdin
// Allowed:   feat: add X | fix(sync): repair Y | feat(ai)!: breaking Z
// The (module) scope is optional; "!" marks a breaking change (bumps major).
// The release workflow (.github/workflows/release.yml) parses these subjects
// to pick the version bump and to group the release notes.

import { readFileSync } from "node:fs";

// Commits git (or the release bot) writes itself pass through untouched.
const generated = /^(Merge |Revert |fixup!|squash!|chore\(release\):)/;

// Scopes allow mixed case so component names read naturally: fix(SolveView): ...
const conventional = /^(feat|fix)(\([A-Za-z0-9._-]+\))?!?: .+/;

const ok = (subject) =>
  generated.test(subject) || conventional.test(subject);

const help = `
  Subjects must look like one of:

    feat: add spaced-repetition queue
    feat(sheet): add day-27 problems
    fix: stop streak double-counting
    fix(sync): retry expired refresh tokens
    feat(ai)!: drop the legacy prompt format   (breaking change)

  i.e.  (feat|fix)(optional-module): description
`;

const arg = process.argv[2];
if (!arg) {
  console.error("usage: verify-commit-msg.mjs <commit-msg-file> | --stdin");
  process.exit(1);
}

if (arg === "--stdin") {
  // One subject per line (git log --pretty=format:'%s'); report every offender.
  const subjects = readFileSync(0, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const bad = subjects.filter((s) => !ok(s));
  if (bad.length === 0) {
    console.log(`✓ ${subjects.length} commit subject(s) OK`);
    process.exit(0);
  }
  console.error(`✖ ${bad.length} commit subject(s) rejected:\n`);
  for (const s of bad) console.error(`    ${s}`);
  console.error(help);
  process.exit(1);
}

const subject = readFileSync(arg, "utf8").split(/\r?\n/)[0].trim();
if (ok(subject)) process.exit(0);

console.error(`\n✖ Commit message rejected:\n\n    ${subject}\n${help}`);
process.exit(1);
