# Agent Evaluation Metrics

A dataset gives you per-case results; metrics turn them into decisions. This tutorial covers the core metrics used for AI agents — what each one measures, how to compute it, and, just as important, which ones to pick for a given agent. We'll use a shopping-support agent throughout.

## Prerequisites

- The Building Evaluation Datasets tutorial, so the case structure below feels familiar
- Basic Python arithmetic — no math beyond fractions and averages

## From raw results to numbers

Every eval case ends in a verdict (pass, fail, or a score). A metric is just a way of **aggregating many verdicts into a number you can compare across runs**. The discipline here is to know exactly what each number is counting, because a metric you don't fully understand will quietly mislead you.

Two rules apply to all of the metrics below:

1. **Report how many cases you ran.** "87%" is meaningless without "of 30 cases." A drop from 90% on 100 cases to 87% on 30 is noise, not a regression.
2. **Slice, don't just average.** The overall number hides everything interesting. Score by tag, by difficulty, by tool — the average tells you *if* there's a problem, the slices tell you *where*.

## Task success rate

The base metric: **the fraction of tasks the agent completed successfully**, where success is defined per-case in the dataset's reference expectations (expected tools, required answer content, etc.).

```python
success = sum(1 for verdict in verdicts if verdict == "pass") / len(verdicts)
```

Task success rate is your headline number: the answer to "is the agent working?" but it is coarse. A "success" for an easy small-talk case and a "success" for a hard multi-tool case count identically, so always pair it with slices and the metrics below.

## Accuracy, precision, and recall

For classification-like judgments — *did the agent detect the key fact, or not?* — the classic trio applies:

- **Accuracy** — correct decisions over all decisions.
- **Precision** — of the things the agent flagged/said, how many were right. (Are its confident claims reliable?)
- **Recall** — of the things it should have found/said, how many did it catch. (Does it miss required facts or tools?)

Where this shows up in agents: a support agent that extracts which product a user is asking about. Over 100 real questions:

```python
true_positive = 82   # correct product identified, correctly used
false_positive = 6   # claimed a product link that wasn't requested
false_negative = 8   # missed the product entirely
true_negative = 4    # correctly chose "no product"

precision = true_positive / (true_positive + false_positive)
recall = true_positive / (true_positive + false_negative)
```

High precision means "when it acts, it acts correctly"; high recall means "it rarely misses what it should act on." For a support agent, missing the product (low recall) is usually worse than an occasional extra tool call (lower precision), so you'd weight recall more heavily. The right balance depends on the cost of each error type in your system.

## Relevance

Relevance asks: **is everything in the answer necessary, and nothing necessary missing?** An answer can be correct and still be cluttered with irrelevant retrieved documents or unneeded caveats.

Practical approach: score each answer on a 1–3 or 1–5 scale against a written rubric ("1 = unrelated, 3 = on-topic, 5 = directly answers with nothing extra"), using either a human or an LLM judge (see the LLM-as-a-Judge tutorial). Relevance is a *quality* metric — it deliberately trades a binary pass/fail for a graded, subjective number, so it always needs a clear rubric to be comparable.

## Groundedness (faithfulness)

Groundedness measures whether the answer **stays within the information actually provided to the agent** — the retrieved documents, the tool outputs, the user's own message — instead of adding things from the model's memory.

Grounded in what you passed it:

```python
def is_grounded(answer: str, source: str) -> bool:
    for sentence in answer.split("."):           # naive split for illustration
        claims = extract_claims(sentence)          # your real claim extraction
        if any(claim not in source for claim in claims):
            return False
    return True
```

In practice, claim extraction and "is claim supported by source" are themselves LLM calls (that's again LLM-as-judge territory). The point of the metric is the question it answers: **is the agent hallucinating relative to its sources?** Groundedness is close to relevance but distinct — relevance asks "did it answer the question," groundedness asks "did it make up facts." An agent can be perfectly relevant and badly grounded, and vice versa.

## Tool-call accuracy

For tool-using agents, the mechanics matter as much as the answer. Measure, per case, whether the agent's tool usage matched the reference:

```python
def tool_call_accuracy(case, actual_calls: list) -> bool:
    expected = case["expected_tool_calls"]
    if len(expected) != len(actual_calls):
        return False
    for exp, act in zip(expected, actual_calls):
        if exp["tool"] != act["tool"]:
            return False
        if exp.get("args", {}) != act.get("args", {}):   # exact args, see tool tutorial
            return False
    return True
```

Tool-call accuracy is usually computed as a fraction of cases with *fully correct* tool behavior. It catches the "right answer, broken process" problem from the fundamentals tutorial: an agent can be 100% on final answers while routinely calling the wrong tool and getting lucky. Track this metric separately, and never let it hide inside the success rate. The Evaluating Agent Tool Calls tutorial dedicates a full page to doing this properly.

## Latency and cost

An agent that's correct but slow and expensive is still a product problem.

- **Latency**: track the full conversation time, and specifically **p95/per-token** numbers rather than just the average. A few slow outliers ruin user experience, and averages hide them. Watch how many model round-trips a conversation takes — each one adds seconds.
- **Cost**: measure cost per conversation and breakdown by component (each LLM call, each retrieval). Since model calls and token usage change with versions, cost is a first-class eval metric, not an afterthought.

```python
conversation_cost = sum(
    step["prompt_tokens"] * price.input + step["completion_tokens"] * price.output
    for step in conversation
)
```

## How to choose metrics

Resist collecting everything. A workable default for most agents:

1. **One headline metric** — task success rate. This is the number you chase.
2. **Two or three guardrail metrics** that catch what the headline hides — tool-call accuracy, groundedness, refusals-wrongly-refused — each with a *minimum* rather than a target (e.g., tool-call accuracy must never drop below 90%).
3. **Operational metrics** — p95 latency and cost per conversation, so correctness improvements don't secretly ship slowness.

Gold-plating attack: don't add a metric until a real failure mode needs it. Relevance scores are great, but if your success rate and groundedness are green and no one complains about tone, a relevance rubric is premature.

## Practical examples

Say your 30-case run produces these verdicts:

| Sliced | Cases | Passed | Result |
|---|---|---|---|
| Overall task success | 30 | 24 | 80% |
| Pricing questions | 12 | 11 | 92% |
| Refusals | 4 | 3 | 75% |
| Multi-tool | 9 | 6 | 67% |
| Tool-call accuracy | 30 | 25 | 83% |
| Groundedness passed | 30 | 27 | 90% |
| p95 latency | — | — | 6.8s |
| Cost / conversation | — | — | $0.12 |

The headline says the agent works (80%); the slices say the real problem is multi-tool questions: tool-call accuracy is dragged down there (83% overall, 67% on multi-tool). That points straight at a fix — the multi-step planner and tool-argument handling — instead of random prompt tweaks.

## Key Takeaways

- Metrics turn verdicts into numbers that survive comparison; each one asks a specific question, and you must know which.
- Task success rate is the headline; pair it with guardrails: tool-call accuracy and groundedness.
- Precision/recall matter wherever the agent must decide what to flag; the error cost decides which you weight.
- Relevance is graded (rubric-based), groundedness is about sticking to sources — they measure different things.
- Treat latency (p95, not average) and cost per conversation as first-class metrics.
- Always report case counts and slice results by tag/difficulty/tool; the mean hides everything.
- Add a metric only when a real failure mode needs it.

## Wrapping up

You can now turn eval results into numbers and choose which numbers matter. The next tutorial, Evaluating Agent Tool Calls, is where tool-call accuracy stops being one line and becomes a proper method — correct selection, correct arguments, and correct order.