# LLM-as-Judge, Done Right

The overview tutorial introduced LLM-as-judge as a technique for everything substring checks can't measure — tone, completeness, faithfulness. This tutorial goes deeper into the parts that determine whether an LLM judge is reliable or a slow, expensive coin flip: design of the judgment task, rubrics, calibration, aggregation, and knowing when not to use a judge at all.

## Prerequisites

- "Agent Evaluation Techniques" and "Designing Golden Datasets" tutorials
- Comfort with basic Python and prompt design
- Access to an LLM API for judge calls

## The judge's core problem

An LLM judge is asking one model to evaluate another model's output against a standard. The judge fails in two ways that matter to you:

1. **It can be wrong in a *stable* way** — the judge consistently prefers longer answers, or consistently agrees with whatever the agent's answer "sounds like." This is a *bias*. It doesn't show up as noisy scores; it shows up as a score that looks meaningful but tracks the wrong thing.
2. **It can be wrong inconsistently** — same input, different verdicts. This is *noise*. It eats your signal and hides real regressions.

Understanding these two failure modes explains almost every design decision below. Rubrics and criteria fight bias; multiple turns and majority voting fight noise.

## Grading on both dimensions

There are two distinct jobs a judge can do — score the *final answer* for quality, and score *how the agent got there* (tools called, reasoning steps, grounding). They need different rubrics. Evaluating an agent purely on its final answer is how you end up with an agent that gets the right answer by calling the wrong tool, or by hallucinating a fact it guessed.

```python
def judge_agent(question, answer, trace, rubric) -> dict:
    judge_prompt = f"""
    You are a meticulous grader for an AI assistant.

    QUESTION: {question}
    FINAL ANSWER: {answer}
    TOOL TRACE: {trace}

    RUBRIC — evaluate ONLY these criteria:
    {rubric}

    Give a score from 1 (fail) to 5 (excellent) for each criterion
    and one short reason per score. Then give ONE overall pass/fail.
    """
    result = llm.invoke(judge_prompt)
    return parse_verdict(result.content)
```

## Rubrics are the whole game

A vague prompt produces a vague judge. "Evaluate the answer quality" asks the judge to invent its own standard on every call — maximum bias and maximum noise. The fix is a rubric: a set of concrete, checkable criteria, ideally each with anchored score definitions.

Anchored scores are the difference between "good / bad" (which every model interprets differently) and "did the answer mention the price AND the warranty, with no invented details" (which is about a fixed fact set).

```python
RUBRIC = """
For each criterion, pick the number from THIS scale and explain in one sentence.

1. Faithfulness (5 = all claims traceable to the tool output or source
   document; 1 = the answer invents facts not in the source):
   SCORE (1-5):

2. Completeness (5 = answers every question asked, including follow-ups
   in the same turn; 1 = misses major parts):
   SCORE (1-5):

3. Tool fidelity (5 = only called tools that the question needs, in a
   reasonable order; 1 = wrong tool, or skips a needed tool):
   SCORE (1-5):

Then ONE final line that is exactly PASS or FAIL, where PASS requires
faithfulness >= 4 and completeness >= 4.
"""
```

Notice the pass/fail line: "PASS requires faithfulness ≥ 4 and completeness ≥ 4." That turns a subjective overall judgment into a deterministic function of the three scores. If the judge's scores say faithfulness=5 completeness=2, the PASS/FAIL is decided by arithmetic, not by the mood of the model that day.

Define a minimal threshold like this, and you get a hard property: score is only ever high when *you* define the important dimensions as high.

## Calibrating a judge before trusting it

Before you let a judge's verdict gate anything, measure the judge against your own judgment on a small held-out set — the same discipline as the golden dataset, applied to the judge itself.

```python
def calibrate_judge(judge, labeled_pairs):
    """labeled_pairs: list of (question, answer, human_label)
    human_label is 'pass' or 'fail'. Returns the judge's agreement rate."""
    agreements = 0
    for question, answer, human_label in labeled_pairs:
        verdict = extract_pass_fail(judge(question, answer, RUBRIC))
        if verdict == human_label:
            agreements += 1
    return agreements / len(labeled_pairs)

agreement = calibrate_judge(judge, labeled_pairs)
print(f"Judge agrees with human judgments {agreement:.0%} of the time")
```

