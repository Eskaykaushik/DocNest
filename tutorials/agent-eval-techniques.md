# Agent Evaluation Techniques

Building an agent (as in the LangChain and LangGraph tutorials) is only half the problem. The other half — often the harder half — is knowing whether it actually works, and whether a change you made made things better or worse. This is called **evaluation**, or "evals" for short.

Evaluating agents is genuinely different from evaluating traditional software. Normal code either passes a test or it doesn't — the output is deterministic. LLM-based agents produce different phrasing every time, may call tools in a different order, and can be "close to right" in ways that are hard to check with a simple `assert answer == expected`. This tutorial covers the core techniques for evaluating agents properly, from simple manual checks to automated pipelines.

## Prerequisites

- Comfort with basic Python
- Some familiarity with what an agent is (see the LangChain tutorial) — this tutorial assumes you already have one built
- No prior evaluation experience needed

## Why "just look at the output" doesn't scale

When you're building an agent, it's natural to test it by running a question, reading the answer, and deciding "yes, that looks right." This works fine for one or two examples. It breaks down fast for a real reason: once you have even 20–30 test questions, manually re-reading every answer every time you change a prompt or a tool becomes slow and error-prone — and you'll start unconsciously skipping cases, which is exactly when regressions slip through unnoticed.

The goal of proper evaluation is to make this process **repeatable and automatic**, so you can change something in your agent and immediately know, with numbers, whether it got better or worse — the same way a test suite works for regular code, adapted for the fact that LLM outputs aren't exactly reproducible.

## Technique 1: Golden datasets

A golden dataset is a curated list of realistic inputs paired with what a *correct* (or acceptable) output looks like. This is the foundation everything else builds on.

```python
golden_dataset = [
    {
        "question": "How much does a gizmo cost?",
        "expected_tool_call": "get_price",
        "expected_answer_contains": "$8.75",
    },
    {
        "question": "Is the gadget in stock?",
        "expected_tool_call": "get_stock",
        "expected_answer_contains": "0 units",
    },
    {
        "question": "What's the capital of France?",
        "expected_tool_call": None,  # this shouldn't need a tool at all
        "expected_answer_contains": "Paris",
    },
]
```

Notice the third example: a good golden dataset doesn't only test "does the agent get the right answer" — it also tests "does the agent correctly decide *not* to call a tool" when one isn't needed. This is a very common failure mode: agents that call tools too eagerly, even for questions they could answer directly.

Building a genuinely useful golden dataset means covering more than the happy path:

- **Typical cases** — the kind of question you expect most often
- **Edge cases** — ambiguous phrasing, missing information, unusual inputs
- **Adversarial cases** — questions designed to trick the agent into calling the wrong tool or hallucinating an answer
- **Negative cases** — questions where the *correct* behavior is to say "I don't know" or ask a clarifying question, rather than guess

## Technique 2: Exact-match and containment checks

The simplest automated check: does the output contain what it should?

```python
def check_contains(actual_answer: str, expected_substring: str) -> bool:
    return expected_substring.lower() in actual_answer.lower()

def run_eval(agent, golden_dataset: list[dict]) -> float:
    passed = 0
    for case in golden_dataset:
        result = agent.run(case["question"])
        if check_contains(result, case["expected_answer_contains"]):
            passed += 1
        else:
            print(f"FAILED: {case['question']}")
            print(f"  Expected to contain: {case['expected_answer_contains']}")
            print(f"  Got: {result}")
    return passed / len(golden_dataset)

accuracy = run_eval(agent, golden_dataset)
print(f"Accuracy: {accuracy:.0%}")
```

This is intentionally simple — it just checks whether an expected substring shows up in the response. It won't catch every kind of failure (an answer can technically contain the right substring while being wrong in other ways), but it's fast, free (no extra API calls), and catches a surprising number of real regressions. Always start here before reaching for anything fancier.

## Technique 3: Checking tool-call behavior, not just final answers

For agents specifically (as opposed to plain LLM calls), *how* the agent arrived at an answer matters as much as the answer itself. An agent that gets the right final answer by calling the wrong tool, or by guessing instead of calling a tool at all, is not actually working correctly — it just got lucky on that particular question.

```python
def check_tool_usage(agent_trace: list[str], expected_tool: str | None) -> bool:
    tools_called = [step for step in agent_trace if step.startswith("tool_call:")]
    if expected_tool is None:
        return len(tools_called) == 0
    return any(expected_tool in step for step in tools_called)
```

This assumes your agent framework exposes some kind of trace or log of what it did internally — LangChain's `verbose=True` output (from the earlier tutorial) is exactly this kind of information, just meant for human reading rather than automated checking. Many frameworks also expose this as structured data (a list of steps) rather than printed text, which is easier to check programmatically.

