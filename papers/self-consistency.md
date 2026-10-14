# Self-Consistency Improves Chain-of-Thought Reasoning

```callout
**In one sentence:** instead of trusting a single chain of thought, sample many different reasoning chains and take a majority vote on the final answer — a dead-simple decoding trick that boosts reasoning accuracy with no training and no extra model.
```

This paper (Wang et al., 2023) is the natural follow-up to [Chain-of-Thought Prompting](chain-of-thought-prompting.md): if one reasoning path can be wrong, ask the model for many and vote.

## Before you read

- **Chain-of-thought (CoT) prompting.** Ask the model to reason step by step before answering. See our [Chain-of-Thought paper](chain-of-thought-prompting.md).
- **Greedy vs. sampled decoding.** Greedy always picks the single most likely token; sampling (temperature > 0) explores alternatives.
- **Majority vote.** The answer that appears most often across independent runs.

## The problem: one reasoning chain is a single point of failure

Standard chain-of-thought prompting decodes **one** chain — usually greedily — and reads off its final answer. That is brittle:

- An early mistake cascades: one wrong substitution and everything after it is wrong.
- There is no signal that the chain went off the rails; a confidently wrong chain looks exactly like a correct one.
- A complex problem has *many* valid routes to the answer, but greedy decoding explores only one.

The model often "knows" the answer — a different chain would have gotten there. Self-consistency is a way to let it try.

## Key idea: sample many chains, vote on the answer

Instead of taking the first chain, sample a **diverse set** of reasoning paths with temperature > 0, then aggregate their final answers:

1. Prompt the model with chain-of-thought examples.
2. Sample $N$ independent chains (say, 40) at a non-zero temperature.
3. Extract the final answer from each chain.
4. Return the **majority answer**.

Aggregation happens at the **answer level**, not the chain level. Two chains can reach the same answer by completely different routes — that agreement is the signal.

```
Problem
   ├─ chain 1: ... -> 18
   ├─ chain 2: ... -> 18
   ├─ chain 3: ... -> 12   (a slip)
   ├─ chain 4: ... -> 18
   └─ chain 5: ... -> 18
                 majority -> 18
```

## The math: marginalize over reasoning paths

A single chain is one reasoning path $r$ that ends in answer $a$. Self-consistency instead marginalizes over the *distribution* of paths that end in each answer and picks the most probable answer:

$$
a^{*} = \arg\max_{a} \sum_{r \in \mathcal{R}(a)} P(r \mid \text{prompt})
$$

where $\mathcal{R}(a)$ is the set of reasoning paths that produce answer $a$. Sampling many chains is a Monte Carlo estimate of that sum.

Intuitively: a correct answer tends to be reachable by **many different** correct lines of reasoning, while a wrong answer usually comes from a rarer mistake. Majority vote exploits that asymmetry — no training, no extra model.

## CoT vs. self-consistency

| | Chain-of-Thought | Self-Consistency |
|---|---|---|
| Chains                | one (greedy)      | many (sampled)   |
| Decoding temperature  | 0                 | > 0              |
| Aggregation           | none              | majority vote    |
| Extra training        | none              | none             |
| Extra cost            | 1×                | ~N× sampling     |
| Robustness to mistakes| low               | high             |

## Results

Self-consistency improved chain-of-thought prompting across arithmetic and commonsense benchmarks with no fine-tuning:

- **GSM8K** math word problems: roughly **+17%** absolute over standard CoT.
- Gains on SVAMP, AQuA, StrategyQA, and ARC as well.
- Improvements were largest where reasoning is hard and the answer is discrete.
- It also narrowed the gap to fine-tuned task-specific models — and combined well with them.

A nice property: it is a **decoding strategy**, so it stacks on top of whatever prompt or model you already have.

## Code: the whole method

Self-consistency is refreshingly small:

```python
from collections import Counter

def self_consistency(generate, prompt, n=40, temperature=0.7):
    """Sample n chains, extract answers, return the majority vote."""
    answers = []
    for _ in range(n):
        chain = generate(prompt, temperature=temperature)   # full reasoning text
        answer = extract_final_answer(chain)                # e.g. text after "The answer is"
        if answer is not None:
            answers.append(answer)
    if not answers:
        return None
    votes = Counter(answers)
    answer, count = votes.most_common(1)[0]
    return answer, count / len(answers)                     # answer + confidence
```

Two implementation details matter: the answer must be **extractable** (so prompts should end with a clear format like "The answer is X"), and `n` should be large enough that the majority is stable — the paper uses 40, though benefits saturate well before that.

## When it helps — and when it doesn't

- **Helps** when the task has a discrete, checkable final answer and the model is already partially capable (it can find the right answer *sometimes*).
- **Barely helps** on tasks the model cannot do at all — sampling garbage still gives garbage.
- **Doesn't apply** to open-ended generation with no single correct answer.
- **Costs N× inference.** That is the trade: accuracy for compute.

## Key takeaways

- Generate **many** reasoning chains at temperature > 0 and **vote on the answer**.
- Aggregate at the **answer** level, not the chain level.
- It is a **decoding method** — no training, no new model, stacks on any prompt.
- Correct answers are more "reachable" than wrong ones, so majority vote is a good estimator.
- It trades **N× compute** for a large, robust accuracy gain on reasoning tasks.

## Read further

- Our paper: [Chain-of-Thought Prompting](chain-of-thought-prompting.md)
- Our paper: [Tree of Thoughts](tree-of-thoughts.md)
- Our tutorial: [Evaluating LLM Applications](../tutorials/agent-eval-techniques.md)
- Paper: [arXiv:2203.11171](https://arxiv.org/abs/2203.11171)

## Cite this

```text
@inproceedings{wang2023selfconsistency,
  title     = {Self-Consistency Improves Chain of Thought Reasoning in Language Models},
  author    = {Wang, Xuezhi and Wei, Jason and Schuurmans, Dale and Le, Quoc V. and Chi, Ed H. and Narang, Sharan and Chowdhery, Aakanksha and Zhou, Denny},
  booktitle = {International Conference on Learning Representations},
  year      = {2023}
}
```
