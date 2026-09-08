# Designing Golden Datasets for Evals

The first tutorial in this series ("Agent Evaluation Techniques") introduced golden datasets as the foundation of everything else. This tutorial goes deeper: what actually makes a golden dataset *good*, how to build one that scales past a handful of hand-written questions, and how to keep it from rotting as your agent grows.

## Prerequisites

- The "Agent Evaluation Techniques" tutorial (this builds directly on it)
- Comfort with basic Python
- An agent you can run headlessly (so evals can be automated)

## What "coverage" actually means

A common mistake is measuring a golden dataset by its size. "We have 400 test questions" sounds great until you realize 380 of them are the same shape — a straightforward retrieval question with one right tool and one right answer. Your eval looks full and catches almost nothing.

Coverage is not count. A good dataset deliberately spans several *dimensions* of behavior you care about. For an agent, the useful dimensions are:

| Dimension | Question it answers |
|---|---|
| Task type | Retrieval, computation, conversation, refusal — does it do each one? |
| Tool routing | Does it pick the *right* tool for each category of request? |
| Information state | Fully-specified, missing information, ambiguous, contradictory |
| Failure behavior | How it handles "I don't know", errors, and unsupported requests |
| Edge conditions | Empty inputs, maximal length, unusual casing, punctuation, non-English |

A dataset with 30 cases that covers each cell in that grid will catch more real regressions than 300 cases of the same happy path.

## The four-case building block

The overview tutorial mentioned happy, edge, adversarial, and negative cases. Let's make that concrete and *explicit* in the dataset itself, because documenting a case's intent is what lets you review and maintain it later.

```python
from enum import Enum
from dataclasses import dataclass

class CaseType(Enum):
    TYPICAL = "typical"          # the common, expected request (90% of traffic)
    EDGE = "edge"                # unusual but valid input
    ADVERSARIAL = "adversarial"  # designed to expose a known weak spot
    NEGATIVE = "negative"        # correct behavior is to refuse / say "I don't know"

@dataclass
class EvalCase:
    question: str
    case_type: CaseType
    expected_tool: str | None
    expected_answer_contains: str | None = None
    notes: str = ""
```

Two things worth noticing: the `case_type` is stored on the case, and there's a `notes` field. The notes field is cheap now and expensive later — six months from now you will not remember why #42 expects `get_stock` and not `get_price`. Write the intent down at creation time.

```python
golden_dataset = [
    EvalCase(
        question="What does laptop model X-200 cost?",
        case_type=CaseType.TYPICAL,
        expected_tool="get_price",
        expected_answer_contains="$1,299",
        notes="Most common query shape: one product, one price lookup.",
    ),
    EvalCase(
        question="Price for the x-200?",
        case_type=CaseType.EDGE,
        expected_tool="get_price",
        expected_answer_contains="$1,299",
        notes="Case-insensitive model name — tests the entity extraction.",
    ),
    EvalCase(
        question="What's cheaper, the X-200 or the Y-400?",
        case_type=CaseType.ADVERSARIAL,
        expected_tool="get_price",
        expected_answer_contains="X-200",
        notes="Two lookups in one turn; agents often only call the tool once.",
    ),
    EvalCase(
        question="What is the airspeed velocity of an unladen swallow?",
        case_type=CaseType.NEGATIVE,
        expected_tool=None,
        expected_answer_contains="I don't know",
        notes="Out of domain — must refuse, not hallucinate a product.",
    ),
]
```

## Density over raw count

Every case in the dataset has a *cost*: each run costs tokens and time, each failure takes attention to triage, and each edit takes effort to keep aligned with the real product. That's a strong argument for density — one case that exercises two behaviors beats two cases that exercise one each, but only when the two behaviors clip together naturally.

```python
# One case, two checkable behaviors: the *correct tool* AND *no spurious second call*.
EvalCase(
    question="Is the X-200 in stock, and how much is it?",
    case_type=CaseType.TYPICAL,
    expected_tool="get_stock",
    expected_answer_contains="in stock",
    notes="Two questions; the failure mode being guarded is calling get_price too.",
)
```

Be careful not to over-pack cases, though. If a case checks five things and fails, you've learned *that* something broke, not *what*. Keep the "one primary behavior, a couple of cheap secondary checks" ratio.

## Building the dataset from real traffic

The single highest-value move you can make is to seed the dataset with *real, anonymized* traffic instead of invented questions. Invented questions are systematically easier than real ones — you unconsciously write the cases your agent can already pass. Real traffic has the awkward phrasings, the typos, and the surprising intents that expose real failures.

