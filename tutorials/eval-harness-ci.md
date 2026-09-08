# Building an Eval Harness and CI

The first two tutorials covered the *parts* of an eval practice: golden datasets and LLM-as-judge. This one turns them into a system. A harness is the thing that makes evaluation repeatable — deterministic setup, one command to run, a report you can read, and a gate that actually blocks bad changes. This tutorial walks through building a minimal but real one, then putting it in CI.

## Prerequisites

- "Agent Evaluation Techniques", "Designing Golden Datasets", and "LLM-as-Judge" tutorials
- Comfort with Python and a basic CI workflow (GitHub Actions shown here)
- An agent you can instantiate in tests with `temperature=0`

## What changes when evals become a pipeline

Hand-written eval scripts are fine to learn with, but they share three problems that a harness fixes:

1. **They aren't deterministic.** If the agent under test runs at temperature 0.7, your eval score varies run to run and you can't tell a real regression from weather.
2. **They aren't comparable.** Running "the evals" is different on each machine, each branch. There's no single report format, so nobody reads them.
3. **They aren't gated.** Nothing stops a change that drops accuracy from 78% to 55% from shipping.

The design goal for the harness is narrow: make eval runs *repeatable, comparable, and gated*, with one command.

## Harness layout

A minimal but honest harness is three small pieces: a runner, a reporter, and a gate.

```text
evals/
├── dataset.py        # loads cases, dedupes, validates schema
├── runner.py         # runs the agent across the dataset, collects results
├── reporter.py       # turns results into a markdown/JSON report
├── gate.py           # applies pass/fail thresholds to a report
└── run.py            # `python -m evals` — the one command
```

Keep the runner and reporter separate. You want to re-run old reports against new thresholds without re-running the model, so a report must be computed from a *stored* results file, not only from a live run.

## Determinism first

Everything else is noise if runs aren't deterministic. Two settings matter more than anything:

```python
# runner.py — the parts of determinism that actually matter
llm = create_agent(model="...", temperature=0, seed=42)

# Some providers still have nondeterminism; pin retries + version the model
PINNED_MODEL = "llm-v3-2026-02-01"   # never "latest"
```

- `temperature=0` is the foundation.
- Pinning an exact model version (not "latest") lets you blame a scoring gap on a model change instead of chasing ghosts.
- When you compare "before" and "after" a code change, run both against the *same* pinned model, only then is the diff attributable to your change.

## The runner

```python
# runner.py
def run_dataset(agent, dataset, *, max_turns: int = 8) -> list[dict]:
    results = []
    for case in dataset:
        trace = []
        try:
            answer = agent.run(case.question, max_turns=max_turns, trace=trace)
            results.append(
                {
                    "case": case.question,
                    "case_type": case.case_type.value,
                    "expected_tool": case.expected_tool,
                    "tool_calls": extract_tools(trace),
                    "answer": answer,
                    "ok": None,  # filled by the grader
                }
            )
        except Exception as exc:  # noqa: BLE001 — harness must not crash
            results.append(
                {
                    "case": case.question,
                    "case_type": case.case_type.value,
                    "expected_tool": case.expected_tool,
                    "tool_calls": [],
                    "answer": "",
                    "error": str(exc),
                }
            )
    return results
```

Notice what's recorded: the raw trace and answer on every case, *including* failures and exceptions. A harness that swallows an agent crash into "it failed" loses the diagnostic value; a crash is a category of failure worth distinguishing from a soft wrong answer.

## Scoring and storage

Scoring is a separate step from running — you can re-grade stored outputs without re-running the model (cheap), and you can try a new judge rubric against old answers (invaluable).

```python
# run.py — how it all ties together
from .dataset import load_dataset
from .runner import run_dataset
from .reporter import report_to_json, is_regression

def main(baseline_file: str | None = None, threshold: dict | None = None):
    dataset = load_dataset("data/golden.json")
    results = run_dataset(build_agent(), dataset)

    scored = score_each(results)          # substring / tool checks + LLM judge
    report = aggregate(scored)            # dict: per-dimension + overall

    report_to_json("reports/latest.json", report)
    if baseline_file:
        if is_regression(report, baseline_file, threshold or DEFAULT_THRESHOLD):
            print("EVAL GATE FAILED — see report")
            sys.exit(1)
        print(f"Overall accuracy: {report['accuracy']:.0%} (baseline ok)")
```

Write the report as both JSON (for the gate and CI) and a human-readable Markdown summary (for the PR). The report should record the environment — git SHA, model version, dataset hash — so you can always reconstruct what a number means.

