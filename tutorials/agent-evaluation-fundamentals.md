# Agent Evaluation Fundamentals

The Agent Evaluation Techniques tutorial gave you a fast tour of the main tools — golden datasets, substring checks, tool-call checks, and LLM-as-judge. This tutorial steps back and builds the mental model first: what agent evaluation actually is, why it isn't just "software testing with extra steps," and which parts of an agent are worth measuring. The rest of this evaluation series goes deep on each part.

## Prerequisites

- Basic Python, enough to read a small function
- A rough idea of what an agent is (the LangChain tutorial is a good starting point if you need it)
- No prior evaluation experience needed

## What agent evaluation is

Agent evaluation is the practice of **measuring, in a repeatable and automatic way, whether an agent does the job it was built to do**. "Measuring" matters more than it sounds like: an agent that worked once on a demo question tells you almost nothing. An agent that passes twenty realistic questions, every time you change something, tells you a lot.

Concretely, evaluation means keeping a fixed set of tasks, running the agent against them, turning each result into a pass/fail or a score, and aggregating those into numbers you can compare run after run. For a support agent that answers questions about a product catalog, a minimal evaluation might be:

```python
def run_eval(agent, cases: list[dict[str, str]]) -> dict[str, float]:
    passed = 0
    for case in cases:
        answer = agent.run(case["question"])
        if case["expected_substring"].lower() in answer.lower():
            passed += 1
    return {"accuracy": passed / len(cases)}
```

That trivial loop is already an evaluation: a fixed dataset, automatic checking, a number at the end. Everything else you'll see in this series is an improvement on one of those three parts.

## Why evaluating agents is different from testing normal software

Normal software tests work because the behavior is deterministic. The same input produces the same output, so `assert result == expected` is a complete check, and a failure tells you exactly what broke.

Agent outputs are not deterministic, and that changes the whole game:

| Property | Normal software test | Agent evaluation |
|---|---|---|
| Output on the same input | Identical every time | Different phrasing (even at `temperature=0`), possible different tool paths |
| Correctness | Binary: matches expected or not | Graded: "right but wordy," "right by luck," "hallucinated the conclusion" |
| What is checked | Usually the final return value | Final answer **and** the steps taken to reach it |
| Failure diagnosis | The one broken line | A mix of prompt, tools, retrieved data, model choice, or a flaky run |
| Test cost | Near zero | Real latency and API cost per case |

The practical consequence is that you cannot write one `assert` and be done. You check for *properties* of the output ("mentions the price," "calls the lookup tool," "does not contradict the provided data") instead of exact equality, and you accept that a single run is a sample, not a verdict.

## Components of an agent that can be evaluated

An agent is a pipeline of pieces, and each piece can fail independently. When you plan an evaluation, you are choosing which of these components to check:

- **Tools and tool schemas** — are the right tools available, described accurately, and called with valid inputs?
- **Planning and reasoning** — does the agent break the task into sensible steps instead of guessing or rambling?
- **Retrieval and grounding** — does it pull in relevant knowledge, and stick to it, instead of making things up?
- **The final answer** — is it correct, complete, and in the format the user needs?
- **Guardrails and safety** — does it refuse what it should refuse, and handle hostile or ambiguous input gracefully?
- **Latency and cost** — is it fast enough and cheap enough to run at scale?

A common beginner mistake is evaluating only the final answer and calling it done. The tutorials in this series will show you how to evaluate the tools, the trajectories (the steps), and the production behavior too.

## Final-answer evaluation vs. agent/trajectory evaluation

There are two levels of evaluation, and you almost always need both:

- **Final-answer evaluation** asks: did the agent end up with the right output? This is the closest to traditional testing. It answers "did we get the right result?" It misses *how* the result was achieved.
- **Trajectory evaluation** asks: did the agent take the right *path* to the result? Which tools did it call, in what order, with what arguments, and how efficiently?

Why the distinction matters, with a concrete example. Your product-lookup agent is asked "How much does a Gizmo 3000 cost?" and answers "$8.75." That answer is correct. But if the agent arrived at it by:

- calling `get_price("Gizmo 3000")` and reporting the result, or
- calling `get_stock("Gizmo 3000")` and `get_brand_info("Gizmo 3000")`, or
- saying $8.75 from memory without calling any tool,

...then only the first is a working agent. The others happened to be right on this question, but are not reliable in general. Final-answer evaluation alone will not catch that. Trajectory evaluation will.

## A basic evaluation workflow

Every reasonable evaluation follows the same loop, differing only in how each step is done:

1. **Collect realistic tasks** — questions and scenarios that represent what users actually ask.
2. **Define what "correct" looks like** — per task, not per tutorial: the expected tools, the expected facts, what a wrong answer would be.
3. **Run the agent** — with a fixed dataset and, ideally, controlled sampling.
4. **Check automatically** — substring checks, tool-call checks, an LLM judge, or a mix.
5. **Score and aggregate** — turn per-case results into overall numbers.
6. **Iterate** — fix what failed, add the failure to the dataset, re-run.

Notice the loop ends where it started. Every time a case fails, the dataset grows, which is exactly what you want: a good dataset is built from real failures, not invented in advance.

## Simple examples

Start embarrassingly small. Ten to twenty well-chosen cases beat a hundred haphazard ones, because you will actually re-run them. A minimal first dataset for a support agent looks like:

```python
cases = [
    {"question": "How much does a gizmo cost?", "expects_tool": "get_price", "answer_contains": "$"},
    {"question": "Is the gadget in stock?", "expects_tool": "get_stock", "answer_contains": "units"},
    {"question": "Who are you?", "expects_tool": None, "answer_contains": None},  # no tool needed
]
```

Half the value is in the third case: checking that the agent correctly does *not* reach for a tool when one isn't needed. Eager tool use is one of the most common agent failure modes, and it only shows up in your evaluation if you test for it.

## Key Takeaways

- Agent evaluation is the practice of measuring agent behavior with a fixed dataset and automatic checks, so you can compare runs.
- It differs from software testing because agent output is probabilistic, graded, and only partially about the final answer.
- The pieces of an agent — tools, planning, retrieval, final answer, guardrails, cost — each deserve their own checks.
- Evaluate both the final answer (the result) and the trajectory (the path), because a right answer can hide a broken process.
- The evaluation loop — collect tasks, define correct, run, check, score, iterate — is the framework everything else fits into.
- Start with 10–20 realistic cases that include negative cases (where the correct behavior is "no tool call" or "I don't know").

## Wrapping up

You now know what evaluation is, why the usual testing mindset doesn't transfer directly, and which parts of an agent you should be measuring. The next tutorial in this series, Building Evaluation Datasets for AI Agents, turns the "collect realistic tasks" step into something rigorous: how to structure cases, cover the categories that matter, and keep the dataset healthy over time.