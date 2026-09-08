# Agent Evaluation and Regression Testing

Everything so far — datasets, metrics, tool checks, trajectories, LLM judges — exists to support one decision: after a change, is the agent better or worse? This tutorial covers **regression testing**: running the same evaluation suite against the same dataset before and after a change, and reading the deltas. It also covers detecting false alarms (because agent evals are noisy), and wiring the whole thing into CI so every change gets measured.

## Prerequisites

- The Agent Evaluation Techniques tutorial, which introduced the before/after pattern — this tutorial makes it rigorous
- The Agent Evaluation Metrics tutorial, for the numbers you'll be comparing
- Basic familiarity with git and the idea of CI/CD

## What regression testing means for AI agents

In normal software, regression testing means: run the test suite, catch when a change broke something that used to work. For agents, the definition is the same, with one crucial difference —

> **You keep the dataset and the checks fixed, re-run them against the same agent, and treat any drop as a regression.**

The "same agent" part is doing work. Because agent output is stochastic, you can't conclude "broke" from one failed run. Regression testing for agents is about making the comparison trustworthy: identical conditions except for the change you're testing.

## Why agent behavior changes

Agent behavior shifts for more reasons than explicit edits, and your regression suite is what exposes all of them:

- **You changed something** — a prompt, a tool's description, a tool's logic, a retrieval chunking rule.
- **The model changed** — a new model version, or a different temperature/sampling setting.
- **The data changed** — new documents in the retrieval store, a product catalog update.
- **The environment changed** — a dependency upgrade, a backend service behaving differently.

You don't have to know which of these happened to run the regression suite. You just have to run it, on a schedule and after every change, and let the numbers tell you something shifted.

## Running the same eval dataset after changes

The discipline is *identical conditions*:

- **Same dataset** (frozen, not edited between runs — dataset edits go through the versioning process from the datasets tutorial).
- **Same checks** — the deterministic rules and the *exact* judge rubric and prompt.
- **Same sampling** — run the agent at `temperature=0` for evals, not the interactive temperature.
- **Same cost ceiling** — run the same number of judge calls; don't silently add or remove them between runs.

```python
def run_suite(agent_version: str) -> dict:
    config = load_config("evals/config.json")   # dataset, checks, judge prompt
    return run_evals(agent_version, **config)

baseline = run_suite(agent_version="v1.3")
deliver()                                          # change something
candidate = run_suite(agent_version="v1.4")
```

The config file is what makes this honest. If the config changes between runs, the comparison breaks, so the config lives in version control on the same commit as the agent code.

## Comparing baseline vs. new version

With results in hand, compare case-by-case:

```python
def compare(baseline: dict, candidate: dict) -> dict:
    moved = {
        case_id: {"before": baseline["verdicts"][case_id],
                  "after": candidate["verdicts"][case_id]}
        for case_id in baseline["verdicts"]
        if baseline["verdicts"][case_id] != candidate["verdicts"][case_id]
    }
    return {
        "before_accuracy": baseline["accuracy"],
        "after_accuracy": candidate["accuracy"],
        "delta": round(candidate["accuracy"] - baseline["accuracy"], 3),
        "changed_cases": moved,      # read these; this is the diagnosis
    }
```

The aggregate delta ("took accuracy from 82% to 88%") is the headline, and the `changed_cases` list is the actual content of the regression report. Every case that flipped is a story: a fix landed, a regression slipped in, or the change traded one failure mode for another. Review flips case-by-case, never just the top-line number.

## Detecting performance regressions (without chasing noise)

One run difference is not a regression. The reasons:

- **Per-case stochasticity** — a case passes one run and fails the next with no code change at all.
- **Small suites** — with 30 cases, one flipped case is a 3.3-point swing in the score, far larger than any real effect you're trying to see.
- **Judge variance** — graded cases flip even when the agent didn't change, because the judge itself is an LLM.

So the practical rules:

- **Run multiple times** and compare distributions (median and range), not single numbers.
- **Look at flip direction.** If five cases flip pass→fail and three flip fail→pass with no code change, treat it as noise, not a regression.
- **Set a threshold and precommit to it.** "We ship if success rate didn't drop by more than 3 points and no high-priority refusal/content-safety case flipped to fail." Write the gate *before* running, so you can't rationalize the result.
- **Failing case ids, not percentages**, when possible. A specific case that went green→red is actionable; a 2-point dip is data.
- **Seed the runs** for full reproducibility when your framework supports it, and always fix `temperature=0`.

## CI/CD integration

Once the suite is fast enough to run per commit (or per PR), wire it into CI:

```
[commit] -> [build docs/package] -> [load frozen dataset] -> [run eval suite]
   -> [regression gate: compare to stored baseline]
        -> pass  : merge, update stored baseline
        -> fail  : block merge, attach report to the PR
```

Design decisions that make this workable:

- **Baseline storage.** Keep the last-good results as a committed artifact (e.g., `evals/baseline.json`). The gate diffs the new run against it.
- **A nightly long suite, not just the fast one.** Fast per-commit suite (< a few minutes) catches gross breakage; a fuller suite overnight catches the subtle drift. Don't demand the entire suite per commit.
- **Quarantine known flaky cases.** If a case flip-flops with no code change, mark it flaky and check it separately instead of letting it block everything (or fix the test).
- **Failing the build on agent evals is a policy decision.** For a product with a hard quality bar it's the point; for an exploratory project, route the report to a reviewer instead of hard-blocking. Decide explicitly.

```python
# evals/gate.py — committed alongside the suite
def gate(report: dict, policy: dict) -> bool:
    if report["delta"] <= -policy["max_delta_allowed"]:
        return False
    blocked = {c for c in report["changed_cases"]
               if report["changed_cases"][c]["before"] == "pass"
               and policy.get("never_regress", set()) & {c}}
    return not blocked
```

## Example workflow

A full cycle, end to end:

1. You land a change: "rewrote `get_price` docstring."
2. CI runs the frozen 30-case suite at `temperature=0`, plus the LLM judge on the 12 open-ended cases.
3. The gate compares against `evals/baseline.json`.
4. Result: success rate 82% → 88% (−0%, +6%), tool-call accuracy 83% → 90%, one case flipped pass→fail: `multi-price-question` (args mismatch on `product_id`).
5. The gate passes (within policy), and the report flags `multi-price-question` for review: the new docstring changed the accepted id format, so the *reference args* in that case need updating via the dataset versioning process.
6. Baseline updates; a changelog entry records the case update.

That last step is what makes regression testing self-healing: the suite either proves the change clean, or tells you exactly which assumption changed and where.

## Key Takeaways

- Agent regression testing = frozen dataset + frozen checks, re-run after every change, any drop treated as a regression.
- Behavior shifts come from models, data, and environment too — the suite reports the shift even when you don't know its cause.
- Identical conditions are the whole method: same config, `temperature=0`, same judge prompts, config in version control.
- One run is a sample, not a verdict: rerun, compare distributions, and find the failed case ids rather than chasing percentages.
- Precommit your regression threshold so the gate can't be rationalized after the fact.
- Wire a fast suite into CI per change, keep a fuller suite for nightly runs, and quarantine flaky cases.
- Store baselines as artifacts and review flipped cases individually — that's where the real signal is.

## Wrapping up

You can now measure whether changes help or hurt. The final tutorial in this series, Evaluating Agents in Production, takes all of this beyond your local/test suite: offline eval vs. online monitoring, production traces, sampling real conversations, cost/latency observation, and the privacy rules that apply when evaluation data is real user data.