## Compares, not just absolute scores

An absolute score ("84% this run") is hard to interpret without context. The most useful thing a harness can output is the *diff against a baseline*: same dataset, same model, one variable changed (your code).

```python
def is_regression(new_report, baseline_path, threshold):
    baseline = json.load(open(baseline_path))
    for name, allowed_drop in threshold.items():
        before = baseline["metrics"][name]
        after = new_report["metrics"][name]
        if after < before - allowed_drop:
            return True  # failed the gate for this dimension
    return False
```

Thresholds are per-dimension, not just one number. Allowed to drop 2 points on "answer accuracy" but hard-fail on any drop in "faithfulness" (because you'd rather prefix answers get better, tone varies, but hallucination never regresses):

```python
DEFAULT_THRESHOLD = {
    "accuracy": 0.02,     # tolerate a 2-point slip overall
    "faithfulness": 0.0,  # never allow faithfulness to regress
    "tool_fidelity": 0.01,
}
```

## Splitting signal by temperature

A practical compromise when LLM-as-judge cases are expensive: split the dataset into a *fast tier* (substring + tool-call checks only) and a *slow tier* (open-ended, judge-graded).

```python
CASE_TIERS = {
    "fast": ["typical", "edge"],
    "slow": ["adversarial", "negative"],
}

# CI: run the fast tier on every push (cheap, deterministic, seconds)
#      run the full tier nightly or on PRs to the agent's core behavior
```

This gives you a cheap `pull request` gate and a deeper nightly gate, without paying full-judge costs on every keystroke.

## The CI job

A minimal GitHub Actions job that runs the fast tier on every PR and the full tier nightly:

```yaml
# .github/workflows/evals.yml
name: evals

on:
  pull_request:
    paths: ["src/**", "evals/**", "data/golden.json"]
  schedule:
    - cron: "17 3 * * *"   # nightly full run

jobs:
  fast-eval:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -e . && python -m evals --tier fast --baseline reports/latest.json

  nightly-eval:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -e . && python -m evals --full --baseline reports/latest.json
```

Two things to internalize from this example: the eval *baseline* is stored in the repo (`reports/latest.json`) so "did this PR regress anything" is decided by comparing the new run to the repo's last-known-good report; and the fast tier filters the obvious damage before the expensive gate. If the agent's behavior is cheap to change, run fast eval on every touch of agent code and `data/golden.json` — because a dataset change can regress the eval as surely as a code change.

## What to do when the gate fires

A gate that blocks with zero context is just annoying. The report must tell you *what* regressed and where to look:

- Per-dimension scores with before/after deltas
- The list of newly-failing cases (with `case_type` and the tool trace)
- Whether a failing case is a code regression, a dataset staleness, or a judge calibration drift

That last classification is what makes a blocking gate tolerable: if the report says "2 faithfulness regressions, both traces show the new tool skipped get_price", the fix path is obvious. Build the triage distinction into the gate's output.

## Common pitfalls

| Symptom | Likely cause | Fix |
|---|---|---|
| Scores vary between runs/machines | Model not pinned, temperature > 0 | Pin model version + `temperature=0`, record env in the report |
| Gate blocks nothing meaningful | Only one overall number | Per-dimension thresholds, incl. hard-fail dims |
| Can't tell what regressed | No before/after diff in report | Store baseline in repo; report deltas + failing cases |
| Every change is slow | Full judge on every case | Two tiers: cheap filter + expensive nightly |
| Eval "passes" but prod breaks | Dataset stale or judge biased | Dataset hygiene (previous tutorial) + judge calibration |

## Wrapping up

A harness converts evaluation from a thing you do occasionally, by hand, into a repeating system with a single command, a stored baseline, per-dimension gates, and a readable report. Combined with the golden datasets from the second tutorial and the calibrated judge from the third, it closes the loop that "Agent Evaluation Techniques" opened: now a prompt tweak, a tool edit, or a model bump is provably better or worse, before it ships.

## Glossary (for quick reference)

- **Harness** — the runner + reporter + gate that makes eval runs repeatable, comparable, and blockable.
- **Determinism** — pinned models, `temperature=0`, recorded environment so runs are reproducible.
- **Baseline** — the stored "last known good" report a new run is diffed against.
- **Gate** — the per-dimension thresholds that fail CI when a change regresses.
- **Tiering** — splitting the dataset into a cheap fast tier and an expensive slow tier.