# How LLMs Actually Work

Chatbots feel like they understand you. They don't — not the way you or I understand a conversation. An LLM (large language model) is a very large neural network that has learned one statistical task extremely well: *predict the next token*. Everything impressive — and everything misleading — about these models follows from that single fact. This tutorial connects the pieces you've already studied — Transformers, neural networks, training — into a complete mental model of what happens when you send a prompt and get an answer.

If you've done the Transformers tutorial, you know the architecture. Here's what it *does*.

## Prerequisites

- The Transformers tutorial (architecture) and Neural Networks tutorial (training)
- No code required — this is a concepts page

## Tokenization: the model doesn't read words

The first thing to internalize: the model doesn't see characters or whole words. It sees **tokens** — pieces of text of varying length, produced by a tokenizer.

```text
"DocNest is a study place for AI enthusiasts"
→  ["Doc", "Nest", " is", " a", " study", " place", " for", " AI", " enthusiasts"]
```

"DocNest" is rare, so it splits into two common pieces. Common words often stay whole. Each token maps to a number, and that number becomes the input to the network. Two consequences follow:

- **The context window is measured in tokens**, not words. "DocNest" costing 2 tokens is why long, exotic vocabulary eats your context budget faster than plain prose.
- **Rare words are split into pieces the model knows well.** This is why the model can write about topics never spelled out in its training data — it's assembling known fragments.

## The core operation: predict the next token

At its heart, an LLM does one thing, one token at a time:

```text
input:    "The capital of France is"
output:   " Paris"     (probability 0.62)
          " paris"     (probability 0.18)
          " Paris?"    (probability 0.03)
          ...
```

It assigns a probability to every possible next token, and picks one. That's a **probability distribution over the vocabulary** — typically 50,000–100,000 tokens. The entire model is a machine for turning a string of tokens into "what's the most likely token to come next?"

Everything else is built on this loop:

- **Generation** — write the predicted token, append it to the input, predict the next, repeat. This is the decoder loop from the Transformers tutorial.
- **Your whole conversation** — every message you've sent is in the input; the model just keeps predicting the next token, including all the words in its replies.

## Why it sounds so smart: training on the internet

A model with random weights would predict garbage. LLMs learn the next-token distribution by training on an enormous corpus — a large fraction of the public internet. The training loop is the one you saw in the Neural Networks tutorial, at epic scale:

- **Pretraining** — predict the next token over trillions of tokens, adjusting weights to improve the prediction. This is where the model's vast "knowledge" is stored — not in a database, but *in the weights*.
- **Post-training** — after pretraining, the model is further tuned (with carefully curated data and human or AI feedback) to be helpful, honest, and safe — which is why it answers questions rather than just completing text statistically.

That second step is why the model *behaves* like an assistant. But underneath, it never stopped being a next-token predictor.

## The consequences: hallucination and the knowledge problem

Understanding "it's a next-token predictor" explains every famous failure mode:

- **Hallucination.** The model isn't retrieving a fact from a database — it's generating the *most statistically plausible* continuation. If a plausible-sounding claim is common in its training data, or if the pattern fits, it will produce it with total confidence. It has no internal "check the facts" step.
- **No real knowledge of your world.** Its knowledge froze at the end of pretraining. New products, recent events, your internal documents — none of it exists in the weights. This is exactly why RAG exists (the RAG tutorial: retrieve the facts and hand them to the model, rather than expecting it to know them).
- **Length and repetition.** Because it commits token by token, a wrong early decision compounds — the model can go down a confident, wrong path and never correct itself.

None of this makes LLMs less useful. It just means the correct mental model is: *an extremely capable text-pattern engine, not a truth engine.* You verify its facts, and you give it the data it needs — the way every reliable LLM application does.

## Sampling: why the same prompt gives different answers

Prediction returns a probability distribution. How do you pick a token from it? Three common strategies:

- **Greedy** — always pick the most likely token. Deterministic, but robotic and repetitive.
- **Temperature** — divide the logits by a temperature before taking probabilities. Low temperature (≈0) sharpens the distribution → predictable, near-greedy. High temperature flattens it → varied, creative, occasionally nonsense.
- **Top-p (nucleus)** — pick randomly, but only among the smallest set of tokens whose combined probability exceeds `p`. A practical randomness dial.

This is why setting `temperature=0` during evaluation matters (from the Evaluation tutorial) — it makes the randomness collapse and results comparable.

## The map of everything you've learned

You now have the whole stack in one line: **tokens in → a big stack of Transformer blocks, trained by next-token prediction → a probability distribution → one token sampled → repeat.** Each tutorial you've done maps onto it:

- Transformers — the blocks in the middle
- Neural Networks — how those blocks learned
- Machine Learning — the train/test discipline that made the learning reliable
- Prompt Engineering — how to shape the input so the next-token prediction lands where you want
- RAG — giving the model the facts it doesn't actually know
- Agents — wrapping the loop with tools so it can *do* things, not just predict

## Common pitfalls

| Mistake | Why it happens | Fix |
|---|---|---|
| Trusting model statements as fact | It's a pattern generator, not a truth engine | Verify outputs; give it sources (RAG) |
| "Why does it not know about X?" | Knowledge frozen at pretraining | Provide the context in the prompt |
| Confusing token limits with word limits | Context is counted in tokens | Budget context in tokens |
| Repetitive, robotic output | Greedy sampling | Raise temperature slightly |
| Random results during testing | Temperature > 0 | Set temperature=0 for evals |

## Glossary (for quick reference)

- **Token** — the text fragment the model actually processes; context is counted in tokens.
- **Next-token prediction** — the single task an LLM is trained to do.
- **Probability distribution** — the model's score for every possible next token.
- **Pretraining** — learning next-token prediction over a huge corpus; where "knowledge" lives in the weights.
- **Post-training** — tuning the model to be a helpful, safe assistant.
- **Sampling** — choosing the actual next token from the distribution (greedy, temperature, top-p).
- **Temperature** — a knob that sharpens or flattens the sampling distribution.
- **Hallucination** — confident, plausible, and wrong generations.

## Wrapping up

Everything an LLM does reduces to one loop: tokenize, predict the next token, sample, append, repeat. The knowledge is in the weights, the behavior comes from training, and the failures come from being a pattern engine asked to behave like a fact engine. Carry that model forward and the entire rest of the curriculum — prompting, RAG, agents, evaluation — becomes engineering around a next-token predictor. A good next step: open any chatbot, deliberately ask it for a fact from today (which it can't know), and watch how confidently it guesses — then notice that the fix isn't a better prompt, it's better data (the RAG tutorial).
