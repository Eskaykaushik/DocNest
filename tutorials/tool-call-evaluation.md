# Evaluating Agent Tool Calls

Agents are only as good as their tool use. The Agent Evaluation Fundamentals tutorial introduced tool-call checks briefly; this tutorial is the full treatment. We'll cover correct tool selection, correct arguments, correct order, how to handle agent-triggered tool errors, and the especially tricky case of **unnecessary** tool calls — with concrete examples of good and bad behavior.

## Prerequisites

- The Agent Evaluation Metrics tutorial — tool-call accuracy is the metric you'll be computing
- Basic Python, for the comparison snippets
- Familiarity with what a tool call is (the Function Calling with LLM APIs tutorial is the best reference)

## Why tool-use evaluation matters

A final answer can be right while the tool usage underneath it is broken in ways that will bite you later. Consider the difference between a tool use that is *correct* and one that merely *worked this once*. Examples you'll actually see:

- The agent calls `get_price("widget-7")` but the application's price endpoint is keyed on `product_name`, and passing the wrong key works only until a name collision.
- The agent "knows" the answer and skips the tool entirely — fine for that one fact, catastrophic once data changes.
- The agent loops the same failing call forever because the tool's error message isn't fed back to it.

Tool-call evaluation checks **the actions the agent took**, independent of the answer, so these classes of bugs surface before they ship.

## Correct tool selection

The first question per tool call: **did the agent choose the right tool?**

```python
def tool_selection_ok(actual_call, expected_tool) -> bool:
    return actual_call["tool"] == expected_tool
```

Correct selection is necessary but not sufficient. Two common failure modes, both easy to eval for:

1. **Wrong-but-plausible tool.** The agent picks the tool whose description sounds closest ("get_price" for "yearly revenue"). Checking selection catches this.
2. **Tool not needed at all.** The agent calls a tool for a question it should answer directly — the "small talk" case from the datasets tutorial. Test for it explicitly: a case whose reference has *zero* expected tool calls.

