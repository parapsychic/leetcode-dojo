// Striver's SDE Sheet — curated seed data.
// Each problem maps to a LeetCode slug where one exists; GFG-only problems use
// leetcodeSlug: null and rely on the curated statement fallback.

export type Difficulty = "Easy" | "Medium" | "Hard";

export interface SheetProblem {
  id: string;
  title: string;
  difficulty: Difficulty;
  /** LeetCode title slug for alfa-leetcode-api, or null if GFG-only. */
  leetcodeSlug: string | null;
  /** Where the canonical version of the problem lives. */
  source: "leetcode" | "gfg";
}

export interface SheetSection {
  id: string;
  title: string;
  topic: string;
  problems: SheetProblem[];
}

const p = (
  title: string,
  difficulty: Difficulty,
  leetcodeSlug: string | null,
): SheetProblem => ({
  id: slugify(title),
  title,
  difficulty,
  leetcodeSlug,
  source: leetcodeSlug ? "leetcode" : "gfg",
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const STRIVER_SHEET: SheetSection[] = [
  {
    id: "arrays-1",
    title: "Day 1: Arrays",
    topic: "Arrays",
    problems: [
      p("Set Matrix Zeroes", "Medium", "set-matrix-zeroes"),
      p("Pascal's Triangle", "Easy", "pascals-triangle"),
      p("Next Permutation", "Medium", "next-permutation"),
      p("Maximum Subarray (Kadane's Algorithm)", "Medium", "maximum-subarray"),
      p("Sort Colors (0s 1s 2s)", "Medium", "sort-colors"),
      p("Best Time to Buy and Sell Stock", "Easy", "best-time-to-buy-and-sell-stock"),
    ],
  },
  {
    id: "arrays-2",
    title: "Day 2: Arrays Part-II",
    topic: "Arrays",
    problems: [
      p("Rotate Image", "Medium", "rotate-image"),
      p("Merge Intervals", "Medium", "merge-intervals"),
      p("Merge Sorted Array", "Medium", "merge-sorted-array"),
      p("Find the Duplicate Number", "Medium", "find-the-duplicate-number"),
      p("Set Mismatch (Repeat and Missing)", "Easy", "set-mismatch"),
      p("Count Inversions", "Hard", null),
    ],
  },
  {
    id: "arrays-3",
    title: "Day 3: Arrays Part-III",
    topic: "Arrays",
    problems: [
      p("Search a 2D Matrix", "Medium", "search-a-2d-matrix"),
      p("Pow(x, n)", "Medium", "powx-n"),
      p("Majority Element", "Easy", "majority-element"),
      p("Majority Element II", "Medium", "majority-element-ii"),
      p("Unique Paths", "Medium", "unique-paths"),
      p("Reverse Pairs", "Hard", "reverse-pairs"),
    ],
  },
  {
    id: "arrays-4",
    title: "Day 4: Arrays Part-IV",
    topic: "Arrays / Hashing",
    problems: [
      p("Two Sum", "Easy", "two-sum"),
      p("4Sum", "Medium", "4sum"),
      p("Longest Consecutive Sequence", "Medium", "longest-consecutive-sequence"),
      p("Largest Subarray with 0 Sum", "Medium", null),
      p("Count Subarrays with Given XOR", "Hard", null),
      p("Longest Substring Without Repeating Characters", "Medium", "longest-substring-without-repeating-characters"),
    ],
  },
  {
    id: "linked-list-1",
    title: "Day 5: Linked List",
    topic: "Linked List",
    problems: [
      p("Reverse Linked List", "Easy", "reverse-linked-list"),
      p("Middle of the Linked List", "Easy", "middle-of-the-linked-list"),
      p("Merge Two Sorted Lists", "Easy", "merge-two-sorted-lists"),
      p("Remove Nth Node From End of List", "Medium", "remove-nth-node-from-end-of-list"),
      p("Add Two Numbers", "Medium", "add-two-numbers"),
      p("Delete Node in a Linked List", "Medium", "delete-node-in-a-linked-list"),
    ],
  },
  {
    id: "linked-list-2",
    title: "Day 6: Linked List Part-II",
    topic: "Linked List",
    problems: [
      p("Intersection of Two Linked Lists", "Easy", "intersection-of-two-linked-lists"),
      p("Linked List Cycle", "Easy", "linked-list-cycle"),
      p("Reverse Nodes in k-Group", "Hard", "reverse-nodes-in-k-group"),
      p("Palindrome Linked List", "Easy", "palindrome-linked-list"),
      p("Linked List Cycle II (Start of Loop)", "Medium", "linked-list-cycle-ii"),
      p("Flattening a Linked List", "Hard", null),
    ],
  },
  {
    id: "linked-list-arrays",
    title: "Day 7: Linked List and Arrays",
    topic: "Linked List / Two Pointers",
    problems: [
      p("Rotate List", "Medium", "rotate-list"),
      p("Copy List with Random Pointer", "Medium", "copy-list-with-random-pointer"),
      p("3Sum", "Medium", "3sum"),
      p("Trapping Rain Water", "Hard", "trapping-rain-water"),
      p("Remove Duplicates from Sorted Array", "Easy", "remove-duplicates-from-sorted-array"),
      p("Max Consecutive Ones", "Easy", "max-consecutive-ones"),
    ],
  },
  {
    id: "greedy",
    title: "Day 8: Greedy Algorithm",
    topic: "Greedy",
    problems: [
      p("N Meetings in One Room", "Easy", null),
      p("Minimum Number of Platforms", "Medium", null),
      p("Job Sequencing Problem", "Medium", null),
      p("Fractional Knapsack", "Medium", null),
      p("Minimum Coins (Greedy)", "Easy", null),
      p("Activity Selection", "Easy", null),
    ],
  },
  {
    id: "recursion",
    title: "Day 9: Recursion",
    topic: "Recursion",
    problems: [
      p("Subset Sums", "Medium", null),
      p("Subsets II", "Medium", "subsets-ii"),
      p("Combination Sum", "Medium", "combination-sum"),
      p("Combination Sum II", "Medium", "combination-sum-ii"),
      p("Palindrome Partitioning", "Medium", "palindrome-partitioning"),
      p("Permutation Sequence", "Hard", "permutation-sequence"),
    ],
  },
  {
    id: "backtracking",
    title: "Day 10: Recursion and Backtracking",
    topic: "Backtracking",
    problems: [
      p("Permutations", "Medium", "permutations"),
      p("N-Queens", "Hard", "n-queens"),
      p("Sudoku Solver", "Hard", "sudoku-solver"),
      p("M-Coloring Problem", "Medium", null),
      p("Rat in a Maze", "Medium", null),
      p("Word Break", "Medium", "word-break"),
    ],
  },
  {
    id: "binary-search",
    title: "Day 11: Binary Search",
    topic: "Binary Search",
    problems: [
      p("Nth Root of a Number", "Medium", null),
      p("Matrix Median", "Hard", null),
      p("Single Element in a Sorted Array", "Medium", "single-element-in-a-sorted-array"),
      p("Search in Rotated Sorted Array", "Medium", "search-in-rotated-sorted-array"),
      p("Median of Two Sorted Arrays", "Hard", "median-of-two-sorted-arrays"),
      p("K-th Element of Two Sorted Arrays", "Medium", null),
      p("Allocate Minimum Number of Pages", "Hard", null),
      p("Aggressive Cows", "Hard", null),
    ],
  },
  {
    id: "heaps",
    title: "Day 12: Heaps",
    topic: "Heaps",
    problems: [
      p("Kth Largest Element in an Array", "Medium", "kth-largest-element-in-an-array"),
      p("Maximum Sum Combination", "Hard", null),
      p("Find Median from Data Stream", "Hard", "find-median-from-data-stream"),
      p("Merge k Sorted Lists", "Hard", "merge-k-sorted-lists"),
      p("Top K Frequent Elements", "Medium", "top-k-frequent-elements"),
      p("Kth Largest Element in a Stream", "Easy", "kth-largest-element-in-a-stream"),
    ],
  },
  {
    id: "stack-queue-1",
    title: "Day 13: Stack and Queue",
    topic: "Stack & Queue",
    problems: [
      p("Implement Stack using Queues", "Easy", "implement-stack-using-queues"),
      p("Implement Queue using Stacks", "Easy", "implement-queue-using-stacks"),
      p("Valid Parentheses", "Easy", "valid-parentheses"),
      p("Next Greater Element I", "Easy", "next-greater-element-i"),
      p("Sort a Stack", "Easy", null),
      p("Min Stack", "Medium", "min-stack"),
    ],
  },
  {
    id: "stack-queue-2",
    title: "Day 14: Stack and Queue Part-II",
    topic: "Stack & Queue",
    problems: [
      p("LRU Cache", "Medium", "lru-cache"),
      p("LFU Cache", "Hard", "lfu-cache"),
      p("Largest Rectangle in Histogram", "Hard", "largest-rectangle-in-histogram"),
      p("Sliding Window Maximum", "Hard", "sliding-window-maximum"),
      p("Rotting Oranges", "Medium", "rotting-oranges"),
      p("Online Stock Span", "Medium", "online-stock-span"),
      p("Find the Celebrity", "Medium", "find-the-celebrity"),
    ],
  },
  {
    id: "strings-1",
    title: "Day 15: Strings",
    topic: "Strings",
    problems: [
      p("Reverse Words in a String", "Medium", "reverse-words-in-a-string"),
      p("Longest Palindromic Substring", "Medium", "longest-palindromic-substring"),
      p("Roman to Integer", "Easy", "roman-to-integer"),
      p("String to Integer (atoi)", "Medium", "string-to-integer-atoi"),
      p("Longest Common Prefix", "Easy", "longest-common-prefix"),
      p("Implement strStr (Rabin-Karp)", "Easy", "implement-strstr"),
    ],
  },
  {
    id: "strings-2",
    title: "Day 16: Strings Part-II",
    topic: "Strings",
    problems: [
      p("Shortest Palindrome (KMP)", "Hard", "shortest-palindrome"),
      p("Valid Anagram", "Easy", "valid-anagram"),
      p("Count and Say", "Medium", "count-and-say"),
      p("Compare Version Numbers", "Medium", "compare-version-numbers"),
      p("Repeated String Match (Z-Function)", "Medium", "repeated-string-match"),
    ],
  },
  {
    id: "binary-tree-1",
    title: "Day 17: Binary Tree",
    topic: "Binary Trees",
    problems: [
      p("Binary Tree Inorder Traversal", "Easy", "binary-tree-inorder-traversal"),
      p("Binary Tree Preorder Traversal", "Easy", "binary-tree-preorder-traversal"),
      p("Binary Tree Postorder Traversal", "Easy", "binary-tree-postorder-traversal"),
      p("Left View of Binary Tree", "Easy", null),
      p("Top View of Binary Tree", "Medium", null),
      p("Bottom View of Binary Tree", "Medium", null),
      p("Vertical Order Traversal", "Hard", "vertical-order-traversal-of-a-binary-tree"),
      p("Maximum Width of Binary Tree", "Medium", "maximum-width-of-binary-tree"),
    ],
  },
  {
    id: "binary-tree-2",
    title: "Day 18: Binary Tree Part-II",
    topic: "Binary Trees",
    problems: [
      p("Binary Tree Level Order Traversal", "Medium", "binary-tree-level-order-traversal"),
      p("Maximum Depth of Binary Tree", "Easy", "maximum-depth-of-binary-tree"),
      p("Diameter of Binary Tree", "Easy", "diameter-of-binary-tree"),
      p("Balanced Binary Tree", "Easy", "balanced-binary-tree"),
      p("Lowest Common Ancestor of a Binary Tree", "Medium", "lowest-common-ancestor-of-a-binary-tree"),
      p("Same Tree", "Easy", "same-tree"),
      p("Binary Tree Zigzag Level Order Traversal", "Medium", "binary-tree-zigzag-level-order-traversal"),
      p("Boundary Traversal of Binary Tree", "Medium", null),
    ],
  },
  {
    id: "binary-tree-3",
    title: "Day 19: Binary Tree Part-III",
    topic: "Binary Trees",
    problems: [
      p("Binary Tree Maximum Path Sum", "Hard", "binary-tree-maximum-path-sum"),
      p("Construct Binary Tree from Preorder and Inorder", "Medium", "construct-binary-tree-from-preorder-and-inorder-traversal"),
      p("Construct Binary Tree from Inorder and Postorder", "Medium", "construct-binary-tree-from-inorder-and-postorder-traversal"),
      p("Symmetric Tree", "Easy", "symmetric-tree"),
      p("Flatten Binary Tree to Linked List", "Medium", "flatten-binary-tree-to-linked-list"),
      p("Invert Binary Tree", "Easy", "invert-binary-tree"),
    ],
  },
  {
    id: "bst-1",
    title: "Day 20: Binary Search Tree",
    topic: "Binary Search Trees",
    problems: [
      p("Populating Next Right Pointers in Each Node", "Medium", "populating-next-right-pointers-in-each-node"),
      p("Search in a Binary Search Tree", "Easy", "search-in-a-binary-search-tree"),
      p("Convert Sorted Array to BST", "Easy", "convert-sorted-array-to-binary-search-tree"),
      p("Construct BST from Preorder Traversal", "Medium", "construct-binary-search-tree-from-preorder-traversal"),
      p("Validate Binary Search Tree", "Medium", "validate-binary-search-tree"),
      p("Lowest Common Ancestor of a BST", "Medium", "lowest-common-ancestor-of-a-binary-search-tree"),
    ],
  },
  {
    id: "bst-2",
    title: "Day 21: Binary Search Tree Part-II",
    topic: "Binary Search Trees",
    problems: [
      p("Kth Smallest Element in a BST", "Medium", "kth-smallest-element-in-a-bst"),
      p("Two Sum IV - Input is a BST", "Easy", "two-sum-iv-input-is-a-bst"),
      p("Binary Search Tree Iterator", "Medium", "binary-search-tree-iterator"),
      p("Largest BST in a Binary Tree", "Hard", null),
      p("Serialize and Deserialize Binary Tree", "Hard", "serialize-and-deserialize-binary-tree"),
      p("Inorder Successor in BST", "Medium", null),
    ],
  },
  {
    id: "binary-tree-misc",
    title: "Day 22: Binary Trees [Miscellaneous]",
    topic: "Binary Trees",
    problems: [
      p("Binary Tree to Doubly Linked List", "Hard", null),
      p("Kth Largest Element in a Stream", "Easy", "kth-largest-element-in-a-stream"),
      p("Distinct Numbers in Window", "Medium", null),
      p("Flood Fill", "Easy", "flood-fill"),
      p("Count Distinct Elements in Every Window", "Medium", null),
    ],
  },
  {
    id: "graph-1",
    title: "Day 23: Graph",
    topic: "Graphs",
    problems: [
      p("Clone Graph", "Medium", "clone-graph"),
      p("Number of Islands", "Medium", "number-of-islands"),
      p("Is Graph Bipartite?", "Medium", "is-graph-bipartite"),
      p("Course Schedule (Cycle in Directed Graph)", "Medium", "course-schedule"),
      p("Topological Sort", "Medium", null),
      p("Detect Cycle in Undirected Graph", "Medium", null),
    ],
  },
  {
    id: "graph-2",
    title: "Day 24: Graph Part-II",
    topic: "Graphs",
    problems: [
      p("Strongly Connected Components (Kosaraju)", "Hard", null),
      p("Dijkstra's Algorithm", "Medium", null),
      p("Bellman-Ford Algorithm", "Medium", null),
      p("Floyd Warshall Algorithm", "Medium", null),
      p("Minimum Spanning Tree (Prim's)", "Medium", null),
      p("Minimum Spanning Tree (Kruskal's)", "Medium", null),
    ],
  },
  {
    id: "dp-1",
    title: "Day 25: Dynamic Programming",
    topic: "Dynamic Programming",
    problems: [
      p("Maximum Product Subarray", "Medium", "maximum-product-subarray"),
      p("Longest Increasing Subsequence", "Medium", "longest-increasing-subsequence"),
      p("Longest Common Subsequence", "Medium", "longest-common-subsequence"),
      p("0-1 Knapsack", "Medium", null),
      p("Edit Distance", "Medium", "edit-distance"),
      p("Matrix Chain Multiplication", "Hard", null),
    ],
  },
  {
    id: "dp-2",
    title: "Day 26: Dynamic Programming Part-II",
    topic: "Dynamic Programming",
    problems: [
      p("Minimum Path Sum", "Medium", "minimum-path-sum"),
      p("Coin Change", "Medium", "coin-change"),
      p("Partition Equal Subset Sum", "Medium", "partition-equal-subset-sum"),
      p("Super Egg Drop", "Hard", "super-egg-drop"),
      p("Palindrome Partitioning II", "Hard", "palindrome-partitioning-ii"),
      p("Maximum Profit in Job Scheduling", "Hard", "maximum-profit-in-job-scheduling"),
    ],
  },
  {
    id: "trie",
    title: "Day 27: Trie",
    topic: "Trie",
    problems: [
      p("Implement Trie (Prefix Tree)", "Medium", "implement-trie-prefix-tree"),
      p("Implement Trie II (Count Prefixes)", "Medium", null),
      p("Longest Word With All Prefixes", "Medium", null),
      p("Maximum XOR of Two Numbers in an Array", "Medium", "maximum-xor-of-two-numbers-in-an-array"),
      p("Maximum XOR With an Element From Array", "Hard", "maximum-xor-with-an-element-from-array"),
      p("Subsets (Power Set)", "Medium", "subsets"),
    ],
  },
];

// ---- Derived helpers ----

export const ALL_PROBLEMS: (SheetProblem & { sectionId: string; topic: string })[] =
  STRIVER_SHEET.flatMap((s) =>
    s.problems.map((pr) => ({ ...pr, sectionId: s.id, topic: s.topic })),
  );

export function getProblemById(id: string) {
  return ALL_PROBLEMS.find((pr) => pr.id === id);
}

export function getSectionById(id: string) {
  return STRIVER_SHEET.find((s) => s.id === id);
}

export const TOPICS: string[] = Array.from(
  new Set(STRIVER_SHEET.map((s) => s.topic)),
);

export const TOTAL_PROBLEMS = ALL_PROBLEMS.length;
