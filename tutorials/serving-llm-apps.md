# Serving LLM Applications in Production

Getting an LLM app to work in a notebook is one thing; keeping it fast, cheap, and correct for real users is another. This tutorial covers the production concerns that don't exist in development: latency budgets, rate limits, caching, retries, logging, and the difference between "streaming to the user" and "streaming to yourself." It's deliberately framework-agnostic — the patterns apply whether you're on FastAPI, Flask, or a managed service.

This assumes you've built an agent or RAG pipeline (see the Agent Frameworks and RAG tutorials). Here we care about what happens when strangers start hitting it.

## Prerequisites

- An LLM-backed app that currently runs locally
- Basic familiarity with HTTP services (routes, JSON responses)
- No cloud experience required — everything below applies to a single server too

## The latency reality check

An LLM call is *slow* compared to any normal database query — first-token latency is often 300ms–1s, and full responses take seconds. Your entire architecture should be designed around that one fact. Two habits follow immediately:

- **Never block a request on a call you could defer.** Compute things like analytics, summarization, or enrichment *after* the user gets their answer, not before.
- **Stream every response that can stream.** Waiting for a complete answer before showing anything turns a 4-second experience into a broken one.

A rule of thumb: measure your p50 and p95 first-token latency in the environment you'll actually deploy to, and design your user experience around the p95 — that's what your users will remember, not the p50.

## Streaming: to the user and to yourself

Streaming sends tokens as they're generated. The two directions solve different problems:

- **Stream to the user** (SSE, or WebSockets) so they see progress. Most LLM providers give you a streaming mode that yields chunks.
- **Stream to yourself** means don't wait for the *final* answer to start your post-processing — but be careful: you can't do deterministic work (parsing JSON, calling tools) until the full chunk you need has arrived.

```python
# Pseudocode: SSE endpoint shape, provider-agnostic
async def answer(request):
    stream = llm.stream(request.prompt)   # yields tokens as they arrive
    async for token in stream:
        yield f"data: {token}\n\n"        # each token, flushed to the client
```

The mistake to avoid: wrapping a streaming API call in code that collects the whole response first, then sending it — you've paid the latency cost and gotten none of the UX benefit.

## Rate limits: the resource you'll actually hit

Two independent limits will bite you: **your provider's limits** (requests per minute, tokens per minute) and **your own budget** (what one user should be allowed to trigger, since every call costs money).

Handle both with a few layers:

```python
import time

class TokenBucket:
    """Simple rate limiter: allows `capacity` calls per `refill` seconds."""
    def __init__(self, capacity: int, refill_per_second: float):
        self.capacity = capacity
        self.rate = refill_per_second
        self.tokens = capacity
        self.updated = time.monotonic()

    def allow(self) -> bool:
        now = time.monotonic()
        self.tokens = min(self.capacity, self.tokens + (now - self.updated) * self.rate)
        self.updated = now
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False
```

Then in your route: if `not limiter.allow()`, return `429 Too Many Requests` *before* making the paid call. Throttling upstream is the cheapest form of rate limiting — a 429 to a misbehaving client beats a 429 from your provider at 2 AM.

When the provider does throttle you, **retry with exponential backoff and jitter** — but only for transient errors (rate limits, 5xx), never for 4xx like an auth failure or a malformed request.

## Caching: the biggest win per line of code

LLM outputs for identical inputs are expensive and largely deterministic (especially at `temperature=0`). A simple cache keyed on the exact prompt returns the answer for free.

```python
import hashlib

cache: dict[str, str] = {}

def cached_answer(messages: list[dict]) -> str:
    key = hashlib.sha256(repr(messages).encode()).hexdigest()
    if key in cache:
        return cache[key]
    result = llm.invoke(messages)
    cache[key] = result
    return result
```

The production upgrades, in order of effort:

1. **Shared cache** (Redis, or your DB) instead of an in-process dict — survives restarts and multiple servers.
2. **Semantic cache** for RAG apps: cache on the *retrieved chunks* rather than the raw question, so reworded questions about the same content hit the cache.
3. **Cache only at `temperature=0`** — caching creative output is caching luck.

Caching a hit rate of even 20% on a high-traffic endpoint often pays for the whole deployment.

## Logging and observability: what to record on every call

You can't debug what you didn't record. For every LLM call, log at minimum:

- **The prompt** (or a hash of it) and the model name/version
- **Input/output token counts** — your cost line item
- **Latency**, split into time-to-first-token and total
- **Retry count and final status**
- **A trace id** linking this call to the user request that triggered it

```python
def logged_call(messages, model):
    import time
    t0 = time.monotonic()
    try:
        resp = llm.invoke(messages, model=model)
        status = "ok"
    except Exception as exc:
        status = f"error: {exc}"
        raise
    finally:
        elapsed_ms = (time.monotonic() - t0) * 1000
        # write {model, status, elapsed_ms, prompt, response} to your log store
    return resp
```

Logging prompts containing user data has privacy implications — scrub PII or log hashes in production. But logging *something* on every call is non-negotiable, because the alternative is debugging with guesswork.

## Graceful degradation

LLMs fail in ways regular services don't: they go slow, return empty, or produce malformed JSON. Production apps need a response plan:

- **Retry with backoff** for transient failures (limited attempts).
- **Fall back** to a simpler model or a static answer when the primary path fails.
- **Cap response time** with a timeout so a hung call doesn't hang the request forever.
- **Validate structure** (e.g., the JSON you asked for) before using the output — and request a repair from the model rather than crashing.

The goal is a system where an LLM failure degrades the experience instead of breaking it.

## Common pitfalls

| Symptom | Likely cause | Fix |
|---|---|---|
| Users see a blank screen for seconds | Non-streaming response | Stream tokens to the client as they arrive |
| Random 429s from the provider | No upstream throttling / no backoff | Rate-limit in your app; retry with exponential backoff + jitter |
| Costs spiral with traffic | No caching on repeated prompts | Cache on prompt (or retrieved chunks) at temperature 0 |
| "It worked in dev, broke in prod" | No logging on calls | Log model, tokens, latency, status, trace id on every call |
| One slow user blocks everyone | Synchronous wait inside request handling | Make calls async or background them; set timeouts |
| Malformed JSON crashes the app | Unvalidated model output | Validate/repair the output before using it |

## Glossary (for quick reference)

- **Time-to-first-token (TTFT)** — the latency before the first output token arrives; what users actually perceive.
- **Streaming** — delivering tokens as they're generated, instead of after the full response.
- **Rate limit** — a cap on requests or tokens per unit of time, either your own or your provider's.
- **Exponential backoff** — retrying with increasing delays after transient failures.
- **Semantic cache** — caching keyed on retrieved content rather than exact prompt text.
- **SSE** — Server-Sent Events, the simplest way to stream text responses over HTTP.
- **Graceful degradation** — continuing to serve (worse, but working) when the LLM backend fails.

## Wrapping up

Production LLM serving is three disciplines: **stream** so latency is tolerable, **limit and cache** so cost is bounded, and **log everything** so failures are debuggable. Start with the token-bucket limiter and a one-line prompt cache — they're small, and they prevent the two most common production incidents. A good next step: add request logging to the agent API you built earlier, then run a load test with 50 concurrent users and watch where latency and errors first appear.
