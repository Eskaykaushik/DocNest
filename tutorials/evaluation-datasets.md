# Building Evaluation Datasets for AI Agents

Every evaluation is only as good as its dataset. Run the most sophisticated LLM judge in the world against ten happy-path questions and you will get confident, useless numbers. This tutorial is about building the dataset itself: what goes into a single test case, which categories of cases you need, and how to keep the dataset from rotting as your agent changes.

## Prerequisites

- Basic Python and JSON — you should be able to read a dictionary and a list
- Familiarity with the concept of an evaluation dataset from the Agent Evaluation Fundamentals tutorial

## What an evaluation dataset is

An evaluation dataset (an "eval set") is a **fixed, curated collection of tasks you run your agent against every time you want to know if it's working**. Fixed is the important word: the point is comparability, so the dataset should change only in deliberate, tracked ways.

Each item in a dataset represents a task a real user might give the agent, together with everything you need to judge whether the agent handled it. Because agent behavior is nondeterministic, a good case specifies *how to check* the result, not just what the question is.

## Golden datasets

A golden dataset is an eval set where each case carries reference expectations — the "answer key." The reference can be a full expected answer, but more usefully it lists the *properties* the agent's behavior must have:

```python
golden_case = {
    "prompt": "How much does a Gizmo 3000 cost?",
    "expected_tool": "get_price",
    "expected_args": {"product_id": "gizmo-3000"},
    "answer_must_contain": "8.75",
    "answer_must_not_contain": ["in stock"],  # irrelevant claim introduced
}
```

Note that these expectations are checkable properties (tool + args + required/forbidden text) rather than an exact output string. With enough cases like this, you can compute pass/fail automatically, which is what makes the dataset useful for regression testing later in this series.

## Test-case structure

A well-structured case makes failures easier to diagnose and the dataset easier to maintain. A useful field set for an assistant that uses tools:

```json
{
  "id": "price-gizmo-3000",
  "task": "How much does a Gizmo 3000 cost right now?",
  "expected_tool_calls": [
    {"tool": "get_price", "args": {"product_id": "gizmo-3000"}}
  ],
  "answer_contains": ["$8.75"],
  "answer_not_contains": [],
  "tags": ["pricing", "single-tool"],
  "difficulty": "easy"
}
```

What each field is for:

- **id** — stable, unique, human-meaningful. You will quote it in CI logs and changelogs.
- **task** — the user prompt exactly as a real user might type it.
- **expected_tool_calls** — the reference for tool selection, arguments, and order (covered in depth in the Evaluating Agent Tool Calls tutorial).
- **answer_contains / answer_not_contains** — deterministic text checks for the final answer.
- **tags** — orthogonal labels you can slice results by ("pricing," "with-retrieval," "refusal").
- **difficulty** — lets you weight or compare by complexity later.

You don't need all of these for every case. A refusal case has empty `expected_tool_calls` and a very short `answer_contains`, and that's correct — the reference should be minimal but complete.

## Positive, negative, and edge cases

A healthy dataset covers three broad categories, each catching a different failure class:

- **Positive cases** — normal, expected tasks where the agent should succeed. These catch "the happy path broke."
- **Negative cases** — inputs where the correct behavior is to *not* do the thing asked: refuse, say "I don't know," or ask a clarifying question. "Stub the price of a product that has none" is a negative case for `get_price`.
- **Edge cases** — unusual but legitimate inputs: very long prompts, typos, missing information, products with edge-case names ("Gizmo-3000-deluxe?"), numbers formatted oddly.

| Category | Example task | Correct behavior |
|---|---|---|
| Positive | "How much does a Gizmo 3000 cost?" | Call `get_price`, report `$8.75` |
| Positive | "Summarize this error message" | Short, faithful summary |
| Negative | "Tell me the price of this nonexistent product" | Say it has no price / not found, or use the lookup and report absence |
| Negative | "What's the password for the admin panel?" | Refuse, don't guess |
| Edge | "gizmo 3000 price" (no punctuation, lowercase) | Still resolve correctly |
| Edge | "How much do gizmo 3000 and widget 7 cost?" | Two tool calls, both prices reported |

Most teams get the positive cases right and neglect the other two — which is exactly why their eval looks green while real users hit failures.

## Creating representative agent tasks

The best source for tasks is **real usage**, not your imagination. If you already have an agent in production, mine its logs for the most common question types. If you're pre-launch, write tasks from the perspective of the user story your agent serves, and get product people to review them.

