// Tiny dependency-free line diff. Produces a unified-style block ("+"/"-"/" ")
// so the coach can see exactly what the learner changed since its last message
// instead of re-reading the whole file blind. Good enough for editor-sized code;
// not a full Myers implementation.

/** Longest-common-subsequence table over lines (classic DP). */
function lcsLengths(a: string[], b: string[]): number[][] {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  return dp;
}

/**
 * Unified line diff of `oldStr` → `newStr`. Returns "" when they're identical.
 * Unchanged lines are prefixed "  ", removed "- ", added "+ ".
 */
export function lineDiff(oldStr: string, newStr: string): string {
  const a = oldStr.replace(/\r\n/g, "\n").split("\n");
  const b = newStr.replace(/\r\n/g, "\n").split("\n");
  if (oldStr === newStr) return "";

  const dp = lcsLengths(a, b);
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push("  " + a[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push("- " + a[i]);
      i++;
    } else {
      out.push("+ " + b[j]);
      j++;
    }
  }
  while (i < a.length) out.push("- " + a[i++]);
  while (j < b.length) out.push("+ " + b[j++]);
  return out.join("\n");
}