A lightweight pipeline:

```python
def export_traffic(anonymized_log: list[dict], sample: int = 50) -> list[EvalCase]:
    """Turn logged production questions into dataset drafts.

    anonymized_log: [{"user_query": str, "outcome": str}, ...]
    outcome is one of "answered", "refused", "failed".
    """
    drafts = []
    by_outcome = group_into_buckets(anonymized_log)  # by outcome + tool used

    # Oversample failures: they're the most informative cases.
    for bucket in ["failed", "refused", "answered"]:
        entries = by_outcome.get(bucket, [])
        n = sample // 2 if bucket in ("failed", "refused") else sample // 3
        for entry in entries[:n]:
            drafts.append(
                EvalCase(
                    question=entry["user_query"],
                    case_type=classify(entry),  # heuristic or manual
                    expected_tool=deduce_expected_tool(entry),
                    notes=f"From production log: {entry['outcome']}",
                )
            )
    return drafts
```

The oversampling of failures is deliberate and worth keeping: a case that already passes is a guard; a case that recently failed is an active learning signal. When you fix the bug behind a failed case, promote that case into the golden dataset permanently so the bug can't silently come back.

## Evolving the dataset

A golden dataset is a living artifact, not a once-and-done deliverable. It needs a small, predictable process:

- **Add on every bug fix.** When a bug is fixed, the reproduction case from the incident belongs in the dataset.
- **Prune stale cases.** When a tool is removed or a product line is retired, the cases exercising it now fail for the wrong reason and start feeding you noise. Delete or rewrite them the same change.
- **Rebalance when the traffic mix shifts.** If the dataset has 40% negative cases but real traffic is 2% out-of-domain, your eval score overweights a behavior users rarely hit. Check the distribution every few months.
- **Review the failure list, not just the score.** A 90% pass rate with the same ten cases failing every run is a different situation from a 90% pass rate with ten new random failures. One is a known backlog; the other is a signal your dataset or your fuzz coverage has a hole.

Track dataset health with a couple of raw numbers: total cases, cases per `case_type`, and "percent of cases touched in the last 90 days." The third one is the easy tell that your dataset is being maintained rather than ossifying.

## Sharing sources of truth with the agent

One surprisingly effective trick: generate the golden dataset's *expected answers* from the same structured sources the agent itself reads. If your agent retrieves prices from a database, don't hard-code "X-200 costs $1,299" into your test — pull it from the database the same way, then assert the agent's answer matches.

```python
def expected_price(model_id: str, db) -> str:
    row = db.get(model_id)
    return format_price(row.price)

case = EvalCase(
    question=f"How much is the {model_id}?",
    case_type=CaseType.TYPICAL,
    expected_tool="get_price",
    expected_answer_contains=expected_price(model_id, db),
)
```

This keeps expectations in sync with reality automatically and dramatically reduces the "eval says wrong but it's actually the dataset that's stale" class of false alarms.

## Common pitfalls

| Symptom | Likely cause | Fix |
|---|---|---|
| Dataset "full" but regressions sneak through | All happy-path, same shape | Add explicit edge / adversarial / negative cases and lable their intent |
| Eval score is unstable across runs | Real traffic seeded with non-deterministic behavior | Use `temperature=0` and freezable steps for the agent under test |
| Failing cases are never investigated | No one owns the dataset | Assign dataset reviews to the change that added them; make failures visible |
| Dataset grows forever without updating | Archival habit | Prune/rebalance on every feature change; check distribution quarterly |
| Expectations drift from reality | Hard-coded expected answers | Derive expected values from the same sources the agent reads |

## Wrapping up

The golden dataset is the layer everything else in the eval stack depends on. Getting it right is less about writing more questions and more about coverage across task types, tool routing, information states, and failure behavior — and about treating the dataset as a maintained, living artifact. In the next tutorial we'll look at the open-ended dimension that golden datasets and substring checks can't fully cover, and how LLM-as-judge fills that gap.

## Glossary (for quick reference)

- **Coverage** — the degree to which a dataset exercises different behaviors (not just how many cases it has).
- **Case type** — a label (typical, edge, adversarial, negative) capturing the *intent* of a test case.
- **Density** — combining multiple cheaply-checkable behaviors into one case to keep cost and noise down.
- **Traffic seeding** — building dataset cases from anonymized production logs, oversampling failures.
- **Dataset hygiene** — the ongoing process of adding on bug fixes, pruning stale cases, and rebalancing.