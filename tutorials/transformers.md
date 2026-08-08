# Transformers Explained

Every modern language model — GPT, Claude, LLaMA — is built on one architecture: the Transformer. It was introduced in the 2017 paper "Attention Is All You Need," and it replaced the recurrent neural networks that came before it. This tutorial explains what problem it solved, what **attention** actually does, and how the pieces fit together, without the algebra. By the end, the phrase "a stack of Transformer blocks" won't be mysterious anymore.

This is the deep learning bridge to LLMs: the neural network concepts you need are the ones from the Neural Networks tutorial — layers, weights, and training loops.

## Prerequisites

- The Neural Networks tutorial — layers, activations, training
- No linear algebra beyond a rough idea of what a vector is
- Curiosity about why the model knows so much

## The problem: words are sequential, and that was slow

Before Transformers, language models used **recurrent neural networks (RNNs)** that processed text one word at a time, keeping a "memory" as they went. This had a fatal flaw: the memory had to carry everything through every step. By the time the model reached word 500, the information from word 5 was a faint, distorted echo. Long-range relationships — "the cat that we saw last week in the park is sleeping" needs to connect "cat" and "is" across many words — were hard to learn.

Even worse, processing was **sequential**: word 2 couldn't be handled until word 1 was done, so you couldn't use fast parallel hardware to its full potential. Training big RNNs was slow for this reason alone.

The Transformer's fix was radical: process *all* words at once, and let each word decide — directly, at any distance — which other words it should pay attention to.

## Attention: the core mechanism

**Attention** is the answer to one question: *given a word, which other words in the sentence matter for understanding it?*

In "The animal didn't cross the street because **it** was too tired," the word "it" needs to know it refers to "animal" (not "street"). Attention is the mechanism that lets "it" look at every other word, score how relevant each one is, and pull information from the relevant ones.

The mechanics, in one picture:

1. Every word gets three vectors: a **Query** (what am I looking for?), a **Key** (what do I offer?), and a **Value** (the information I carry).
2. For a given word, you match its Query against every word's Key to get a relevance score.
3. Scores are normalized (the famous **softmax**).
4. You blend the Values together using those scores — mostly taking from the words that scored high.

```text
"it"                                 "animal"
query  = [?]  ————————————————→  key = [.…]  score = 0.89   ← very relevant
                     \                "street"
                      \——→            key = [….]  score = 0.11   ← barely relevant

  "it" pays 89% of its attention to "animal",
  and takes 89% of its updated meaning from "animal"'s value.
```

Every word does this simultaneously — that's why it's called **self-attention** (words attending to words in their own sentence). Because every word can attend to every other word in a single step, the "fading memory" problem of RNNs simply disappears, and the whole thing runs in parallel on a GPU.

## Multi-head attention: several questions at once

One set of Query/Key/Value gives the model one way to relate words. But relationships are multidimensional: "it" needs to know its referent, whether it's the subject, and its part of speech. So Transformers run **several attention mechanisms side by side** — multiple "heads" — each with its own Query/Key/Value weights.

Different heads learn different kinds of relationships: one tracks subject-verb agreement, another tracks pronoun referents, another tracks position and rhythm. The results of all heads are concatenated and mixed back together. It's the same attention mechanism, just run several times in parallel and combined — more perspectives, richer understanding.

## Position: the missing ingredient

Attention as described is *order-blind*: "the cat chased the dog" and "the dog chased the cat" contain the same words, and attention would treat them identically. That's fine for knowing *what's present* but useless for knowing *who did what to whom*.

The fix is **positional encoding**: before the network sees each word, it adds a vector that encodes where the word sits in the sequence. The model can then use both the word's meaning and its position. This is the ingredient that turns a bag of words into a sequence understanding machine.

## The block: how it all stacks

A Transformer is built by stacking **blocks**. Each block is:

```text
input
  │
  ├─ Self-Attention (multi-head)  ← every word looks at every other word
  ├─ + (residual connection)      ← add the input back, so gradients flow
  ├─ Feed-forward network         ← a small regular neural network, per word
  └─ + (residual connection)
output  → next block
```

Stack a dozen or a hundred of these and you have the "deep" in deep learning — each layer builds on the abstractions of the one before, from nearby word relationships in the early layers to abstract concepts in the deepest ones.

## Encoders, decoders, and the two families

The original Transformer had two halves, and they became two model families:

- **Encoder** — reads the *whole* input at once (bidirectional attention). Output: a rich representation of the text. → **BERT** and friends (excellent for understanding: classification, search, embeddings).
- **Decoder** — generates text one token at a time, attending only to what it has written so far (causal attention). → **GPT**, Claude, LLaMA (excellent for generation).

When you talk to ChatGPT, you're using a decoder-only model: it writes one token, adds it to what it has, and writes the next. That left-to-right generation loop is exactly why prompt order and temperature matter — the model literally can't reconsider what it already committed to, as the Prompt Engineering tutorial described.

## Common pitfalls

| Symptom / confusion | Likely cause | Fix |
|---|---|---|
| "Attention is magic" | Not breaking it into Q/K/V mechanics | Trace one word's attention as in this tutorial |
| Mixing up encoder vs. decoder | Not connecting architecture to use case | Encoders = understanding; decoders = generation |
| Why does it generate left-to-right? | Decoder attention is causal (one-directional) | Remember it can only see what it already wrote |
| Why so many "heads"? | One perspective isn't enough | Each head learns a different relationship type |
| Why residual connections? | Deep stacks are hard to train | Residues let gradients flow through the whole stack |

## Glossary (for quick reference)

- **Self-attention** — every word attending to every other word in the same sequence.
- **Query / Key / Value** — the three vectors per word: what to find, what it offers, what it carries.
- **Softmax** — the step that turns raw relevance scores into a normalized weighting.
- **Multi-head attention** — several attention mechanisms run in parallel and combined.
- **Positional encoding** — position info added to each word so the model knows word order.
- **Residual connection** — adding a layer's input to its output to help training.
- **Encoder** — bidirectional reader; good for understanding. **Decoder** — left-to-right generator; good for writing.
- **Causal attention** — a decoder's attention that only sees past tokens.

## Wrapping up

The Transformer replaced slow sequential memory with direct, parallel attention — every word can reach every other word in one step, from any distance. Attention works by matching queries against keys and blending values; multi-head attention does this from several perspectives at once; and stacking attention + feed-forward blocks with residual connections is the entire architecture. This is the foundation the "How LLMs Actually Work" tutorial builds on next. A good next step: read the original "Attention Is All You Need" paper's diagrams (the figures are friendlier than the math), and try to identify each piece — Q/K/V, multi-head, residuals — in a picture of a Transformer block.
