# GATE DA: Artificial Intelligence Notes

Artificial Intelligence carries about 11 marks in the GATE DA paper. The questions are not about chatbots — they are about search, heuristics, logic, inference, and constraint satisfaction. These topics reward a clean state-space description and careful bookkeeping over clever code.

```callout
**In one sentence:** define the state, the actions, and the goal test first; then pick the search strategy whose guarantees match the question.
```

## State-space search

A search problem has five parts:

| Part | Meaning | Route-finding example |
| --- | --- | --- |
| States | Configurations of the world | A city |
| Initial state | Where you start | Origin city |
| Actions | What you can do | Take a road |
| Transition model | Result of an action | Road takes you to another city |
| Goal test | How you know you are done | At the destination |

A **solution** is a path from the initial state to a goal state. Search algorithms differ in which path they expand first, whether they remember visited states, and what they can prove about the path they return.

## Uninformed search

| Strategy | Order | Complete? | Optimal? | Space |
| --- | --- | --- | --- | --- |
| Breadth-first | Shallowest first | Yes | Yes for unit costs | O(bᵈ) |
| Depth-first | Deepest first | No | No | O(bd) |
| Uniform-cost | Lowest path cost first | Yes | Yes for non-negative costs | O(bᵈ) |
| Iterative deepening | Depth-limited, increasing limit | Yes | Yes for unit costs | O(bd) |
| Bidirectional | From both ends | Yes | Yes when used carefully | O(b^(d/2)) |

`b` is the branching factor and `d` is the shallowest solution depth. Breadth-first search is simple but memory-hungry; depth-first search is frugal but can wander forever in an infinite branch. Iterative deepening combines DFS memory with BFS completeness.

```callout
**MSQ trap:** "complete" means it finds a solution when one exists. "optimal" means it finds the *best* solution. An algorithm can have one property without the other.
```

## Informed search and A*

A heuristic `h(n)` estimates the cost from node `n` to the goal. A* orders nodes by:

`f(n) = g(n) + h(n)`

where `g(n)` is the cost already paid to reach `n`. A* is complete and optimal when the heuristic is **admissible** (`h(n)` never overestimates the true cost) and, for graph search with repeated states, **consistent** (`h(n) ≤ c(n, n') + h(n')`).

| Heuristic property | Consequence |
| --- | --- |
| Admissible | A* returns an optimal solution |
| Consistent | First goal expansion is optimal; no reopening needed |
| Overestimating | Fast, but optimality is lost |
| `h(n) = 0` | A* degenerates to uniform-cost search |

A larger admissible heuristic is usually better because it explores fewer nodes. For route finding, straight-line distance is admissible; for the 8-puzzle, Manhattan distance and misplaced-tile count are standard choices.

## Adversarial search

Minimax models two players who alternate turns. One maximises the score, the other minimises it. Alpha-beta pruning cuts branches that cannot affect the final decision, reducing the effective branching factor without changing the answer — provided the move ordering and cut conditions are implemented correctly.

For games with chance or hidden information, expectimax and belief states replace the clean minimax tree. GATE questions usually stay with deterministic, perfect-information examples.

## Logic and inference

| Concept | Form | Meaning |
| --- | --- | --- |
| Proposition | `P` | A statement that is true or false |
| Conjunction | `P ∧ Q` | Both true |
| Disjunction | `P ∨ Q` | At least one true |
| Implication | `P → Q` | False only when `P` is true and `Q` is false |
| Biconditional | `P ↔ Q` | Same truth value |
| Valid | Always true under every interpretation | A tautology |
| Satisfiable | True under at least one interpretation | Has a model |

Two equivalences are worth memorising:

- `P → Q ≡ ¬P ∨ Q`
- `¬(P → Q) ≡ P ∧ ¬Q`

First-order logic adds objects, predicates, variables, and quantifiers. `∀x Loves(x, mom)` says everyone loves their mother; `∃x Loves(x, mom)` says somebody does. Inference rules such as Modus Ponens (`P`, `P → Q` ⇒ `Q`) and Universal Instantiation let an agent derive new facts from a knowledge base.

## Constraint satisfaction problems

A CSP has variables, domains, and constraints. A solution assigns every variable a value from its domain without violating any constraint.

| Technique | Idea |
| --- | --- |
| Backtracking | Assign one variable, recurse, undo on failure |
| Forward checking | Remove inconsistent values from unassigned neighbours |
| Arc consistency (AC-3) | Repeatedly make every arc consistent |
| Minimum Remaining Values | Choose the most constrained variable next |
| Least Constraining Value | Try the value that rules out the fewest options |
| Backjumping | Jump back to the variable that caused the conflict |

Map colouring, scheduling, Sudoku, and the n-queens problem are the standard GATE shapes. Constraint propagation often matters more than raw search order.

## Common pitfalls

- Using A* with an overestimating heuristic and still claiming optimality.
- Ignoring repeated states in graph search.
- Confusing BFS completeness with BFS optimality under arbitrary costs — that is uniform-cost search's job.
- Reading `P → Q` as causation rather than a truth-functional rule.
- Forgetting that AC-3 detects many contradictions but does not solve every CSP by itself.

## Worked example

A delivery agent must travel from city `S` to city `G`. Two partial routes have reached cities `A` and `B`. The costs paid so far are `g(A) = 4` and `g(B) = 2`. Straight-line distance to the goal is 7 for `A` and 6 for `B`; those distances are admissible heuristics. Which node does A* expand first?

**Input:** `A: g=4, h=7`; `B: g=2, h=6`.
**Output:** `f(A)=11`, `f(B)=8` → expand **B** first.

```python
nodes = {"A": (4, 7), "B": (2, 6)}
scores = {name: g + h for name, (g, h) in nodes.items()}
print(scores)
print(min(scores, key=scores.get))
```

The heuristic alone prefers `A` only if you ignore what has already been paid — and even then 7 is worse than 6, so `B` wins either way here. The important habit is adding `g` and `h`: A* chooses the cheapest *total estimated path*, not the node closest to the goal.

## Glossary

- **Heuristic** — a rule-of-thumb estimate that guides search.
- **Admissible** — never overestimates the remaining cost.
- **Consistent** — satisfies `h(n) ≤ c(n, n') + h(n')`.
- **Model** — an interpretation that makes a formula true.
- **CSP** — a problem defined by variables, domains, and constraints.

## Wrapping up

For search questions, write the state space and the evaluation function before tracing expansions. For logic questions, convert implications and negate carefully. For CSPs, decide which variable to assign and which propagation to apply. The arithmetic is easy once the representation is right.

## Sources

- [GATE 2026 DA syllabus (official PDF)](https://gate2026.iitg.ac.in/doc/GATE2026_Syllabus/DA_2026_Syllabus.pdf)
- [Artificial Intelligence: A Modern Approach — Stuart Russell and Peter Norvig](https://aima.cs.berkeley.edu/)
- [Search, Logic, and CSPs — NPTEL Artificial Intelligence](https://nptel.ac.in/courses/106102064)