Beyond sourcing, aim for *coverage* — a map of the important behaviors, with at least one case on each axis:

- **Intent types**: lookup, calculation, multi-step, tool coordination, summarization, refusal, clarification, small talk.
- **Tool coverage**: every tool appears in positive and negative roles.
- **Knowledge domain**: the areas your agent is supposed to be authoritative on.
- **Failure modes you care about**: hallucination, over-eager tool use, incomplete answers.

A useful rule of thumb: when the agent fails on a real user message, **add that message to the dataset** (sanitized if needed). The dataset then documents the failures you've fixed, and prevents them from coming back. This one habit does more for quality than any amount of careful initial design.

## Example JSON dataset

A small but realistic dataset for a product-support agent:

```json
[
  {
    "id": "price-widget-7",
    "task": "How much is a Widget 7?",
    "expected_tool_calls": [{"tool": "get_price", "args": {"product_id": "widget-7"}}],
    "answer_contains": ["$"],
    "answer_not_contains": [],
    "tags": ["pricing"],
    "difficulty": "easy"
  },
  {
    "id": "multi-price-question",
    "task": "What do gizmo 3000 and widget 7 cost together?",
    "expected_tool_calls": [
      {"tool": "get_price", "args": {"product_id": "gizmo-3000"}},
      {"tool": "get_price", "args": {"product_id": "widget-7"}}
    ],
    "answer_contains": ["$"],
    "answer_not_contains": ["rug"],
    "tags": ["pricing", "multi-tool"],
    "difficulty": "medium"
  },
  {
    "id": "missing-product-refusal",
    "task": "Get me the price of the nonexistent turbo washer.",
    "expected_tool_calls": [{"tool": "get_price", "args": {"product_id": "turbo-washer"}}],
    "answer_contains": ["not found", "no"],
    "answer_not_contains": [],
    "tags": ["refusal"],
    "difficulty": "medium"
  },
  {
    "id": "no-tool-small-talk",
    "task": "Thanks, that was helpful!",
    "expected_tool_calls": [],
    "answer_contains": ["welcome", "glad"],
    "answer_not_contains": [],
    "tags": ["small-talk"],
    "difficulty": "easy"
  }
]
```

Store this as `evals/cases.json`, load it with one function, and your runner (whatever form it takes) never has to know what the cases contain.

## Dataset maintenance and versioning

Datasets rot. The product changes, the catalog changes, users change how they talk. Treat the eval set like code:

- **Version it.** Keep it in git next to the agent code. Every change is a diff you can review.
- **Add from failure.** Every real failure that you fix becomes a new case. This is the single highest-value maintenance rule.
- **Prune stale cases.** When a case no longer matches reality (a product was discontinued), update or remove it — and say so in the changelog, because old cases silently drag scores down.
- **Leave a paper trail.** A one-line `evals/CHANGELOG.md` entry per dataset change keeps "why did accuracy dip?" answerable.
- **Keep a schema.** Version the case format itself so a format change doesn't silently invalidate old cases.

A dataset that is versioned and grown-from-failure quickly beats a large dataset that was written once and never touched again.

## Key Takeaways

- The eval set is the foundation of everything: its quality caps the quality of every score you compute.
- A good case specifies checkable properties — expected tool calls, required and forbidden text — not an exact answer string.
- Cover positive, negative, and edge cases; negative cases (refuse / "I don't know") catch real failure modes that happy-path evals miss.
- Build tasks from real usage where possible, and add every fixed failure to the dataset.
- Version the dataset like code, prune stale cases, and document changes.

## A practical checklist

Find your agent and answer these ten questions:

- [ ] I can list the 10 most common real user questions it receives.
- [ ] Every tool it owns appears in at least one positive case.
- [ ] There is at least one negative case per tool ("request impossible data").
- [ ] There are edge cases: typos, odd formatting, very long or very short prompts.
- [ ] At least one case asserts the agent should *not* call a tool.
- [ ] Every case has a stable, unique id.
- [ ] The dataset is stored in version control.
- [ ] New cases can be added without touching the runner code.
- [ ] Stale cases get removed or updated, not ignored.
- [ ] The dataset reflects at least three real failures your agent has had.

## Wrapping up

You now have a dataset that is structured, representative, and maintainable — the raw material every evaluation needs. The next tutorial, Agent Evaluation Metrics, covers how to turn per-case results into the numbers that actually guide decisions (task success rate, groundedness, latency, and more).