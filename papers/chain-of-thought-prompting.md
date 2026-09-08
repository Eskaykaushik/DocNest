# Chain-of-Thought Prompting Elicits Reasoning in Large Language Models

```callout
**In one sentence:** you don't need to retrain an LLM to make it reason — you just show it a few examples that *think out loud*, and the model follows the pattern, producing step-by-step reasoning that dramatically boosts accuracy on hard math and logic problems.
```

Wei et al. (2022) is the paper that made "reasoning" emergent for LLMs from a *prompt* rather than from new parameters. It's short, it's sneaky, and it pairs directly with our [Prompt Engineering Basics](../tutorials/prompt-engineering.md) tutorial.

## Before you read

- **Few-shot prompting.** Giving the model 2–8 input/output examples in the prompt. See [Prompt Engineering Basics](../tutorials/prompt-engineering.md).
- **What "emergent capabilities" mean** — abilities that appear only past a scale threshold.
- **Standard prompting's weakness**: models nail immediate recognition but fumble anything that needs several reasoning hops.

## The problem: LLMs answer before they think

Give a standard model a math word problem and a few input→output examples, and it produces a final answer directly. The model is doing a *recognition* task: "I've seen things shaped like this; here's my most likely next token." For multi-step arithmetic, that's a recipe for confident errors.

Try it: `Q: What is 17 * 23? A:` — the model's prior over "completing the pattern" is mush. Now try:

```
Q: What is 17 * 23?
A: 20 * 23 = 460, minus 3 * 23 = 69, so 460 - 69 = 391.
```

Different task entirely. The model isn't guessing a number; it's continuing a reasoning pattern.

## Key idea: intermediate steps make arithmetic into pattern-matching

Chain-of-Thought (CoT) prompting adds three ingredients to standard few-shot prompting:

1. **Intermediate reasoning steps** appear in the prompt examples — inputs map to *rationales* that end in an answer.
2. The model is asked to **produce the same structure**, so the target output *contains* the reasoning, not just the final label.
3. This is **elicited, not trained** — zero parameter updates; the capability already exists in the model but is only *revealed* when the prompt structure matches how the model was trained (book excerpts, MathQA datasets, and other long "thinking then answer" text).

### The template

```
Q: {question}
A: {step-by-step reasoning→ answer}
```

At scale, the model completes the third element: it emits its own reasoning chain, which — here's the empirical shock — ends in a *correct* answer far more often than jumping straight to the label.

## Why do intermediate steps help? (the mechanism debate)

The paper observes the effect without fully settling the mechanism. The leading explanations, refined in follow-ups:

1. **Spreading the probability mass.** A single "final answer" requires one literally-correct next token from a vague context. A chain spreads the task across many *easier* local predictions, each conditioned on the previous step. Any one step can be soft-reasoned, and the chain accumulates.
2. **Matches the pretraining distribution.** Models were trained on web text full of the pattern "explain, then conclude." CoT restores the natural pretraining distribution instead of forcing an unnatural direct-label format.
3. **Computation at inference.** CoT effectively gives the model *more compute tokens* between question and answer — a shallow form of doing more work.

## Emergent, not engineered

The paper's most famous load-bearing result: the average accuracy gain from CoT is **near zero for models ≤ 100B parameters** and jumps sharply at the largest scales.

```
LLaMA-style scaling curve (illustrative):
  accuracy
   ↑
   |                        ●  CoT elicits at scale
   |          ●────────●
   |    ●───●
   |  ●
   └───────────────────────────────→ model parameters (log)
```

This "phase transition" is what made CoT a *scale* story: the reasoning is latent in the weights and pops out once (a) the model is big enough and (b) the prompt tells it to reason.

## Code: CoT in three prompt variants

CoT is a prompt technique — here's everything in one place. A tiny harness plus three prompts (zero-shot, few-shot, CoT), using an imaginary `client.complete()`.

```python
import json

def answer(client, prompt):
    return client.complete(prompt).strip()

EAGER = """Q: Roger has 5 tennis balls. He buys 2 more cans, each with 3 balls.
A: {final}"""

FEW_SHOT = """Q: A bat and a ball cost $1.10, bat costs $1.00 more than ball.
A: $0.05

Q: If there are 3 cars and each holds 5 people, how many fit?
A: 15"""

COT = """Q: A bat and ball cost $1.10 total. The bat costs $1.00 more than the ball.
A: Let ball = x, bat = x + 1.00. x + (x + 1.00) = 1.10 so 2x = 0.10, x = 0.05. Ball costs $0.05.

Q: If there are 3 cars, each holding 5 people, how many people fit?
A: Each car holds 5, so 3 * 5 = 15. 15 people fit."""

for name, prompt in [("eager", EAGER), ("few-shot", FEW_SHOT), ("cot", COT)]:
    print(name, "->", answer(client, prompt))
```

On a sufficiently large model, the same dollars-and-cents problem that the `eager` prompt gets wrong, `cot` gets right — by making the model reproduce arithmetic it can't do "at once" one step at a time.

## Variations that grew from this paper

- **Zero-shot CoT:** prepend *"Let's think step by step"* — no examples at all. Shockingly effective (Kojima et al., 2022).
- **Self-consistency:** sample several reasoning chains and take a majority vote over final answers (Wang et al., 2022) — often worth +10 points.
- **Least-to-most prompting:** decompose a hard problem into subproblems and solve them in order.
- **Tree-of-Thoughts:** maintain a tree of partial solutions and search it (Yao et al., 2023) — the bridge from plain CoT to agentic reasoning.

Two of these ideas resurface in our papers — [ReAct](../papers/react-synergizing-reasoning-and-acting.md) wraps reasoning around *acting*, and self-consistency shows up in [Designing Golden Datasets for Evals](../tutorials/eval-golden-datasets.md).

## Key takeaways

- **Reasoning can be elicited, not just trained**: a few reasoning examples in the prompt unlock multi-step correctness at sufficient model scale.
- The gain is **emergent** — dramatic for large models, negligible for small ones.
- CoT works because it **restores the pretraining distribution** and spreads probability mass over many easy local steps.
- Templates are the whole trick: `Q: … A: <reasoning → answer>`.
- Free, additive improvements: zero-shot CoT ("think step by step") and self-consistency (vote over many chains).

## Read further

- Our tutorial: [Prompt Engineering Basics](../tutorials/prompt-engineering.md)
- Related paper: [ReAct: Reasoning + Acting](../papers/react-synergizing-reasoning-and-acting.md)
- Paper: [arXiv:2201.11903](https://arxiv.org/abs/2201.11903)

## Cite this

```text
@inproceedings{wei2022cot,
  title     = {Chain-of-Thought Prompting Elicits Reasoning in Large
               Language Models},
  author    = {Wei, Jason and Wang, Xuezhi and Schuurmans, Dale and
               Bosma, Maarten and Ichter, Brian and Xia, Fei and Chi, Ed
               and Le, Quoc V and Zhou, Denny},
  booktitle = {Advances in Neural Information Processing Systems},
  year      = {2022}
}
```