// Curated problem statements + samples for the GFG-only ("non-LeetCode") sheet
// entries. These have no alfa-leetcode-api source, so we hard-code the question
// and worked examples here. The text is rendered as Markdown in the solve view's
// statement panel and is ALSO fed to Claude as `problemStatement`, so the stub,
// hints, coach, and review all reason about the real problem instead of just the
// title.
//
// Keys are the sheet's problem ids. We derive them from the title with the exact
// same slugify the sheet uses, so a title change stays in sync and typos surface
// as a missing statement rather than a silent mismatch.

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// title -> markdown statement (with examples + constraints)
const BY_TITLE: Record<string, string> = {
  "Count Inversions": `Given an array of integers \`arr\`, count the number of **inversions**. A pair \`(i, j)\` forms an inversion when \`i < j\` and \`arr[i] > arr[j]\` — i.e. the number of pairs that are out of their sorted order.

**Example 1**
\`\`\`
Input:  arr = [2, 4, 1, 3, 5]
Output: 3
Explanation: The inversions are (2,1), (4,1) and (4,3).
\`\`\`

**Example 2**
\`\`\`
Input:  arr = [5, 4, 3, 2, 1]
Output: 10
Explanation: Every pair is out of order.
\`\`\`

**Constraints**
- \`1 <= arr.length <= 1e5\`
- \`1 <= arr[i] <= 1e9\`
- Expected time: \`O(n log n)\` (modified merge sort).`,

  "Largest Subarray with 0 Sum": `Given an array \`arr\` containing positive and negative integers, find the length of the **longest contiguous subarray whose elements sum to 0**.

**Example 1**
\`\`\`
Input:  arr = [15, -2, 2, -8, 1, 7, 10, 23]
Output: 5
Explanation: The subarray [-2, 2, -8, 1, 7] sums to 0.
\`\`\`

**Example 2**
\`\`\`
Input:  arr = [1, 2, 3]
Output: 0
Explanation: No subarray sums to 0.
\`\`\`

**Constraints**
- \`1 <= arr.length <= 1e5\`
- \`-1000 <= arr[i] <= 1000\`
- Expected time: \`O(n)\` using a prefix-sum hash map.`,

  "Count Subarrays with Given XOR": `Given an array of integers \`arr\` and an integer \`k\`, count the number of **contiguous subarrays** whose elements XOR to exactly \`k\`.

**Example 1**
\`\`\`
Input:  arr = [4, 2, 2, 6, 4], k = 6
Output: 4
Explanation: Subarrays with XOR 6 are [4,2], [4,2,2,6,4], [2,2,6] and [6].
\`\`\`

**Example 2**
\`\`\`
Input:  arr = [5, 6, 7, 8, 9], k = 5
Output: 2
Explanation: [5] and [5,6,7,8,9].
\`\`\`

**Constraints**
- \`1 <= arr.length <= 1e5\`
- \`0 <= arr[i], k <= 1e5\`
- Expected time: \`O(n)\` using a prefix-XOR hash map.`,

  "Flattening a Linked List": `You are given a linked list where every node has two pointers: \`next\` (to the next node in the top-level list) and \`bottom\` (to a sorted sub-list). Each sub-list is itself sorted by \`bottom\`. **Flatten** the list into a single sorted list connected only by \`bottom\` pointers.

**Example**
\`\`\`
Input:
5 -> 10 -> 19 -> 28
|    |     |     |
7    20    22    35
|          |     |
8          50    40
|                |
30               45

Output:
5 -> 7 -> 8 -> 10 -> 19 -> 20 -> 22 -> 28 -> 30 -> 35 -> 40 -> 45 -> 50
\`\`\`

**Constraints**
- \`1 <= total nodes <= 1e5\`
- Merge the sorted sub-lists (like merge-k-sorted-lists). Expected time \`O(N log k)\` or \`O(N)\` with repeated pairwise merges.`,

  "N Meetings in One Room": `There is **one meeting room**. Given \`n\` meetings with start times \`start[i]\` and end times \`end[i]\`, find the **maximum number of meetings** that can be held in the room such that only one meeting happens at a time (a meeting that ends at time \`t\` and one that starts at \`t\` cannot both be selected — the next must start strictly after).

**Example 1**
\`\`\`
Input:  start = [1, 3, 0, 5, 8, 5], end = [2, 4, 6, 7, 9, 9]
Output: 4
Explanation: Pick meetings (1,2), (3,4), (5,7), (8,9).
\`\`\`

**Example 2**
\`\`\`
Input:  start = [10, 12, 20], end = [20, 25, 30]
Output: 1
\`\`\`

**Constraints**
- \`1 <= n <= 1e5\`
- Greedy: sort by end time. Expected time \`O(n log n)\`.`,

  "Minimum Number of Platforms": `Given the arrival and departure times of trains at a railway station (\`arr[i]\` and \`dep[i]\`), find the **minimum number of platforms** required so that no train waits. If a train arrives at the same time another departs, they still need separate platforms.

**Example 1**
\`\`\`
Input:  arr = [900, 940, 950, 1100, 1500, 1800]
        dep = [910, 1200, 1120, 1130, 1900, 2000]
Output: 3
\`\`\`

**Example 2**
\`\`\`
Input:  arr = [900, 1100, 1235], dep = [1000, 1200, 1240]
Output: 1
\`\`\`

**Constraints**
- \`1 <= n <= 1e5\`
- Sort arrivals and departures; sweep with two pointers. Expected time \`O(n log n)\`.`,

  "Job Sequencing Problem": `Given \`n\` jobs where each job has a **deadline** and a **profit**, and every job takes exactly one unit of time, schedule jobs on a single machine to **maximize total profit**. A job earns its profit only if completed on or before its deadline. Return the number of jobs done and the maximum profit.

**Example 1**
\`\`\`
Input:  jobs = [(id=1, deadline=4, profit=20),
                (id=2, deadline=1, profit=10),
                (id=3, deadline=1, profit=40),
                (id=4, deadline=1, profit=30)]
Output: 2 jobs, profit 60
Explanation: Do job 3 (t=1) and job 1 (t=2..4).
\`\`\`

**Example 2**
\`\`\`
Input:  jobs = [(1,2,100), (2,1,19), (3,2,27), (4,1,25), (5,1,15)]
Output: 2 jobs, profit 127
\`\`\`

**Constraints**
- \`1 <= n <= 1e5\`
- Greedy: sort by profit desc, place each job in the latest free slot before its deadline (DSU makes it fast).`,

  "Fractional Knapsack": `Given \`n\` items each with a \`value[i]\` and \`weight[i]\`, and a knapsack of capacity \`W\`, maximize the total value you can carry. Unlike 0/1 knapsack, you **may take fractions** of an item.

**Example 1**
\`\`\`
Input:  W = 50, items = [(value=60, weight=10),
                         (value=100, weight=20),
                         (value=120, weight=30)]
Output: 240.00
Explanation: Take items 1 & 2 fully (160, 30kg), then 2/3 of item 3 (+80).
\`\`\`

**Constraints**
- \`1 <= n <= 1e5\`
- \`1 <= W, value[i], weight[i] <= 1e5\`
- Greedy: sort by value/weight ratio desc. Expected time \`O(n log n)\`.`,

  "Minimum Coins (Greedy)": `Given an infinite supply of Indian currency denominations \`[1, 2, 5, 10, 20, 50, 100, 200, 500, 2000]\`, find the **minimum number of coins/notes** that sum to a target value \`V\`. Return the count (and optionally the coins used).

**Example 1**
\`\`\`
Input:  V = 70
Output: 2
Explanation: 50 + 20.
\`\`\`

**Example 2**
\`\`\`
Input:  V = 121
Output: 3
Explanation: 100 + 20 + 1.
\`\`\`

**Constraints**
- \`1 <= V <= 1e9\`
- Greedy works because this denomination set is canonical: always pick the largest note <= remaining value.`,

  "Activity Selection": `Given \`n\` activities with start times \`start[i]\` and finish times \`finish[i]\`, select the **maximum number of non-overlapping activities** that a single person can perform (only one activity at a time).

**Example 1**
\`\`\`
Input:  start  = [1, 3, 0, 5, 8, 5]
        finish = [2, 4, 6, 7, 9, 9]
Output: 4
Explanation: (1,2), (3,4), (5,7), (8,9).
\`\`\`

**Example 2**
\`\`\`
Input:  start = [10, 12, 20], finish = [20, 25, 30]
Output: 1
\`\`\`

**Constraints**
- \`1 <= n <= 1e5\`
- Greedy: sort by finish time, keep an activity if it starts after the last chosen one finishes.`,

  "Subset Sums": `Given a list \`arr\` of \`n\` integers, return a list of the **sums of all its subsets** (the power set), in non-decreasing order. There are \`2^n\` subsets including the empty set (sum 0).

**Example 1**
\`\`\`
Input:  arr = [2, 3]
Output: [0, 2, 3, 5]
Explanation: subsets {}, {2}, {3}, {2,3}.
\`\`\`

**Example 2**
\`\`\`
Input:  arr = [5, 2, 1]
Output: [0, 1, 2, 3, 5, 6, 7, 8]
\`\`\`

**Constraints**
- \`1 <= n <= 15\`
- Recursion: at each index either include or exclude the element. \`O(2^n)\`.`,

  "M-Coloring Problem": `Given an undirected graph with \`V\` vertices (as an adjacency matrix / list) and an integer \`m\`, determine whether the graph can be **colored with at most \`m\` colors** such that no two adjacent vertices share the same color. Return \`true\`/\`false\`.

**Example 1**
\`\`\`
Input:  V = 4, m = 3, edges = [(0,1),(1,2),(2,3),(3,0),(0,2)]
Output: true
Explanation: A valid 3-coloring exists.
\`\`\`

**Example 2**
\`\`\`
Input:  V = 3, m = 2, edges = [(0,1),(1,2),(2,0)]  (a triangle)
Output: false
Explanation: A triangle needs 3 colors.
\`\`\`

**Constraints**
- \`1 <= V <= 20\`, \`1 <= m <= V\`
- Backtracking: try each color for each vertex, checking neighbors.`,

  "Rat in a Maze": `Given an \`n x n\` binary grid \`maze\` where \`1\` is an open cell and \`0\` is blocked, a rat starts at \`(0,0)\` and must reach \`(n-1, n-1)\`. It can move **U**p, **D**own, **L**eft, **R**ight but cannot revisit a cell in the same path. Return **all paths** as strings of moves, in lexicographic order.

**Example 1**
\`\`\`
Input:  maze = [[1,0,0,0],
                [1,1,0,1],
                [1,1,0,0],
                [0,1,1,1]]
Output: ["DDRDRR", "DRDDRR"]
\`\`\`

**Example 2**
\`\`\`
Input:  maze = [[1,0],[1,0]]
Output: []   (destination unreachable)
\`\`\`

**Constraints**
- \`2 <= n <= 5\`
- \`maze[0][0] == 1\` for a path to exist. Backtracking with a visited grid.`,

  "Nth Root of a Number": `Given two integers \`n\` and \`m\`, find the **n-th root of m** if it is an integer, otherwise return \`-1\`. That is, find an integer \`x\` such that \`x^n == m\`.

**Example 1**
\`\`\`
Input:  n = 2, m = 9
Output: 3
Explanation: 3^2 = 9.
\`\`\`

**Example 2**
\`\`\`
Input:  n = 3, m = 9
Output: -1
Explanation: No integer cube equals 9.
\`\`\`

**Constraints**
- \`1 <= n <= 30\`, \`1 <= m <= 1e9\`
- Binary search on the answer in \`[1, m]\`, using overflow-safe power comparison. \`O(n log m)\`.`,

  "Matrix Median": `Given a row-wise sorted matrix of size \`R x C\` where \`R * C\` is **odd**, find the **median** of all the elements. You must do it without fully flattening and sorting (better than \`O(R*C log(R*C))\`).

**Example 1**
\`\`\`
Input:  matrix = [[1, 3, 5],
                  [2, 6, 9],
                  [3, 6, 9]]
Output: 5
Explanation: Sorted elements are 1,2,3,3,5,6,6,9,9 -> median is 5.
\`\`\`

**Example 2**
\`\`\`
Input:  matrix = [[1, 3, 4],
                  [2, 5, 6],
                  [7, 8, 9]]
Output: 5
\`\`\`

**Constraints**
- \`1 <= R, C <= 400\`, \`R*C\` is odd
- Binary search on the value range; count elements <= mid via per-row upper_bound. \`O(32 * R * log C)\`.`,

  "K-th Element of Two Sorted Arrays": `Given two **sorted** arrays \`a\` (size \`m\`) and \`b\` (size \`n\`) and a positive integer \`k\`, find the **k-th smallest element** in the merged sorted order (1-indexed).

**Example 1**
\`\`\`
Input:  a = [2, 3, 6, 7, 9], b = [1, 4, 8, 10], k = 5
Output: 6
Explanation: Merged = 1,2,3,4,6,7,8,9,10; the 5th element is 6.
\`\`\`

**Example 2**
\`\`\`
Input:  a = [100, 112, 256, 349, 770], b = [72, 86, 113, 119, 265, 445, 892], k = 7
Output: 256
\`\`\`

**Constraints**
- \`1 <= m, n <= 1e6\`, \`1 <= k <= m + n\`
- Binary-search the partition (like median of two sorted arrays). \`O(log(min(m,n)))\`.`,

  "Allocate Minimum Number of Pages": `Given an array \`pages\` where \`pages[i]\` is the number of pages in book \`i\` (books arranged in order), allocate all books to \`m\` students such that each student gets a **contiguous** block of books, every book is assigned, and each student gets at least one book. Minimize the **maximum number of pages** assigned to any student. Return that minimum, or \`-1\` if \`m > books\`.

**Example 1**
\`\`\`
Input:  pages = [12, 34, 67, 90], m = 2
Output: 113
Explanation: Split [12,34,67] and [90] -> max(113, 90) = 113, the best possible.
\`\`\`

**Example 2**
\`\`\`
Input:  pages = [15, 17, 20], m = 2
Output: 32
Explanation: [15,17] and [20] -> max(32, 20) = 32.
\`\`\`

**Constraints**
- \`1 <= n <= 1e5\`
- Binary search on the answer in \`[max(pages), sum(pages)]\`; feasibility check is greedy. \`O(n log(sum))\`.`,

  "Aggressive Cows": `You are given an array \`stalls\` of positions and an integer \`k\` (number of cows). Place the \`k\` cows in the stalls so that the **minimum distance** between any two cows is as **large** as possible. Return that largest minimum distance.

**Example 1**
\`\`\`
Input:  stalls = [1, 2, 4, 8, 9], k = 3
Output: 3
Explanation: Place cows at 1, 4, 8 -> min gap is 3.
\`\`\`

**Example 2**
\`\`\`
Input:  stalls = [10, 1, 2, 7, 5], k = 3
Output: 4
Explanation: Sorted = 1,2,5,7,10; place at 1, 5, 10 -> min gap 4.
\`\`\`

**Constraints**
- \`2 <= k <= n <= 1e5\`
- Sort, then binary search on the distance; greedily check placement feasibility. \`O(n log(maxPos))\`.`,

  "Maximum Sum Combination": `Given two integer arrays \`a\` and \`b\`, each of size \`n\`, and an integer \`k\`, consider all \`n*n\` pairwise sums \`a[i] + b[j]\`. Return the **k largest** of these sums, in non-increasing order.

**Example 1**
\`\`\`
Input:  a = [3, 2], b = [1, 4], k = 2
Output: [7, 6]
Explanation: Sums are 3+1=4, 3+4=7, 2+1=3, 2+4=6; top 2 are 7 and 6.
\`\`\`

**Example 2**
\`\`\`
Input:  a = [1, 4, 2, 3], b = [2, 5, 1, 6], k = 4
Output: [10, 9, 9, 8]
\`\`\`

**Constraints**
- \`1 <= n <= 1e5\`, \`1 <= k <= n*n\`
- Sort both arrays; use a max-heap seeded with the largest pair and expand neighbors with a visited set. \`O(k log k)\`.`,

  "Sort a Stack": `Given a stack of integers, **sort it in ascending order** (largest on top) using only stack operations (push, pop, peek, isEmpty) and recursion — **no other data structure** such as an array is allowed.

**Example 1**
\`\`\`
Input:  stack (top -> bottom) = [3, 1, 4, 2]
Output: stack (top -> bottom) = [4, 3, 2, 1]
\`\`\`

**Example 2**
\`\`\`
Input:  [-3, 14, 18, -5, 30]
Output: [30, 18, 14, -3, -5]  (top = 30)
\`\`\`

**Constraints**
- \`1 <= n <= 100\`
- Recursively pop everything, then insert each element into its sorted position in the recursion stack. \`O(n^2)\`.`,

  "Left View of Binary Tree": `Given the root of a binary tree, return its **left view** — the set of nodes visible when the tree is viewed from the left side, i.e. the **first node of each level**, top to bottom.

**Example 1**
\`\`\`
Input:
        1
       / \\
      2   3
       \\   \\
        4   5
Output: [1, 2, 4]
\`\`\`

**Example 2**
\`\`\`
Input:  root = [10, 20, 30, 40, 60]
Output: [10, 20, 40]
\`\`\`

**Constraints**
- \`0 <= nodes <= 1e5\`
- Level-order (BFS) taking the first node per level, or DFS tracking max depth reached. \`O(n)\`.`,

  "Top View of Binary Tree": `Given the root of a binary tree, return its **top view** — the nodes visible when looking down from directly above. For each **horizontal distance** (root = 0, left = −1, right = +1), report the **topmost** node, ordered left to right.

**Example 1**
\`\`\`
Input:
        1
       / \\
      2   3
       \\   \\
        4   5
Output: [2, 1, 3, 5]
\`\`\`

**Example 2**
\`\`\`
Input:
          1
        /   \\
       2     3
        \\
         4
          \\
           5
            \\
             6
Output: [2, 1, 3, 6]
\`\`\`

**Constraints**
- \`1 <= nodes <= 1e5\`
- BFS with horizontal distance; record the first node seen at each hd. \`O(n)\`.`,

  "Bottom View of Binary Tree": `Given the root of a binary tree, return its **bottom view** — for each **horizontal distance** (root = 0), report the **last (lowest)** node encountered in a top-to-bottom, left-to-right traversal, ordered left to right.

**Example 1**
\`\`\`
Input:
        1
       / \\
      2   3
       \\   \\
        4   5
Output: [2, 4, 5, 3]  (hd: -1 -> 2, 0 -> 4, +1 -> 5? )
\`\`\`

**Example 2**
\`\`\`
Input:
          20
         /  \\
        8    22
       / \\    \\
      5  3    25
        / \\
       10 14
Output: [5, 10, 3, 14, 25]
\`\`\`

**Constraints**
- \`1 <= nodes <= 1e5\`
- BFS with horizontal distance; overwrite each hd with the latest node seen. \`O(n)\`.`,

  "Boundary Traversal of Binary Tree": `Given the root of a binary tree, return its **boundary traversal** in **anti-clockwise** order: the left boundary (top to bottom, excluding leaves), then all leaf nodes (left to right), then the right boundary (bottom to top, excluding leaves). The root is included once.

**Example 1**
\`\`\`
Input:
          1
        /   \\
       2     3
      / \\   / \\
     4   5 6   7
Output: [1, 2, 4, 5, 6, 7, 3]
\`\`\`

**Example 2**
\`\`\`
Input:
        1
       /
      2
     / \\
    4   9
Output: [1, 2, 4, 9]
\`\`\`

**Constraints**
- \`1 <= nodes <= 1e5\`
- Three passes: left boundary, leaves (DFS), reversed right boundary. Avoid double-counting leaves. \`O(n)\`.`,

  "Largest BST in a Binary Tree": `Given a binary tree (not necessarily a BST), find the **size (number of nodes) of the largest subtree** that is itself a valid Binary Search Tree.

**Example 1**
\`\`\`
Input:
        10
       /  \\
      5    15
     / \\     \\
    1   8     7
Output: 3
Explanation: The subtree rooted at 5 (nodes 1,5,8) is the largest BST.
\`\`\`

**Example 2**
\`\`\`
Input:  a tree that is already a BST with 6 nodes
Output: 6
\`\`\`

**Constraints**
- \`1 <= nodes <= 1e5\`
- Post-order: each node returns (min, max, size, isBST) of its subtree. \`O(n)\`.`,

  "Inorder Successor in BST": `Given the root of a Binary Search Tree and a node (or its key) \`x\`, return the **in-order successor** of \`x\` — the node with the smallest key strictly greater than \`x\`. Return \`null\` if none exists.

**Example 1**
\`\`\`
Input:
        20
       /  \\
      8    22
     / \\
    4   12
       /  \\
      10  14
x = 8
Output: 10
\`\`\`

**Example 2**
\`\`\`
Input:  same tree, x = 22
Output: null   (22 is the maximum)
\`\`\`

**Constraints**
- \`1 <= nodes <= 1e5\`
- Walk down from the root: whenever you go left, remember that node as a candidate successor. \`O(height)\`.`,

  "Binary Tree to Doubly Linked List": `Given the root of a binary tree, convert it **in place** to a sorted Doubly Linked List. The left pointer becomes \`prev\` and the right pointer becomes \`next\`. The order of nodes in the DLL must be the **in-order traversal** of the tree. Return the head of the DLL.

**Example 1**
\`\`\`
Input:
        10
       /  \\
      12   15
     /  \\    \\
    25  30   36
Output: 25 <-> 12 <-> 30 <-> 10 <-> 36 <-> 15
\`\`\`

**Example 2**
\`\`\`
Input:
      1
     / \\
    3   5
Output: 3 <-> 1 <-> 5
\`\`\`

**Constraints**
- \`1 <= nodes <= 1e5\`
- In-order traversal keeping a \`prev\` pointer; link \`prev.right = curr\`, \`curr.left = prev\`. \`O(n)\`.`,

  "Distinct Numbers in Window": `Given an array \`arr\` of size \`n\` and a window size \`k\`, for **every contiguous window of size \`k\`** report the count of **distinct elements** in that window. Return the list of counts (there are \`n - k + 1\` of them).

**Example 1**
\`\`\`
Input:  arr = [1, 2, 1, 3, 4, 2, 3], k = 4
Output: [3, 4, 4, 3]
Explanation: windows [1,2,1,3]=3, [2,1,3,4]=4, [1,3,4,2]=4, [3,4,2,3]=3.
\`\`\`

**Example 2**
\`\`\`
Input:  arr = [1, 1, 1, 1], k = 2
Output: [1, 1, 1]
\`\`\`

**Constraints**
- \`1 <= k <= n <= 1e5\`
- Sliding window with a hash map of counts; add the entering element, remove the leaving one. \`O(n)\`.`,

  "Count Distinct Elements in Every Window": `Identical to *Distinct Numbers in Window*: given \`arr\` and window size \`k\`, output the number of distinct elements in each window of size \`k\`, for all \`n - k + 1\` windows.

**Example 1**
\`\`\`
Input:  arr = [1, 2, 1, 3, 4, 2, 3], k = 4
Output: [3, 4, 4, 3]
\`\`\`

**Example 2**
\`\`\`
Input:  arr = [1, 2, 4, 4], k = 2
Output: [2, 2, 1]
\`\`\`

**Constraints**
- \`1 <= k <= n <= 1e5\`
- Maintain a frequency map over the sliding window; a count hits zero -> element left the window. \`O(n)\`.`,

  "Topological Sort": `Given a **Directed Acyclic Graph (DAG)** with \`V\` vertices and a list of directed edges, return any valid **topological ordering** — a linear order of vertices such that for every edge \`u -> v\`, \`u\` appears before \`v\`.

**Example 1**
\`\`\`
Input:  V = 6, edges = [(5,0),(5,2),(4,0),(4,1),(2,3),(3,1)]
Output: [5, 4, 2, 3, 1, 0]   (one valid ordering)
\`\`\`

**Example 2**
\`\`\`
Input:  V = 4, edges = [(3,0),(1,0),(2,0)]
Output: [3, 1, 2, 0]   (any order of 1,2,3 before 0)
\`\`\`

**Constraints**
- \`1 <= V <= 1e5\`
- Kahn's algorithm (BFS on in-degrees) or DFS post-order + reverse. \`O(V + E)\`.`,

  "Detect Cycle in Undirected Graph": `Given an **undirected** graph with \`V\` vertices and an edge list, determine whether it contains a **cycle**. Return \`true\`/\`false\`.

**Example 1**
\`\`\`
Input:  V = 5, edges = [(0,1),(1,2),(2,3),(3,4),(4,1)]
Output: true
Explanation: 1 -> 2 -> 3 -> 4 -> 1 is a cycle.
\`\`\`

**Example 2**
\`\`\`
Input:  V = 4, edges = [(0,1),(1,2),(2,3)]
Output: false   (a tree, no cycle)
\`\`\`

**Constraints**
- \`1 <= V <= 1e5\`
- BFS/DFS tracking the parent (a visited neighbor that isn't the parent = cycle), or Union-Find. \`O(V + E)\`.`,

  "Strongly Connected Components (Kosaraju)": `Given a **directed** graph with \`V\` vertices and an edge list, count the number of **Strongly Connected Components** (maximal sets of mutually reachable vertices) using **Kosaraju's algorithm**.

**Example 1**
\`\`\`
Input:  V = 5, edges = [(1,0),(0,2),(2,1),(0,3),(3,4)]
Output: 3
Explanation: SCCs are {0,1,2}, {3}, {4}.
\`\`\`

**Example 2**
\`\`\`
Input:  V = 4, edges = [(0,1),(1,2),(2,3),(3,0)]
Output: 1   (one big cycle)
\`\`\`

**Constraints**
- \`1 <= V <= 1e5\`
- Kosaraju: DFS to fill a finish-time stack, transpose the graph, then DFS in stack order. \`O(V + E)\`.`,

  "Dijkstra's Algorithm": `Given a **weighted, non-negative** graph with \`V\` vertices, an edge list \`(u, v, w)\`, and a source \`src\`, return the **shortest distance** from \`src\` to every vertex. Unreachable vertices have distance \`infinity\` (or a sentinel like \`-1\`).

**Example 1**
\`\`\`
Input:  V = 5, src = 0,
        edges = [(0,1,4),(0,2,1),(2,1,2),(1,3,1),(2,3,5)]
Output: [0, 3, 1, 4, INF]
Explanation: 0->2 (1), 2->1 (3), 1->3 (4); vertex 4 unreachable.
\`\`\`

**Example 2**
\`\`\`
Input:  V = 3, src = 0, edges = [(0,1,1),(1,2,1),(0,2,4)]
Output: [0, 1, 2]
\`\`\`

**Constraints**
- \`1 <= V <= 1e5\`, weights \`>= 0\`
- Min-heap (priority queue) relaxing edges. \`O((V + E) log V)\`.`,

  "Bellman-Ford Algorithm": `Given a **directed weighted** graph with \`V\` vertices (weights may be **negative**), an edge list \`(u, v, w)\`, and a source \`src\`, return the shortest distance to every vertex. If the graph contains a **negative-weight cycle** reachable from \`src\`, report it (e.g. return \`[-1]\`).

**Example 1**
\`\`\`
Input:  V = 5, src = 0,
        edges = [(0,1,-1),(0,2,4),(1,2,3),(1,3,2),(1,4,2),(3,2,5),(3,1,1),(4,3,-3)]
Output: [0, -1, 2, -2, 1]
\`\`\`

**Example 2**
\`\`\`
Input:  V = 3, src = 0, edges = [(0,1,1),(1,2,-1),(2,0,-1)]
Output: [-1]   (negative cycle)
\`\`\`

**Constraints**
- \`1 <= V <= 1e3\`
- Relax all edges \`V-1\` times; a further relaxation possible => negative cycle. \`O(V * E)\`.`,

  "Floyd Warshall Algorithm": `Given a graph as a \`V x V\` distance matrix where \`dist[i][j]\` is the edge weight from \`i\` to \`j\` (and a sentinel, e.g. \`1e8\`, for no edge), compute the **all-pairs shortest paths** in place. Update the matrix so \`dist[i][j]\` is the shortest distance from \`i\` to \`j\`.

**Example 1**
\`\`\`
Input:  dist = [[0,   4,  INF, 5],
                [INF, 0,   1,  INF],
                [INF, INF, 0,  3],
                [INF, INF, INF,0]]
Output:        [[0,   4,   5,  5],
                [INF, 0,   1,  4],
                [INF, INF, 0,  3],
                [INF, INF, INF,0]]
\`\`\`

**Constraints**
- \`1 <= V <= 100\`
- Triple loop over intermediate \`k\`, source \`i\`, dest \`j\`: \`dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j])\`. \`O(V^3)\`.`,

  "Minimum Spanning Tree (Prim's)": `Given a **connected, undirected, weighted** graph with \`V\` vertices and an edge list \`(u, v, w)\`, find the total weight of its **Minimum Spanning Tree** using **Prim's algorithm**.

**Example 1**
\`\`\`
Input:  V = 4, edges = [(0,1,1),(1,3,3),(3,2,4),(2,0,2),(0,3,2),(1,2,2)]
Output: 5
Explanation: MST edges 0-1(1), 0-2(2), 0-3(2) -> total 5.
\`\`\`

**Example 2**
\`\`\`
Input:  V = 3, edges = [(0,1,5),(1,2,3),(0,2,1)]
Output: 4
\`\`\`

**Constraints**
- \`1 <= V <= 1e5\`
- Grow the tree from any vertex using a min-heap of crossing edges. \`O(E log V)\`.`,

  "Minimum Spanning Tree (Kruskal's)": `Given a **connected, undirected, weighted** graph with \`V\` vertices and an edge list \`(u, v, w)\`, find the total weight of its **Minimum Spanning Tree** using **Kruskal's algorithm** (sort edges + Union-Find).

**Example 1**
\`\`\`
Input:  V = 4, edges = [(0,1,1),(1,3,3),(3,2,4),(2,0,2),(0,3,2),(1,2,2)]
Output: 5
\`\`\`

**Example 2**
\`\`\`
Input:  V = 5, edges = [(0,1,2),(0,3,6),(1,2,3),(1,3,8),(1,4,5),(2,4,7),(3,4,9)]
Output: 16
\`\`\`

**Constraints**
- \`1 <= V <= 1e5\`
- Sort edges ascending, add an edge if it joins two different components (DSU). \`O(E log E)\`.`,

  "0-1 Knapsack": `Given \`n\` items with \`weight[i]\` and \`value[i]\`, and a knapsack of capacity \`W\`, maximize the total value. Each item is **taken at most once** (0 or 1) — fractions are **not** allowed.

**Example 1**
\`\`\`
Input:  W = 4, values = [1, 2, 3], weights = [4, 5, 1]
Output: 3
Explanation: Only item 3 (weight 1, value 3) fits.
\`\`\`

**Example 2**
\`\`\`
Input:  W = 3, values = [1, 2, 3], weights = [4, 5, 6]
Output: 0   (nothing fits)
\`\`\`

**Constraints**
- \`1 <= n <= 1e3\`, \`1 <= W <= 1e3\`
- DP over (item, remaining capacity); can be reduced to a 1-D array iterated right-to-left. \`O(n*W)\`.`,

  "Matrix Chain Multiplication": `Given an array \`dims\` of length \`n\` where matrix \`i\` (1-indexed) has dimensions \`dims[i-1] x dims[i]\`, find the **minimum number of scalar multiplications** needed to multiply the whole chain of \`n-1\` matrices together (you may only choose the parenthesization, not reorder the matrices).

**Example 1**
\`\`\`
Input:  dims = [40, 20, 30, 10, 30]
Output: 26000
Explanation: Best parenthesization costs 26000 multiplications.
\`\`\`

**Example 2**
\`\`\`
Input:  dims = [10, 20, 30]
Output: 6000
Explanation: One product (10x20)(20x30) = 10*20*30 = 6000.
\`\`\`

**Constraints**
- \`2 <= n <= 100\`
- Interval DP: \`dp[i][j]\` = min cost to multiply matrices \`i..j\`, split at each \`k\`. \`O(n^3)\`.`,

  "Implement Trie II (Count Prefixes)": `Design a **Trie** that also tracks counts. Implement:
- \`insert(word)\` — add \`word\`.
- \`countWordsEqualTo(word)\` — how many times exactly \`word\` was inserted.
- \`countWordsStartingWith(prefix)\` — how many inserted words start with \`prefix\`.
- \`erase(word)\` — remove one occurrence of \`word\`.

**Example**
\`\`\`
insert("apple")
insert("apple")
countWordsEqualTo("apple")      -> 2
countWordsStartingWith("app")   -> 2
erase("apple")
countWordsEqualTo("apple")      -> 1
countWordsStartingWith("app")   -> 1
\`\`\`

**Constraints**
- \`1 <= word.length <= 2000\`, lowercase letters
- Each node stores \`countPrefix\` and \`countEnd\`. All ops are \`O(word.length)\`.`,

  "Longest Word With All Prefixes": `Given a list of strings \`words\`, find the **longest word** such that **every prefix** of it (of length 1, 2, …, len) is also present in \`words\`. If several qualify, return the **lexicographically smallest**; if none, return an empty string.

**Example 1**
\`\`\`
Input:  words = ["n", "ni", "nin", "ninj", "ninja", "nil"]
Output: "ninja"
Explanation: n, ni, nin, ninj, ninja are all present.
\`\`\`

**Example 2**
\`\`\`
Input:  words = ["ab", "abc", "a", "bp"]
Output: "abc"
Explanation: "a", "ab", "abc" all present; "bp" fails (no "b").
\`\`\`

**Constraints**
- \`1 <= n <= 1e5\`
- Build a Trie marking word ends; DFS keeping only paths where every node is a word end. \`O(total chars)\`.`,
};

export const GFG_STATEMENTS: Record<string, string> = Object.fromEntries(
  Object.entries(BY_TITLE).map(([title, statement]) => [slugify(title), statement]),
);

/** Curated Markdown statement for a GFG-only problem id, or null if none. */
export function getGfgStatement(id: string): string | null {
  return GFG_STATEMENTS[id] ?? null;
}
