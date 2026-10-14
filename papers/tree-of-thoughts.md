# Tree of Thoughts: Deliberate Problem Solving with LLMs

```callout
**In one sentence:** instead of forcing a language model down a single left-to-right chain, let it grow a *tree* of intermediate thoughts, evaluate which partial ideas look promising, and search that tree — turning inference into deliberation.
```

This paper (Yao et al., 2023) takes the same authors' [ReAct](react-synergizing-reasoning-and-acting.md) idea of interleaving thought with action and pushes it into a general search framework. It sits alongside [Chain-of-Thought](chain-of-thought-prompting.md) and [Self-Consistency](self-consistency.md) in the reasoning lineage.

## Before you read

- **Chain-of-thought prompting.** See [Chain-of-Thought Prompting](chain-of-thought-prompting.md).
- **Self-consistency.** Sampling many paths and voting — see [Self-Consistency](self-consistency.md).
- **Search basics.** BFS, DFS, and the idea of a heuristic that scores partial states.

## The problem: a single chain cannot look ahead or backtrack

Chain-of-thought is **linear and greedy**: it emits one step, commits to it, and moves on. That breaks down when:

- A locally reasonable step is globally wrong, and there is no way to undo it.
- The task has several viable paths but only one that pans out.
- You want to compare candidate continuations before spending effort on them.

In short, CoT cannot **explore**, **backtrack**, or **look ahead**. Human problem-solvers do all three.

## Key idea: reasoning as search over a tree of thoughts

A **thought** is a coherent intermediate step — not a single token, but a meaningful chunk of progress (an equation, a plan, a partial solution). ToT:

1. **Decompose** the problem into a sequence of thoughts.
2. **Generate** several candidate next thoughts from the current one.
3. **Evaluate** each candidate with a value estimate — how promising is this partial state?
4. **Search** (BFS or DFS) the tree, keeping good branches and pruning bad ones.

```
                 Start
        ┌──────────┼──────────┐
      t1a        t1b        t1c        <- generate candidates
      good       ?          bad        <- self-evaluate
     ┌──┴──┐
   t2a    t2b ──────────────▶ ...      <- expand only promising nodes
     │
   solution
```

The model both proposes and judges. Crucially, **partial states are evaluated before they are completed**, so dead ends are cut early.

## The four ingredients

| Component          | Question it answers                                  |
|--------------------|------------------------------------------------------|
| Thought decomposition | What counts as one step? (a sentence, a line, a plan) |
| Thought generator  | How do we produce candidate next thoughts?           |
| State evaluator    | How promising is this partial solution?              |
| Search algorithm   | BFS (safe, broad) or DFS (deep, backtracking)?       |

Two generation strategies:

- **Sample** several thoughts independently when the space is open-ended (creative writing).
- **Propose** candidate thoughts in a single prompt when the space is constrained (e.g., arithmetic operations).

Two evaluation strategies:

- **Value** each state individually (e.g., "is this partial solution correct? sure/maybe/impossible").
- **Vote** across candidate states to rank them.

## The math: maximizing over paths

A reasoning path is a sequence of thoughts $s_1 \to s_2 \to \dots \to s_T$. ToT searches for the path that maximizes the value of its final state:

$$
s^{*} = \arg\max_{s_1, \dots, s_T} V(s_T)
$$

where $V$ is the self-evaluated value of a state. Because the frontier can branch, the generator produces a set of children and the search keeps the top-$k$:

$$
\text{frontier}_{t+1} = \operatorname{topk}_{s' \in \text{expand}(\text{frontier}_t)} V(s')
$$

This is best-first search over a tree the model itself builds. The value function is not trained — it is the model's own judgment elicited by a prompt, which is exactly what makes it training-free.

## Results

On **Game of 24** (use four numbers and arithmetic to make 24):

- Standard IO prompting: ~**4%** success.
- Chain-of-thought: ~**4%**.
- Chain-of-thought + self-consistency: ~**9%**.
- Tree of Thoughts: ~**74%**.

ToT also produced more coherent long-form creative writing and solved crossword-style tasks better than CoT, by deliberately exploring, evaluating, and backtracking.

## Method comparison

| Method        | Structure      | Can backtrack | Cost    |
|---------------|----------------|---------------|---------|
| IO            | none           | no            | 1×      |
| Chain-of-Thought | linear       | no            | 1×      |
| Self-Consistency | parallel samples | no       | N×      |
| Tree of Thoughts | branching + search | yes    | much higher |

The trade is stark: ToT can be **orders of magnitude** more expensive in tokens because every branch is generated and scored. It buys success on problems where single-pass methods fail.

## Code: a BFS Tree-of-Thoughts skeleton

```python
def tree_of_thoughts(problem, generate, value, breadth=5, depth=3, beam=3):
    """Best-first search over intermediate thoughts."""
    frontier = [{"thoughts": [], "state": problem, "score": 0.0}]
    for _ in range(depth):
        candidates = []
        for node in frontier:
            for next_thought in generate(node["state"], n=breadth):
                state = next_thought                         # e.g. remaining numbers + expr
                score = value(state)                         # model-judged promise
                candidates.append({
                    "thoughts": node["thoughts"] + [next_thought],
                    "state": state,
                    "score": score,
                })
        candidates.sort(key=lambda c: c["score"], reverse=True)
        frontier = candidates[:beam]                         # prune weak branches
        done = [c for c in frontier if is_solution(c["state"])]
        if done:
            return max(done, key=lambda c: c["score"])
    return max(frontier, key=lambda c: c["score"])
```

The two knobs that matter are **breadth** (how many candidates per expansion) and **beam** (how many survive) — a direct cost/quality dial.

## Limitations

- **Expensive.** Many more model calls than one-shot prompting.
- **The value function is only as good as the model.** Poor self-evaluation prunes good branches.
- **Needs decomposable problems** with a notion of partial progress; it is awkward for tasks without intermediate structure.

## Key takeaways

- Reasoning can be **search**, not just a single chain.
- Interleave **generation** with **self-evaluation** so bad branches are pruned early.
- A **thought** is a meaningful chunk, not a token.
- Choose BFS vs. DFS based on whether the space is broad or deep.
- It is training-free but **compute-heavy** — use it where single-pass methods fail.

## Read further

- Our paper: [ReAct: Synergizing Reasoning and Acting](react-synergizing-reasoning-and-acting.md)
- Our paper: [Self-Consistency](self-consistency.md)
- Our tutorial: [Building with LangChain](../tutorials/langchain.md)
- Paper: [arXiv:2305.10601](https://arxiv.org/abs/2305.10601)
- Code: [princeton-nlp/tree-of-thoughts](https://github.com/princeton-nlp/tree-of-thoughts)

## Cite this

```text
@inproceedings{yao2023tree,
  title     = {Tree of Thoughts: Deliberate Problem Solving with Large Language Models},
  author    = {Yao, Shunyu and Yu, Dian and Zhao, Jeffrey and Shafran, Izhak and Griffiths, Thomas L. and Cao, Yuan and Narasimhan, Karthik},
  booktitle = {Advances in Neural Information Processing Systems},
  year      = {2023}
}
```
