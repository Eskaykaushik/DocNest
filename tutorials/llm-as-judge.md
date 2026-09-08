# LLM-as-a-Judge for Agent Evaluation

Several tutorials in this series have pointed at "an LLM judge" for the checks that can't be written as substring matches. This tutorial is the full treatment: what LLM-as-a-Judge is, when to reach for it, how to design judge prompts and scoring criteria that actually work, how to get structured JSON out of the judge, and — the part most write-ups skip — where the approach is unreliable and how to keep it honest.

## Prerequisites

- The Agent Evaluation Metrics tutorial — LLM judges produce scores for relevance, groundedness, and other graded metrics
- The Agent Evaluation Techniques tutorial, where the simple yes/no version of this technique first appeared

## What LLM-as-a-Judge means

LLM-as-a-Judge is simple to state: **you use a second LLM call to grade the first agent's output against written criteria.** The judge model receives (some or all of) the question, the agent's answer, and a set of instructions — "score correctness from 1 to 5" — and returns a verdict.

```python
def llm_judge(question: str, answer: str, criteria: str) -> str:
    prompt = f"""
You are grading an AI assistant's answer. Judge strictly against the criteria
and reply with only "yes" or "no".

QUESTION: {question}

ANSWER: {answer}

CRITERIA: {criteria}
"""
    return llm.invoke(prompt)["content"].strip().lower()
```

It exists because a large fraction of what matters about agent output — is this a *good* summary? does the answer *satisfy* the user? is this reasoning *sound*? — cannot be checked with containment strings. A judge is the practical way to run graded checks at scale. Note the two ingredients that always have to be present: **the criteria** and **the strictness instruction**.

## When to use it (and when not to)

LLM judges are for checks that deterministic code can't do. Use them for open-ended quality judgments and for complex, near-linguistic comparisons. Don't use them where a string check or a rule works fine.

| Check type | Example | Deterministic check possible? | Use judge? |
|---|---|---|---|
| Exact/normalized fact | Contains "$8.75" | Yes | No (wasteful) |
| Tool behavior | Called `get_price` with right args | Yes (parse the trace) | No |
| Completeness of coverage | All parts of a multi-part question answered | Often yes (parse intents) | Sometimes |
| Quality / relevance | "Is this a good explanation?" | No | Yes |
| Groundedness (long-form) | "Does every claim come from the source?" | Hard to automate | Yes (judge + claim extraction) |
| Style/tone | "Was the apology genuine and specific?" | No | Yes |

Practical casing: on a 100-case suite, use deterministic checks for the 70 clearly checkable cases and the judge only for the 30 that need judgment. You'll spend a fraction of the API budget and get a noisier-on-the-right-things signal.

## Designing evaluation prompts

A judge prompt has five parts. Every one affects reliability:

1. **Role** — what the judge is ("You are a strict evaluator of AI answers").
2. **The inputs** — question and answer, clearly delimited (use XML-style tags or delimiters as in the prompt-engineering tutorial; the answer is user content and can contain anything).
3. **The criteria** — the exact, checkable definition of "good," written as observable properties, not vibes. "The answer should name the actual returned price and not introduce prices that were not in the tool result" beats "The answer should be accurate."
4. **The output contract** — "Answer with a JSON object," or "Reply with only yes or no." One contract, nothing else.
5. **An optional reference** — what a correct answer looks like, if a dataset case has one.

```python
judge_prompt = f"""
You are a strict evaluator. Judge the assistant's ANSWER to the QUESTION.
Use ONLY the provided tool output to decide groundedness.

<question>{question}</question>
<answer>{answer}</answer>
<reference>{reference}</reference>

CRITERIA
1 point: answer is irrelevant or ungrounded.
2 points: answer is relevant but omits a required part, OR adds a claim
         not supported by <reference>.
3 points: answer is relevant, complete, and fully grounded in <reference>.

Reply with JSON only: {{"score": int, "reason": str}}
"""
```

## Scoring criteria

Beware of fine-grained scales. A 10-point rubric gives the judge more room to wobble than it has meaning; 3–5 points per dimension is the practical sweet spot. Prefer **observed behaviors** over abstractions, and consider scoring multiple dimensions when they genuinely differ ("correctness," "groundedness," "completeness" each get a 1–3 sub-score) so a single number doesn't blur distinct failures.

Whatever you choose, keep the rubric **fixed across runs**. If you change the rubric between versions of your agent, you can't tell whether a score changed because the agent changed or because the judge changed.