Every tool in your agent should appear in at least two eval cases: one where it *must* be called, and one where it must *not* be (a question asking for something it can't provide, or needing no tool at all).

## Correct tool arguments

Choosing the right tool with the wrong arguments is still a failed call. Evaluate arguments at three levels, from cheapest to strictest:

- **Exact match** — actual args equal reference args. Strict, catches surprises early, noisy when args legitimately vary.
- **Normalized match** — canonicalize before comparing (strip whitespace, case-fold, coerce numbers). Handles `"widget-7"` vs `"widget 7"` and `8.75` vs `"8.75"`.
- **Task-equivalent match** — reference describes what the call must achieve, and any arg set that achieves it passes. This is the pragmatic default for most evals.

```python
def args_ok(actual_args, expected_args, mode="task-equivalent") -> dict:
    matches = []
    for key, expected in expected_args.items():
        actual = actual_args.get(key)
        if mode == "exact":
            ok = actual == expected
        elif mode == "normalized":
            ok = normalize(actual) == normalize(expected)
        else:  # task-equivalent: you provide an equivalence fn per tool
            ok = equivalent(key, actual, expected)
        matches.append({"arg": key, "ok": ok, "expected": expected, "actual": actual})
    return {"passed": all(m["ok"] for m in matches), "details": matches}
```

The reference args in your dataset are where you encode the contract — which key holds the price, which id scheme to use. When a tool's contract changes, the dataset changes, and every eval run re-validates the whole agent against the new contract.

## Tool-call order

For an agent with a multi-step task, the **sequence** of calls is part of the behavior. Order is typically checked as a *constraint*, not an exact sequence, because agents legitimately vary how they decompose work:

- **Prerequisite constraints** — "never call `checkout` before `get_cart_shipping`." Encode as: a tool event requiring that another tool ran earlier.
- **Exact-sequence cases** (occasionally)** — for flows where order is truly fixed, like auth-then-fetch.

```python
def prerequisite_passed(calls, must_precede: tuple[str, str]) -> bool:
    idx = {call["tool"]: i for i, call in enumerate(calls)}
    before, after = must_precede
    return before in idx and after in idx and idx[before] < idx[after]
```

Fine-grained order checks are high-value for agents with business flows (booking, checkout) and low-value for simple lookups. Apply them where order has consequences.

## Handling tool errors

Tools fail: timeouts, missing records, bad data. The evaluation question is **how the agent responds when a tool errors**, and there are three distinct axes:

1. **Error propagation** — does the tool's error message reach the agent as input (vs. being swallowed)? A tool that returns a bare `null` on failure gives the agent nothing to reason about.
2. **Recovery behavior** — after an error, does the agent retry sensibly (fix args, try a fallback tool) or crash-loop? Crash loops burn latency and money and are a common production incident.
3. **Honest reporting** — when the tool genuinely can't do the job, does the agent say so, or fabricate a result?

```python
def crash_loops(calls) -> bool:
    return len(calls) > 5 and len({c["id"] for c in calls}) < 2  # same call, again and again
```

Design eval cases where your tools return errors deliberately: a service that's "down", a product that doesn't exist, malformed input. A dataset that never exercises tool failure will not tell you how your agent behaves when it matters.

## Unnecessary tool calls

The subtle one. The agent answers correctly *and* calls the right tool with the right args — but the tool call was pointless: the answer was already in the user's message, in earlier context, or in a previous tool result.

```python
def tune_calls(agent) -> None:
    agent.tools["get_price"].instrument = lambda: _last_price  # hypothetical prior result
    print("Do not actually write code like this — instrument your framework's logging instead.")
```

By far the cleanest way to eval this is through **trajectory-level checks**: how many tool calls did the agent make, and were all of them load-bearing? Count calls per case and compare with the reference. A case answered in one call that takes three is doing unnecessary work even if every call is individually correct. Efficiency of this kind is the heart of the Trajectory Evaluation tutorial.

## Examples of good and bad tool usage

Same user question, five different behaviors. "What do gizmo 3000 and widget 7 cost together?"

| Behavior | Tool calls | Verdict | Why |
|---|---|---|---|
| Lookup both, sum, report | `get_price` ×2 | Good | Correct selection, args, order; single purpose |
| Sums from memory, no calls | — | Bad | **Un**grounded; correct only until prices change |
| `get_price("gizmo-3000")` only, invents widget's price | `get_price` ×1 | Bad | Missing tool call + hallucinated number |
| `get_price` → `get_price` → `get_price` same product | `get_price` ×3 | Bad | Repeats a successful call; wasteful |
| `get_brand_info` then `get_price` ×2 | +`get_brand_info` | Bad | Unnecessary extra tool; right answer, sloppy path |
| Calls `get_price`, tool errors, then answers "can't get prices right now" | `get_price` ×1 | Good | Properly surfaces a real tool failure |

Note how the *final answer* is right in four of the five bad rows. That's the entire argument for tool-level evaluation.

## Practical checks

A minimal runner that computes tool-call accuracy, argument correctness, order constraints, and crash-loops from a trace:

```python
from dataclasses import dataclass

@dataclass
class Trace:
    calls: list[dict]      # [{"id", "tool", "args", "error"}]
    final_answer: str

def evaluate_tool_use(trace: Trace, case: dict) -> dict:
    expected = case["expected_tool_calls"]
    select_ok = len(trace.calls) == len(expected) and all(
        a["tool"] == e["tool"] for a, e in zip(trace.calls, expected)
    )
    return {
        "selection_order": select_ok,
        "args_ok": all(args_ok(a["args"], e.get("args", {}))["passed"]
                       for a, e in zip(trace.calls, expected)),
        "crash_loop": any(
            len([c for c in trace.calls if c["id"] == cid]) > 5
            for cid in {c["id"] for c in trace.calls}
        ),
        "answer": trace.final_answer,
    }
```

## Key Takeaways

- Evaluate tool use on four axes: correct tool, correct args (normalized/task-equivalent by default), correct order (usually as constraints), and sensible error handling.
- Test selection on two sides: the tool that must be called, and the tool that must *not* be.
- Deliberately provoke tool errors in your dataset to see how the agent recovers — and check for crash loops.
- Unnecessary tool calls are a correctness-adjacent bug: count and reason about every call, not just the last one.
- The final answer being right proves nothing about the process; tool-call accuracy must be tracked separately.

## Wrapping up

Tool-call evaluation checks individual actions. The next tutorial, Evaluating Agent Trajectories, zooms out to the whole sequence of actions an agent takes — planning, acting, observing — to judge whether the *path* was a good one even when every individual call was fine.