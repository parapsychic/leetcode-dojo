// Canonical GeeksforGeeks practice-page slugs for the GFG-only ("non-LeetCode")
// sheet entries. These problems have no LeetCode slug, so the solve view links
// here instead. Slugs were verified against geeksforgeeks.org/problems/<slug>/1.
//
// Keys are the problem TITLES (not ids). We derive the id-keyed map below with
// the exact same slugify the sheet uses, so a title change stays in sync and a
// typo surfaces as a missing link (→ search fallback) rather than a silent 404.

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// title -> practice link. A bare value is a GFG slug (→ geeksforgeeks.org/
// problems/<slug>/1); a full `https://…` URL is used verbatim. We fall back to
// a takeUforward tutorial for the few problems GFG has no exact page for.
const BY_TITLE: Record<string, string> = {
  "Count Inversions": "inversion-of-array-1587115620",
  "Largest Subarray with 0 Sum": "largest-subarray-with-0-sum",
  "Longest Subarray with Sum K": "longest-sub-array-with-sum-k0809",
  "Count Subarrays with Given XOR": "count-subarray-with-given-xor",
  "Flattening a Linked List": "flattening-a-linked-list",
  "N Meetings in One Room": "n-meetings-in-one-room-1587115620",
  "Minimum Number of Platforms": "minimum-platforms-1587115620",
  "Job Sequencing Problem": "job-sequencing-problem-1587115620",
  "Fractional Knapsack": "fractional-knapsack-1587115620",
  // GFG has no clean greedy-coins page → takeUforward tutorial.
  "Minimum Coins (Greedy)": "https://takeuforward.org/data-structure/find-minimum-number-of-coins",
  "Activity Selection": "n-meetings-in-one-room-1587115620",
  "Subset Sums": "subset-sums2234",
  "M-Coloring Problem": "m-coloring-problem-1587115620",
  "Rat in a Maze": "rat-in-a-maze-problem",
  "Nth Root of a Number": "find-nth-root-of-m5843",
  "Matrix Median": "median-in-a-row-wise-sorted-matrix1527",
  "K-th Element of Two Sorted Arrays": "k-th-element-of-two-sorted-array1317",
  "Allocate Minimum Number of Pages": "allocate-minimum-number-of-pages0937",
  "Aggressive Cows": "aggressive-cows",
  "Maximum Sum Combination": "maximum-sum-combination",
  "Sort a Stack": "sort-a-stack",
  "Left View of Binary Tree": "left-view-of-binary-tree",
  "Top View of Binary Tree": "top-view-of-binary-tree",
  "Bottom View of Binary Tree": "bottom-view-of-binary-tree",
  "Boundary Traversal of Binary Tree": "boundary-traversal-of-binary-tree",
  "Largest BST in a Binary Tree": "largest-bst",
  "Inorder Successor in BST": "inorder-successor-in-bst",
  "Binary Tree to Doubly Linked List": "binary-tree-to-dll",
  "Distinct Numbers in Window": "count-distinct-elements-in-every-window",
  "Count Distinct Elements in Every Window": "count-distinct-elements-in-every-window",
  "Topological Sort": "topological-sort",
  "Detect Cycle in Undirected Graph": "detect-cycle-in-an-undirected-graph",
  "Strongly Connected Components (Kosaraju)": "strongly-connected-components-kosarajus-algo",
  "Dijkstra's Algorithm": "implementing-dijkstra-set-1-adjacency-matrix",
  "Bellman-Ford Algorithm": "distance-from-the-source-bellman-ford-algorithm",
  "Floyd Warshall Algorithm": "implementing-floyd-warshall2042",
  "Minimum Spanning Tree (Prim's)": "minimum-spanning-tree",
  "Minimum Spanning Tree (Kruskal's)": "minimum-spanning-tree-kruskals-algorithm",
  "0-1 Knapsack": "0-1-knapsack-problem0945",
  "Matrix Chain Multiplication": "matrix-chain-multiplication0303",
  // GFG has no "count prefixes" Trie page → takeUforward tutorial.
  "Implement Trie II (Count Prefixes)": "https://takeuforward.org/data-structure/implement-trie-ii",
  "Longest Word With All Prefixes": "longest-valid-word-with-all-prefixes",
};

// problem id -> GFG practice slug (derived so it matches the sheet's ids exactly)
export const GFG_SLUGS: Record<string, string> = Object.fromEntries(
  Object.entries(BY_TITLE).map(([title, slug]) => [slugify(title), slug]),
);

/**
 * A link to the problem on GeeksforGeeks. Returns the canonical practice page
 * when we have a verified slug for `id`; otherwise falls back to a GFG search on
 * `title` so the link still lands somewhere useful. Returns null if given
 * neither (shouldn't happen for GFG-only problems).
 */
export function getGfgUrl(id: string, title: string): string | null {
  const entry = GFG_SLUGS[id];
  if (entry)
    return entry.startsWith("http")
      ? entry
      : `https://www.geeksforgeeks.org/problems/${entry}/1`;
  if (title)
    return `https://www.geeksforgeeks.org/search/?gq=${encodeURIComponent(title)}`;
  return null;
}

/**
 * Short label for a practice link, based on its host — so a takeUforward
 * fallback link isn't mislabeled "GFG". Used for the link text in the UI.
 */
export function practiceLinkLabel(url: string): string {
  if (url.includes("takeuforward.org")) return "TUF";
  if (url.includes("geeksforgeeks.org")) return "GFG";
  return "Problem";
}