Checking tool usage this way catches a specific and common bug: an agent that happens to already "know" an answer from its training data and skips calling the tool that should have been the source of truth. This looks fine on that one question, but is a real correctness problem — it means the agent isn't actually grounding its answers in your data.

## Technique 4: LLM-as-judge

Substring matching breaks down for open-ended questions where there's no single "correct" phrasing — for example, "Summarize this document" or "Explain why the gadget is out of stock." For these, a common technique is to use a *second* LLM call to judge the quality of the first agent's output.

```python
def llm_judge(question: str, answer: str, criteria: str) -> bool:
    judge_prompt = f"""
    Question: {question}
    Answer: {answer}
    Criteria: {criteria}

    Does the answer meet the criteria? Reply with only "yes" or "no".
    """
    result = llm.invoke(judge_prompt)
    return "yes" in result.content.lower()

is_good = llm_judge(
    question="Why is the gadget out of stock?",
    answer=result,
    criteria="The answer should mention that stock is 0 units and not make up a reason that wasn't in the data.",
)
```

This technique is powerful because it can evaluate things substring-matching simply can't — tone, completeness, whether the agent made something up. But it comes with real caveats worth being explicit about:

- **It costs an extra API call per evaluation**, which adds up if you're running hundreds of test cases regularly.
- **The judge itself can be wrong or inconsistent.** Treat LLM-as-judge as a strong signal, not absolute ground truth — spot-check its judgments against your own reading periodically.
- **Vague criteria produce vague judgments.** The more specific and checkable the `criteria` string is, the more reliable the judge's answer will be — this is the same lesson as writing good tool docstrings, applied to evaluation.

## Technique 5: Regression testing across changes

The real payoff of all of the above comes when you combine them into a single pipeline you re-run every time you change something — a new prompt, a new tool, a different model version.

```python
def full_eval_report(agent, golden_dataset: list[dict]) -> dict:
    answer_accuracy = run_eval(agent, golden_dataset)
    # tool_accuracy would use check_tool_usage across the dataset, following the same pattern
    return {
        "answer_accuracy": answer_accuracy,
        "total_cases": len(golden_dataset),
    }

before = full_eval_report(agent, golden_dataset)
# ... make a change to your agent, e.g. edit a tool's docstring ...
after = full_eval_report(agent, golden_dataset)

print(f"Before: {before['answer_accuracy']:.0%}")
print(f"After:  {after['answer_accuracy']:.0%}")
```

Running this before and after every meaningful change turns "I think this prompt tweak helped" into "this prompt tweak took accuracy from 78% to 85%, but dropped tool-call correctness by two cases — worth checking why before shipping it." That shift, from gut feeling to measurement, is the entire point of building an eval pipeline in the first place.

## Common pitfalls

| Symptom | Likely cause | Fix |
|---|---|---|
| Eval accuracy looks great but the agent still fails in real use | Golden dataset only covers happy-path questions | Add edge cases, adversarial cases, and "should say I don't know" cases |
| Eval results are different every run, even with no code changes | Model temperature isn't set to 0 during evals | Set `temperature=0` specifically for the agent being evaluated |
| LLM-as-judge gives inconsistent verdicts on the same answer | Judging criteria is too vague or subjective | Rewrite criteria as a specific, checkable statement |
| Substring check fails even though the answer is clearly correct | Expected phrasing was too rigid (e.g. expecting "$8.75" but agent wrote "eight dollars and seventy-five cents") | Loosen the check, or use LLM-as-judge for cases where phrasing legitimately varies |
| Eval pipeline takes too long to run regularly | Every case uses a slow LLM-as-judge call | Reserve LLM-as-judge for genuinely open-ended cases; use substring/tool checks for the rest |

## Glossary (for quick reference)

- **Golden dataset** — a curated set of test inputs with known-correct (or acceptable) expected outputs.
- **Substring/containment check** — a simple automated check for whether expected text appears in the output.
- **Tool-call check** — verifying an agent used the correct tool (or no tool), not just that its final answer was right.
- **LLM-as-judge** — using a second LLM call to evaluate the quality of an agent's output against stated criteria.
- **Regression testing** — re-running your evaluation pipeline after every change to catch unintended drops in quality.

## Wrapping up

You now have a layered approach to evaluation: golden datasets as the foundation, cheap substring and tool-usage checks for fast automated signal, and LLM-as-judge for the open-ended cases those simpler checks can't cover. A good next step is to take the golden dataset from this tutorial, run it against the agent you built in the LangChain tutorial, and deliberately introduce a vague tool docstring to watch your eval accuracy drop — then fix it and watch the numbers recover.