## Structured JSON output

A judge that produces prose "I think the answer is pretty good because..." is useless at scale. Require structured output and parse it:

```python
import json

resp = llm.invoke(judge_prompt, response_format={"type": "json_object"})
verdict = json.loads(resp["content"])
# {"score": 3, "reason": "Complete and grounded; no unsupported claims."}

if not {"score", "reason"} <= set(verdict):
    verdict = {"score": 0, "reason": "judge returned malformed output"}
```

Two defensive habits: wrap parsing in error handling (judges occasionally emit extra text or fail the contract), and fail the case rather than guess when the judge output is malformed. A malformed judge result is a loss of the case's signal, and guessing just moves the corruption around.

## Advantages and limitations

**Advantages** — can grade semantics, tone, and faithfulness; scales to hundreds of cases; catches what string checks structurally cannot; and, with a rubric, produces scores you can trend over time.

**Limitations** — costs an API call per judged case; is slower than string checks; produces nondeterministic verdicts run to run; and is itself an LLM, subject to every LLM weakness. Crucially, **the judge is not ground truth** — treat its verdicts as a strong signal that you spot-check against your own reading.

## Bias and judge reliability

Judges come with systematic biases. The ones that matter in practice:

- **Position bias** — grading two answers, the judge prefers whichever is listed first. Neutralize with the rubric name this; in pair comparisons, run both orders.
- **Verbosity bias** — longer answers score higher regardless of content. Say nothing about length in criteria, and add a "verbosity must not affect score" line; consider the same rubric on short and long answers.
- **Self-preference** — a judge has a track record of favoring answers that match the judge model's own style. Using a different model as judge than the agent you're evaluating dilutes this.
- **Sycophancy / style over substance** — confident, well-formatted answers beat correct-but-humble ones. Explicit criteria help more than any bias fix.
- **Rubric vagueness** — the judge reader, like a human, produces whatever a vague rubric leaves unspecified. Every point on the scale must be observable.

The reliability practice that fixes most of these: **calibrate your judge.** Take 20 cases you have already hand-labeled, run the judge, and measure agreement (e.g., what fraction of the judge's verdicts match your labels). If agreement is below what you'd trust, rewrite the rubric — vague criteria are the #1 cause of judge unreliability, and tightening them is the whole fix.

```python
def judge_agreement(labels: list[bool], verdicts: list[bool]) -> float:
    return sum(a == b for a, b in zip(labels, verdicts)) / len(labels)
# 20 hand-labeled cases, 0.2 of verdicts mislabeled -> agreement 0.8
```

## Combining deterministic checks with LLM judges

Judges are expensive and noisy at the edges; deterministic checks are fast, free, and exact. The winning structure is a **pipeline**:

1. Deterministic checks first (substring, tool-call, order, call-count).
2. If those fail — fail the case, no judge needed.
3. Only the cases that passed the cheap checks reach the judge for graded quality.

```python
def evaluate(case, trace) -> dict:
    if not deterministic_passes(case, trace):          # e.g. expected tool missing
        return {"verdict": "fail", "stage": "deterministic"}
    score = llm_judge(case["question"], trace.final_answer,
                      case.get("criteria",
                               "Complete, relevant, grounded, no unsupported claims."))
    return {"verdict": "pass" if score.get("score", 0) >= threshold else "fail",
            "stage": "judge", "score": score}
```

Same lesson as the metrics tutorial restated: cheap checks first, expensive judgment only where it adds value.

## Key Takeaways

- LLM-as-a-Judge is a second model grading the agent's output against written criteria — for what deterministic checks can't judge.
- Use it only where string/rule checks can't; keep it off checks that are cheaply exact.
- Judges have five prompt ingredients (role, inputs, criteria, output contract, optional reference). Criteria must be observable, not vibes.
- Prefer 3–5-point rubrics per dimension, fixed across runs, and require structured JSON output that you parse defensively.
- Bias is real: position, verbosity, self-preference, and style-over-substance; calibrate the judge against hand-labeled cases and track agreement.
- Pipeline it: deterministic checks first, judge only for what's left — cheaper and less noisy.
- The judge is a strong signal, never ground truth; spot-check its output periodically.

## Wrapping up

You can now build reliable graded judgments. The next tutorial, Agent Evaluation and Regression Testing, assembles everything so far — dataset, metrics, tool checks, trajectories, judges — into the pipeline that answers the question you actually care about: "did my change make the agent better or worse?"