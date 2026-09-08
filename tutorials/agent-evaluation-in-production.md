# Evaluating Agents in Production

The first seven tutorials built a lab: datasets, metrics, tool and trajectory checks, judges, and a CI regression pipeline. This tutorial is about the other half of measuring quality — what happens when real users are talking to the agent. Production evaluation is where offline (lab) and online (live) measurements meet, where user feedback and cost matter as much as correctness, and where privacy rules start to constrain what you're even allowed to measure.

## Prerequisites

- The Agent Regression Testing tutorial, for the CI/offline side this one builds on
- The Serving LLM Applications in Production tutorial, for latency, rate limits, and logging
- Basic awareness of privacy regulations (GDPR, HIPAA if relevant) — you'll need to know which apply to you

## Offline vs. online evaluation

The line between the two is the line between lab and production:

| | Offline evaluation (the previous tutorials) | Online evaluation (this tutorial) |
|---|---|---|
| Where it runs | Your test environment / CI | Live traffic, or a copy of it |
| Input source | Curated, fixed dataset | Real user conversations |
| When | After changes, on a schedule | Continuously, on live traffic |
| Truth source | References you wrote | User behavior, outcomes, feedback |
| Strength | Reproducible, cheap to iterate, catches regressions | Captures what users *actually* ask, including what you never imagined |
| Weakness | Dataset goes stale; real-world gaps | Noisy, slow to react, privacy-sensitive |

The balanced system uses both: offline suites for regression discipline, online evaluation to keep the dataset honest and catch drift. Any failure that surfaces online should become an offline regression case — that loop (online discovery → offline case) is the highest-value pattern in this tutorial.

## Production traces

You cannot evaluate production behavior you can't see. Instrument the agent to emit a **trace** for every conversation — the trajectory format from the trajectory tutorial, plus production context:

```python
trace = {
    "conversation_id": "c_9f2a1",
    "ts": "2026-08-09T12:03:44Z",
    "user_message": ...,
    "agent": {"model": "model-v3", "thread_id": "t_44"},
    "steps": [...],              # planning/tool/observation steps, as before
    "final_answer": ...,
    "latency_ms": 4180,
    "tokens": {"prompt": 421, "completion": 210},
    "tool_calls": 3,
}
```

What makes production traces different from lab ones is where they live and who looks at them. They're viewed by people who may not read a CAN-browse-vector and want to inspect unfamiliar flows, stored in a queryable store (`evals.events`), and — most importantly — they're **user data**, so they get redacted (or masked) before they're ever stored or read. Encryption in transit and at rest, retention limits, and access control are part of trace infrastructure, not afterthoughts.

## Monitoring agent quality

Real-time monitoring turns a flood of traces into the small set of numbers an on-call engineer can watch. A starter KPI set for an agent:

- **Tool failure rate** — fraction of tool calls that returned an error. Sudden bumps mean the dependent service changed.
- **Crash-loop rate** — conversations with more than N identical repeated calls (the trajectory failure pattern, at fleet scale).
- **Average / p95 latency per conversation** — the serving tutorial's numbers, per agent.
- **Cost per conversation** — the metric from the metrics tutorial, now computed per thousand conversations.
- **Empty / "I don't know" rate** — sharp changes here usually mean retrieval or grounding broke.

Graph these over time with the model version and prompt version as attributes. When the graph moves, the first question is "what changed in config/deploy/data?" — the same question as the regression tutorial, now visible from the fleet side.

## User feedback

Direct user feedback is the most *ground-truth-adjacent* signal production has:

- **Explicit ratings** — thumbs up/down, star ratings, "was this helpful?"
- **Corrections** — users editing an answer, or rephrasing a question after a bad answer.
- **Conversation abandonment** — user leaves right after an answer: a weak, but free, negative signal.
- **Escalation** — downgrading in follow-up requests to a human, the strongest signal of all.

Online evaluation feeds on these: mark negative-feedback conversations and route them into a **review queue** where a human (or your automated judge, with the calibration discipline from the judge tutorial) labels them. Each confirmed bad case is another offline dataset entry. Feedback rates are noisy and biased (dissatisfied users answer more), so treat them as direction, not measurement — never a headline metric on their own.

## Sampling production conversations

Not every conversation can be judged — the LLM-judge cost alone prevents it. **Sampling** is the bridge between "any amount of traffic" and "a reviewable set":

```python
import random

def should_auto_eval(trace, rate=0.05) -> bool:
    # simple uniform sample; or oversample: errors, tool failures,
    # multi-tool conversations, negative-feedback threads
    return random.random() < rate
```