Thirty to fifty carefully chosen pairs is enough to catch a badly-behaved judge. You're not trying to hit 100% agreement — humans disagree with each other on judgment tasks — you're checking that the judge is in the same ballpark as a thoughtful human and, critically, that it's not *systematically* wrong on the cases you care about most (e.g. hallucinated facts).

If agreement is poor, the fix is almost always the rubric, not the model — make the criteria more anchored, tighten the pass/fail rule, give the judge the tool trace so it can check faithfulness.

## Aggregation: single verdicts are noisy

A single judge call on one answer is the noisiest measurement in the whole stack. Two easy wins:

- **Structured scoring over binary verdicts.** Instead of asking "pass or fail", ask for scores per criterion, and decide pass/fail yourself with the threshold. This turns binary noise into a 1–5 signal and you can see *which* dimension degraded.
- **Repeat or majority-vote the judge.** Ask the same question 3 times (with `temperature=0` if your judge supports it, otherwise variance sampling) and take the majority verdict. This is expensive, so reserve it for the edge of your tolerance — the answers judged borderline or for the final gate on new releases.

```python
from collections import Counter

def majority_verdict(judge, question, answer, n: int = 3) -> str:
    votes = Counter()
    for _ in range(n):
        votes[extract_pass_fail(judge(question, answer, RUBRIC))] += 1
    return votes.most_common(1)[0][0]
```

## Judge self-consistency as a dataset property

A useful trick that costs nothing extra in the golden dataset phase: include a handful of cases *twice*, phrased differently but requiring the same behavior, and check that the judge gives the same verdict on both. If the judge says one passes and the other fails, that's a judge instability you want to know about before it starts corrupting your regression signal — while you're still building, not when a production incident sends you back to the whole pipeline.

## When to skip the judge

LLM-as-judge is not a universal hammer. Skip it — and use the cheap substring / tool-call checks from the overview tutorial — when:

- The expected answer is *exactly* determined (a price lookup, a stock count). A judge adds cost and noise for no signal. Check the substring or the tool trace instead.
- You're running evals hundreds of times a day in a tight loop. Reserve the judge for a nightly or per-prerelease sample.
- The criterion can't be made concrete ("answer should feel friendly"). If you can't anchor the rubric, the judge is undefined.

The cost asymmetry is the deciding factor: substring checks are near-free and deterministic; judge calls cost money and add noise. Use the cheap checks to filter, and the judge only on the cases the cheap checks can't decide.

## Common pitfalls

| Symptom | Likely cause | Fix |
|---|---|---|
| Judge always says PASS, evals useless | Rubric has no anchored scores or no threshold rule | Add anchored 1–5 scores and a deterministic pass/fail line |
| Judge prefers long answers | Length bias in the base model | Explicitly include the tool trace + source so facts are checkable; add a "verbosity" criterion |
| Verdicts flip between runs | Noisy single call | Majority-vote, structured scores, deterministic extractor |
| Evals too expensive to run | Judge on every case | Use cheap checks first; judge only borderline / open-ended cases |
| Judge praises hallucinated facts | No faithfulness criterion, no source given | Give the judge the tool trace and define faithfulness as traceability |

## Wrapping up

LLM-as-judge is only as good as the judgment task you give it: anchored rubrics that make pass/fail a function of scores, calibration against human judgment before you trust it, and aggregation to cut noise. Used this way it handles exactly the part of evaluation that deterministic checks can't — deciding whether an open-ended answer is actually *good*. In the final tutorial of this series, we'll wire a golden dataset and a (calibrated) judge into a repeatable, CI-friendly harness that runs on every change.

## Glossary (for quick reference)

- **Bias** — a judge's stable, systematic error (e.g. favoring length). Hides in your score and corrupts it.
- **Noise** — inconsistent judge verdicts on the same input. Eats signal.
- **Rubric** — the concrete, anchored criteria the judge scores against, plus the deterministic pass/fail rule.
- **Calibration** — measuring judge agreement with human judgment on a small labeled set before trusting it.
- **Aggregation** — combining multiple scores or verdicts to reduce noise (structured scoring, majority voting).