# BERT: Pre-training of Deep Bidirectional Transformers

```callout
**In one sentence:** BERT showed that you can pre-train a Transformer *encoder* to fill in the blanks on unlabeled text, then fine-tune it for almost any language task — and beat task-specific architectures while barely changing the model.
```

This paper (Devlin et al., 2019) is the moment "pre-train once, fine-tune everywhere" went mainstream. If the Transformer architecture in [Transformers Explained](../tutorials/transformers.md) is the engine, BERT is the recipe that taught the field how to fuel it.

## Before you read

- **The Transformer encoder.** BERT is *only* the encoder half — no decoder, no generation. Skim [Transformers Explained](../tutorials/transformers.md) first.
- **Self-attention and [CLS].** It helps to know that attention lets every token look at every other token.
- **Logits and softmax.** The language-model head turns hidden states into a probability over the vocabulary.

## The problem: context was one-directional

Before BERT, the strongest language models were **unidirectional** — they read text left-to-right (like GPT) and could only use the words *before* a given position to predict it. For generation that is exactly right, but for understanding a sentence it is a handicap: when you fill in "she went to the ______", the words on both sides matter.

Earlier methods had workarounds — train two separate left-to-right and right-to-left models and bolt them together, or hand-engineer features — but neither gives a single model true **bidirectional** context. BERT's thesis: build one deep Transformer that reads the *whole* sentence at once, and train it on a task that forces it to use both sides.

## Key idea: pre-train with a fill-in-the-blank task

BERT is pre-trained on two unsupervised objectives, then fine-tuned on the real task.

### Masked language modeling (MLM)

Randomly mask 15% of input tokens and ask the model to predict them:

```
Input:   the man went to the [MASK] to buy [MASK] milk
Predict:                                    store          some
```

Because predicting a masked token depends on words to its left *and* right, the model is forced to build a genuinely bidirectional representation. The 15% masked tokens are split further: 80% become `[MASK]`, 10% become a random token, and 10% stay unchanged. The random/unchanged tokens keep the model from over-fitting to the literal `[MASK]` symbol, which never appears at fine-tuning time.

### Next sentence prediction (NSP)

The model also sees two sentences and predicts whether the second actually followed the first:

```
[CLS] the man went to the store [SEP] he bought a gallon of milk [SEP]  -> IsNext
[CLS] the man went to the store [SEP] penguins swim quickly   [SEP]  -> NotNext
```

NSP was meant to teach sentence relationships, though later work (RoBERTa) found it largely unnecessary — MLM alone does most of the heavy lifting.

## The input: three embeddings added together

BERT packs a sequence into one vector per token by summing three learned embeddings:

```
Token embedding:    [CLS]  the   man   went   [SEP]
Segment embedding:   A     A     A     A      A
Position embedding:  0     1     2     3      4
                    └──────────── sum ────────────┘
```

- `[CLS]` is a special token whose final hidden state is used as the **aggregate sequence representation** for classification.
- `[SEP]` separates sentences.
- **Segment embeddings** tell the two sentences apart.
- **Position embeddings** inject word order.
- **WordPiece** tokenization splits rare words into subword pieces so the vocabulary stays manageable.

## The math

MLM is just a softmax over the vocabulary at each masked position. For masked position $i$ with hidden state $h_i$, the distribution over the vocabulary $V$ is:

$$
P(w \mid \text{context}) = \text{softmax}(W h_i + b)
$$

and the loss is the negative log-likelihood averaged over masked positions:

$$
\mathcal{L}_{\text{MLM}} = -\sum_{i \in \text{masked}} \log P(w_i \mid \text{context})
$$

The context itself comes from the same scaled dot-product attention as the original Transformer:

$$
\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{Q K^\top}{\sqrt{d_k}}\right) V
$$

The only architectural difference from a decoder is that there is **no causal mask** — every token attends to every other token, in both directions, at every layer.

## Fine-tuning: swap the head, keep the body

Pre-training learns general language. Fine-tuning adapts that to a specific task with a *tiny* task-specific head:

| Task            | Input                                  | Head                        |
|-----------------|----------------------------------------|-----------------------------|
| Sentiment       | `[CLS]` + sentence                     | Linear on `[CLS]`           |
| Question answering | question + `[SEP]` + passage        | Start/end span over tokens  |
| NLI             | sentence + `[SEP]` + sentence          | Linear on `[CLS]`           |
| Tagging         | `[CLS]` + tokens                       | Linear per token            |

The important result: BERT-base/large could be fine-tuned for *all* of these within an hour on a single TPU, and it beat purpose-built systems on GLUE, SQuAD, and SWAG. One backbone, many tasks.

## Code: masking a batch the BERT way

The masking rule is small enough to read in full. This is the part everyone gets wrong on the first try:

```python
import random

MASK_ID, VOCAB_SIZE = 103, 30522
SPECIAL_TOKENS = {101, 102}   # [CLS] and [SEP] are never masked

def create_masked_lm_predictions(tokens, mask_prob=0.15):
    """Return (masked_tokens, labels) where labels is -1 for kept tokens."""
    cand = [i for i, t in enumerate(tokens) if t not in SPECIAL_TOKENS]
    n_mask = int(len(tokens) * mask_prob)
    chosen = random.sample(cand, min(n_mask, len(cand)))
    labels = [-1] * len(tokens)
    out = list(tokens)
    for i in chosen:
        labels[i] = tokens[i]                 # the model is scored on this position
        r = random.random()
        if r < 0.8:
            out[i] = MASK_ID                  # 80%: the [MASK] token
        elif r < 0.9:
            out[i] = random.randrange(VOCAB_SIZE)  # 10%: a random token
        # else 10%: leave the original token in place
    return out, labels
```

Try the ablation: set all three branches to always use `MASK_ID` and fine-tuning scores drop — the model learns to expect a symbol that never shows up in real text.

## Why it mattered

- **Bidirectional context** in one model, not two glued-together models.
- **A universal recipe:** pre-train on cheap unlabeled text, fine-tune on small labeled sets. This became the default way to build NLP systems.
- **Strong transfer:** a single backbone reached state of the art across very different tasks.

The encoder-only design that BERT popularized still powers embedding models and retrieval systems — including the dense retriever in our [RAG paper](rag-for-knowledge-intensive-tasks.md).

## Key takeaways

- **Masked language modeling** forces bidirectional understanding by making the model predict hidden tokens from both sides.
- `[CLS]` aggregates the whole sequence; `[SEP]` splits it.
- Input = **token + segment + position** embeddings, summed.
- **Pre-train then fine-tune** with a tiny task head is the core pattern.
- BERT is the **encoder half** of the Transformer — great for understanding, not for generation.

## Read further

- Our tutorial: [Transformers Explained](../tutorials/transformers.md)
- Our tutorial: [How LLMs Actually Work](../tutorials/how-llms-work.md)
- Paper: [arXiv:1810.04805](https://arxiv.org/abs/1810.04805)
- Code: [google-research/bert](https://github.com/google-research/bert)

## Cite this

```text
@inproceedings{devlin2019bert,
  title     = {BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding},
  author    = {Devlin, Jacob and Chang, Ming-Wei and Lee, Kenton and Toutanova, Kristina},
  booktitle = {Proceedings of NAACL-HLT},
  year      = {2019}
}
```
