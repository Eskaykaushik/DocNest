# GATE DA: Programming, Data Structures & Algorithms Notes

Programming, Data Structures and Algorithms is the largest subject block in the GATE DA paper — roughly 21 of the 85 subject marks. The questions reward two things: knowing the cost of an operation and reaching for the right Python structure without over-engineering.

```callout
**In one sentence:** choose the data structure that matches the access pattern, then prove the loop does not accidentally become quadratic.
```

## Python primitives worth memorising

| Need | Use | Cost |
| --- | --- | --- |
| Indexed sequence | `list` | O(1) access, O(n) insert in the middle |
| Key lookup | `dict` | O(1) average |
| Unique set | `set` | O(1) average membership |
| Count frequencies | `collections.Counter` | O(n) build |
| Default buckets | `collections.defaultdict` | Avoids "key not found" branches |
| Top `k` items | `heapq.nlargest` | O(n log k) |
| Queue with pop-left | `collections.deque` | O(1) at both ends |

A comprehension is not just style. `sum(x*x for x in xs)` streams values; `[x*x for x in xs]` builds a second list you may not need.

## Complexity table

| Operation | Cost |
| --- | --- |
| Binary search in a sorted array | O(log n) |
| Hash lookup, average case | O(1) |
| Hash lookup, worst case | O(n) |
| Merge sort / quicksort average | O(n log n) |
| Quicksort worst case | O(n²) |
| BFS / DFS on a graph | O(V + E) |
| Dijkstra with a binary heap | O((V + E) log V) |
| Matrix multiplication, plain | O(n³) |

When you see `if x in items` inside a loop over `items`, stop. A `set` usually turns O(n²) into O(n).

## Pattern recognition

| Question shape | First tool to try |
| --- | --- |
| "Count how often each item appears" | `Counter` |
| "Top k frequent / smallest k" | Heap |
| "Shortest path, all edges equal" | BFS |
| "Weighted shortest path, non-negative" | Dijkstra |
| "Detect a cycle" | DFS colours or Union-Find |
| "Group connected components" | BFS/DFS or Union-Find |
| "Sliding window maximum" | Deque |

```callout
**GATE nuance:** recursion is elegant but Python's default recursion limit is around 1000. For a deep chain on a NAT question, an iterative stack is safer than `sys.setrecursionlimit`.
```

## Sorting with keys

`sorted(items, key=...)` is stable, which matters when two records tie. Sorting by `(−count, name)` gives descending count with alphabetical tie-breaking in one line:

```python
rows = [("b", 2), ("a", 2), ("c", 5)]
print(sorted(rows, key=lambda row: (-row[1], row[0])))
```

## Common pitfalls

- Mutating a list while iterating over it.
- Using `list.pop(0)` as a queue — that is O(n); use `deque`.
- Assuming dictionary order is sorted. It preserves insertion order, not key order.
- Losing integer precision is not a Python problem, but `3 / 2` is `1.5` while `3 // 2` is `1`.
- Confusing `sorted()` (returns a new list) with `list.sort()` (in place, returns `None`).

## Worked example

A logging service emits error codes and needs the two most frequent codes from a large stream without storing a second full copy.

**Input:** `["429", "429", "500", "404", "429", "500"]`, `k = 2`.
**Output:** `[("429", 3), ("500", 2)]`.

```python
from collections import Counter
import heapq

codes = ["429", "429", "500", "404", "429", "500"]
counts = Counter(codes)
print(heapq.nlargest(2, counts.items(), key=lambda item: item[1]))
```

Building the Counter is O(n); selecting the top `k` is O(m log k) for `m` distinct codes. That is the answer GATE wants — not just the printed pair, but why it scales.

## Glossary

- **Amortised** — average cost per operation over a sequence, even if one operation is expensive.
- **Stable sort** — equal keys keep their original relative order.
- **Heap** — a tree where the parent dominates its children; root is min or max.
- **Hash collision** — two keys map to the same bucket, degrading lookup.

## Wrapping up

For every practice problem, write the complexity beside the code. A correct program with the wrong complexity is still the wrong answer in DA. This is the heaviest subject in the paper, so revisit it last as well as first.

## Sources

- [GATE 2026 DA syllabus (official PDF)](https://gate2026.iitg.ac.in/doc/GATE2026_Syllabus/DA_2026_Syllabus.pdf)
- [Python documentation — collections](https://docs.python.org/3/library/collections.html)
- [Thomas Cormen et al., *Introduction to Algorithms*](https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/)