Better than a uniform sample is to **oversample the interesting slices** — tool failures, multi-tool conversations, negative feedback, and anything new. A typical arrangement: auto-judge a small uniform sample *plus* every flagged conversation, weekly, and feed the failures back into the offline dataset. Your judge catalog can be small (correctness, groundedness, refusal-compliance, tone) as long as it's fixed and recalibrated against human labels on the same cadence as the offline suite.

## Cost and latency evaluation

Production changes the meaning of these metrics. In the lab you measured them per case; in production you measure them per **real distribution of traffic**:

- **Latency budgets** — watch p50/p95/p99 per conversation, plus *where* time goes (model round-trips, retrieval, streaming). A 100 ms tool regression at the 90th percentile of traffic is worth more than a new eval case.
- **Cost per conversation over real mixtures** — your lab cases are biased to be interesting; production traffic is a lot of easy questions. Cost should be reported both for the fleet and separately for the hard slice (multi-tool, long retrieval), so you can budget correctly.
- **Resource ceilings against burst** — the serving tutorial's rate-limit and retry math applies; evaluation here means watching reserved-vs-consumed and alerting early.

The point is that lab cost numbers translate poorly to production, so the production evaluation *is* the real measurement, and the lab numbers are only for change detection.

## Continuous evaluation

Production eval is a **loop, not a dashboard**:

1. **Continuous scoring** — auto-judge sampled conversations on a schedule (real-time for the flagged set, nightly for the uniform sample).
2. **Drift detection** — weekly comparison of online KPI levels to baseline (the regression-comparison habit, now against traffic rather than a frozen suite).
3. **Case ingestion** — every confirmed failure becomes an offline dataset case; the offline suite then guards it from returning.
4. **Canary and shadow checks** — before a full rollout, serve a new model/prompt version to a small slice (or a shadow/labelled copy) and run the regression gate on the live traffic subset. If KPI drops in canary, don't roll out.

The cadence matters more than the sophistication: a small, fast, *always-running* loop beats a large, slow, quarterly one.

## Privacy considerations

Production traces are user data, which changes the constraints from "this is fine to log" to "what may we record, for how long, and who may read it":

- **Redact before storing** — drop PII (names, emails, addresses, IDs) at the trace boundary; that is, tokenize/mask as soon as the conversation object is created, *not* from a cleanup job later.
- **Minimize and retain** — keep only what evaluation actually needs (don't persist full transcripts forever), and set explicit retention limits.
- **Consent and legality** — know which regulations apply (GDPR, HIPAA, etc.) and design consent into the collection, especially if you review transcripts manually.
- **Access control and audit** — limit who can read raw traces; human review of sampled conversations is one of the strongest leaks, so gate it and log it.
- **Separation** — keep evaluation data and analytics separate from the production serving path so a burst in evaluation traffic can never degrade the service.

If any of these sound like they slow you down, that's correct and intended — privacy constraints are part of the production evaluation problem, in exactly the same way tool failures and latency are.

## Practical production workflow

A minimal but complete standing setup:

1. Instrument every conversation to emit a trace (steps, latency, tokens, feedback flags).
2. Stream traces into a queryable store; redact/retain per policy.
3. Weekly: sample (uniform + flagged), auto-judge with the fixed rubric, compute online KPIs (tool-failure rate, p95 latency, cost-per-conversation, refusal rate, feedback rate).
4. Send confirmed failures/ratings-ham human-reviewed queue, then add fixed cases to the offline dataset.
5. Gate every deploy with the regression suite (fast per-commit, full nightly), and gate version changes with a canary that runs online KPIs before full rollout.
6. Monthly: recalibrate the judge against hand-labeled samples, and review whether the KPI set still matches what matters to the product.

## Key Takeaways

- Production evaluation is the loop: online signal (feedback, flags, KPIs) → human/judge label → offline dataset case → regression suite guard.
- Use offline suites for reproducible regression discipline and online evaluation for real-world truth; neither replaces the other.
- Instrument exhaustive traces with redaction-first privacy rules; you can't evaluate what you can't see, and you can't "see" user data carelessly.
- Sample production conversations, oversampling the interesting slice (errors, multi-tool, negative feedback), and auto-judge on a fixed, recalibrated rubric.
- Track cost and latency per real-traffic distribution — p95s and hard-slice costs — not just lab averages.
- Feedback signals are directional; escalate their strongest forms (abandonment, escalation) into a human review queue.
- Prefer a small always-running loop over a large quarterly one; canary new versions against live KPIs before full rollout.

## Wrapping up

This completes the series: fundamentals, datasets, metrics, tool calls, trajectories, judges, regression testing, and now production — one continuous evaluation loop from lab to live traffic and back. The practice from here is the same all eight tutorials have been pointing at: keep measuring, keep feeding failures back into the dataset, and let the numbers drive the decisions.