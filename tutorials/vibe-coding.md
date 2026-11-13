# Vibe Coding vs. AI-Assisted Engineering

In February 2025, Andrej Karpathy posted a description of a way of programming that gave the industry a name — and, within months, a misunderstanding. The name was **vibe coding**, and the misunderstanding was that it describes *all* programming done with AI. It doesn't, and the difference decides whether you ship software you can maintain or a demo you can't explain.

This tutorial is about that line: where it came from, who drew it, and how to tell which side of it you're on.

```callout
**In one sentence:** vibe coding means generating code without reading it; AI-assisted engineering means using the model to write code you review, test, and understand. Same tools, different obligations.
```

## The original definition

Karpathy's post described giving in completely:

> "There's a new kind of coding I call 'vibe coding', where you fully give in to the vibes, embrace exponentials, and forget that the code even exists."

The details matter more than the slogan. In the same post he described using Cursor's Composer with voice input, clicking **Accept All**, not reading the diffs, and pasting error messages back with no comment until the bug went away. He also scoped it: it was "not too bad for throwaway weekend projects," and the code had grown beyond his usual comprehension.

That last part is the tell. The term was coined by someone who could have written every line himself, describing a mode of play — not a production methodology.

## Why the name escaped

The phrase filled a real gap. People had been using models to write code for two years and had no word for the specific practice of *not reading what came back*. It spread fast: by November 2025 Collins had made it word of the year.

And it immediately drifted. Simon Willison, writing in March 2025, called this out directly: he was seeing "vibe coding" applied to all forms of AI-assisted programming, which "both dilutes the term and gives a false impression of what's possible with responsible AI-assisted programming."

## The line, as drawn by practitioners

Willison's test is the one most people now use:

> "If an LLM wrote every line of your code, but you've reviewed, tested, and understood it all, that's not vibe coding in my book."

He calls that using the model as a **typing assistant**. His rule for production work is stricter than review-by-vibes: he won't commit code he couldn't explain exactly to someone else.

By late 2025 he had started using a third term, **vibe engineering**, for what professional engineers actually do with these tools — the disciplined version, with specs, tests, and review.

| | Vibe coding | AI-assisted engineering |
| --- | --- | --- |
| Do you read the diff? | No | Yes |
| Who owns the result? | Whoever runs it | You, in review |
| Tests | Optional, often absent | Required |
| Good for | Throwaway prototypes, demos, personal tools | Anything you'll maintain |
| Failure mode | Silent breakage you can't diagnose | Slower than raw generation |

## What the research says

The first empirical study of the practice appeared in June 2025. Its authors analysed over eight hours of curated video of extended vibe-coding sessions with think-aloud reflections, and found that the work follows iterative goal-satisfaction cycles: prompt the model, evaluate the generated code by scanning and testing it, then edit manually. They also found that vibe coding does not eliminate programming expertise — it redistributes it toward context management, rapid code evaluation, and decisions about when to switch between AI-driven and manual work. Trust in the tool was dynamic, built through iterative verification rather than blanket acceptance.

## Where vibe coding is legitimate

Karpathy's own framing points at it: low-stakes, disposable work. Willison adds the safety condition — for beginners, safe vibe coding **starts with a sandbox**, where generated code can't reach your files, your credentials, or your billing.

He also warns about one specific trap: be very careful about vibe coding anything charged per use. A loop that generates and runs code against a metered API can spend real money while you're "just seeing stuff."

## Where it goes wrong in production

Three failure modes show up repeatedly in practitioner write-ups:

1. **Unreviewed code becomes unowned code.** If nobody can explain why a file works, nobody can safely change it.
2. **Tests get skipped, not written.** AI-generated code passes the demo and fails the edge case, because the demo was the only test.
3. **Context silently rots.** Long sessions accumulate stale assumptions, and output quality drops — the subject of the next tutorials in this series.

None of these are arguments against AI-assisted coding. They're arguments for knowing which mode you're in.

## A practical rule

Ask one question before you prompt: **will I have to maintain this?**

- **No** — a weekend tool, a throwaway script, a demo you'll delete: vibe code it. Sandbox it, cap the spend, don't attach it to anything you care about.
- **Yes** — anything with users, data, or a deploy pipeline: review every diff, keep tests as the guardrail, and brief the agent properly.

The rest of this track is about the second case.

## Glossary

- **Vibe coding** — generating code with an LLM without reviewing or understanding the output.
- **AI-assisted engineering** — using an LLM to write code you review, test, and own.
- **Vibe engineering** — Simon Willison's term for the disciplined, production-grade version of working with AI.
- **Sandbox** — an isolated environment where generated code can't touch your real files or credentials.

## Wrapping up

The term is useful precisely because it's narrow. Vibe coding is a real and legitimate way to build disposable things fast; it is not a synonym for "using AI to write software." Keep the distinction, and you can use both modes without confusing their obligations.

Next: [Briefing Your Agent: AGENTS.md and CLAUDE.md](../tutorials/agents-md.md) — the cheapest fix for most agent misbehaviour.

## Sources

- Andrej Karpathy, original "vibe coding" post, February 2025 — quoted in full by [Simon Willison](https://simonwillison.net/2025/Mar/19/vibe-coding/) and [Ars Technica](https://arstechnica.com/ai/2025/03/is-vibe-coding-with-ai-gnarly-or-reckless-maybe-some-of-both/).
- Simon Willison, [Not all AI-assisted programming is vibe coding (but vibe coding rocks)](https://simonwillison.net/2025/Mar/19/vibe-coding/), March 2025.
- Simon Willison, [Vibe engineering](https://simonwillison.net/2025/Oct/7/vibe-engineering/), October 2025.
- MIT Technology Review, [What is vibe coding, exactly?](https://www.technologyreview.com/2025/04/16/1115135/what-is-vibe-coding-exactly/), April 2025.
- Communications of the ACM, [Catching the Vibe of Vibe Coding](https://cacm.acm.org/news/catching-the-vibe-of-vibe-coding/), May 2025.
- [Vibe coding: programming through conversation with artificial intelligence](https://arxiv.org/abs/2506.23253), arXiv, June 2025.
- Montana Research Foundation, [Vibe coding: a joke tweet that became a word of the year](https://montanaresearch.org/blog/vibe-coding-joke-tweet-became-word-of-the-year/) — on the Collins word-of-the-year announcement.
