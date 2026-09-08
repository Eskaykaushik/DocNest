# Attention Is All You Need

```callout
**In one sentence:** the Transformer ditches recurrence entirely and computes every word's context with a stack of self-attention layers, which made it dramatically more parallelizable — and quietly became the backbone of every modern LLM.
```

This paper (Vaswani et al., 2017) is the founding document of the modern LLM era. If you've already done [How LLMs Actually Work](../tutorials/how-llms-work.md) or [Transformers Explained](../tutorials/transformers.md), this is where those ideas come from.

## Before you read

A few things that will make the paper click faster:

- **Word embeddings.** Tokens become vectors, so "similar" words are close together in space.
- **Softmax.** Turns a vector of scores into probabilities that sum to 1.
- **Seq2seq / RNN intuition.** What an encoder–decoder is, and why recurrence is slow.

If any of those feel shaky, skim our [Python Fundamentals for Building with LLMs](../tutorials/python.md) and [How LLMs Actually Work](../tutorials/how-llms-work.md) first — they cover the ground this paper assumes.

## The problem: recurrence is slow and forgetful

Before Transformers, the state of the art for sequence tasks was the **recurrent network** (LSTM/GRU). To process a sentence, an RNN reads one token at a time, keeping a hidden state $h_t$ that is supposed to carry "everything so far":

$$
h_t = \text{LSTM}(h_{t-1}, x_t)
$$

This has two deep problems:

1. **It's sequential by construction.** Token $t+1$ can't be processed until token $t$ finishes, so you can't parallelize training over the whole sentence. Long sentences = slow training, which capped how much data you could throw at the model.
2. **It forgets.** Information must squeeze through a single fixed-width hidden state at every step. Long-range dependencies (matching an *opening* clause with its *closing* clause ten words later) fade out — the famous "vanishing gradient" problem.

The paper's thesis is a radical simplification: **you mostly don't need the recurrence at all.** You need a way for every word to look directly at every other word and decide what matters.

## Key idea: give every word a direct line to every other word

Self-attention lets each token build a representation by **attending over all the other tokens in the sequence simultaneously**, weighting them by relevance. Because every token attends to every other token in one shot, you get:

- **Full parallelizability** — no sequential dependency, so training can spread across many GPUs at once.
- **O(1) path length** — any two tokens are one hop apart, so long-range dependencies are easy to learn.

The whole architecture is an encoder–decoder stack, where both the encoder and the decoder are made of layers of self-attention + feed-forward networks, wrapped with residual connections.

```
Outputs
   |
[ Linear + softmax ]        <- turn hidden states into next-token probabilities
   |
[ Decoder layers ×6 ]       <- self-attention (masked) + cross-attention + FFN
   |
[ Encoder layers ×6 ]       <- self-attention + FFN
   |
[ Input embeddings + positional encoding ]
   |
Inputs
```

## The math: scaled dot-product attention

Attention is just a **weighted average of values**, where the weights are computed by dot products.

### Step 1 — projections

Every token embedding $x$ is linearly projected into three spaces: a **query** $q$, a **key** $k$, and a **value** $v$:

$$
q = x W^Q, \quad k = x W^K, \quad v = x W^V
$$

Think of the three roles as a search:

- **Query** = what this token is *looking for*.
- **Key** = what this token *advertises* about itself.
- **Value** = what this token *contributes* if selected.

### Step 2 — attention scores

For a query $q_i$, compute a relevance score against every key $k_j$ using the dot product $q_i \cdot k_j$. Dot products measure alignment: big when the directions match.

### Step 3 — the full formula

The paper defines attention as:

$$
\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{Q K^\top}{\sqrt{d_k}}\right) V
$$

where:

- $Q$ is a matrix of all queries, $K$ all keys, $V$ all values.
- $QK^\top$ gives the dot-product scores between every query and every key.
- Dividing by $\sqrt{d_k}$ (the key dimension) keeps the magnitudes stable. Without it, large dot products push softmax into a region where gradients vanish.
- **softmax** normalizes each row into a probability distribution over tokens.
- Multiplying by $V$ is the weighted average: each token pulls value contributions from its neighbors according to the attention weights.

### Multi-head attention: think multiple times, differently

A single attention pattern is one way of looking at the sentence. The paper runs several in parallel and concatenates the results:

$$
\text{MultiHead}(Q, K, V) = \text{Concat}(\text{head}_1, \dots, \text{head}_h) W^O
$$

with $\text{head}_i = \text{Attention}(Q W_i^Q, K W_i^K, V W_i^V)$.

Each *head* can learn a different relationship — one tracking subject–verb agreement, another watching coreference, another catching positional cues. Combine the attention heads and you get rich, multi-faceted context attending to a word.

## Positional encoding: injecting order without recurrence

Attention is *permutation invariant* — "the dog bit the man" and "the man bit the dog" produce identical attention scores unless you tell the model about positions. The paper solves this with **positional encodings** added to each input embedding:

$$
PE_{(pos, 2i)} = \sin\left(\frac{pos}{10000^{2i/d}}\right), \quad
PE_{(pos, 2i+1)} = \cos\left(\frac{pos}{10000^{2i/d}}\right)
$$

The key design choice is using **sines and cosines at different frequencies** rather than learned position IDs. Because the encodings are continuous functions of position, the model can easily learn relative offsets — and the model can extrapolate to sequence lengths it never saw during training.

## Why it works

Three big reasons:

1. **Capacity via attention heads.** Multiple heads = multiple simultaneous interpretations of context, learned end-to-end. No hand-crafted features.
2. **Trainability.** Parallel attention over a whole sequence means vastly more training data fits in a wall-clock day than RNNs ever could. The Transformer trained in 3.5 days on 8 GPUs and beat every rival on WMT translation.
3. **Stable gradients with depth.** Residual connections around each sub-layer keep gradients flowing through deep stacks (they used 6×6 layers).

The paper's headline result: BLEU 28.4 on WMT 2014 English→German, beating the previous best by 2+ BLEU points while training for a fraction of the compute.

## Code: minimal self-attention in NumPy

The whole mechanism is ~30 lines. No training loops, just the forward math, so you can poke at it.

```python
import numpy as np

def softmax(x, axis=-1):
    x = x - x.max(axis=axis, keepdims=True)          # numerical stability
    e = np.exp(x)
    return e / e.sum(axis=axis, keepdims=True)

def scaled_dot_product_attention(q, k, v, mask=None):
    # q, k, v: (batch, seq_len, d_k)
    d_k = q.shape[-1]
    scores = q @ k.transpose(0, 2, 1) / np.sqrt(d_k) # (batch, seq, seq)
    if mask is not None:
        scores = np.where(mask, scores, -1e9)         # softmax eats -inf anyway
    weights = softmax(scores)                         # row-normalized
    return weights @ v, weights                       # weighted sum of values

def multi_head_attention(x, n_heads, d_k, d_v, Wq, Wk, Wv, Wo):
    batch, seq, d_model = x.shape
    q = x @ Wq; k = x @ Wk; v = x @ Wv               # (batch, seq, heads*d_k)
    q = q.reshape(batch, seq, n_heads, d_k).transpose(0, 2, 1, 3)
    k = k.reshape(batch, seq, n_heads, d_k).transpose(0, 2, 1, 3)
    v = v.reshape(batch, seq, n_heads, d_v).transpose(0, 2, 1, 3)

    out, _ = scaled_dot_product_attention(q, k, v)    # (batch, heads, seq, d_v)
    out = out.transpose(0, 2, 1, 3).reshape(batch, seq, n_heads * d_v)
    return out @ Wo
```

Try changing one thing: divide the scores by `d_k` *instead of* `sqrt(d_k)` and watch softmax saturate into nearly one-hot distributions — that's the instability the scaling factor prevents.

## Attention, but for language models

The version you use every day differs in one important way: **decoder-only transformers with causal masking**. During next-token prediction, a token can only attend to itself and earlier tokens (otherwise you leak the future answer). That's the `mask` argument above — set everything above the diagonal to $-\infty$ and causal self-attention falls straight out of the same math. Our [How LLMs Actually Work](../tutorials/how-llms-work.md) tutorial walks through exactly this.

## Key takeaways

- Recurrence isn't required for sequence modeling — **attention alone** is enough.
- **O(1) path length** + **parallelizable** = Transformers train much faster and scale far better than RNNs, which is ultimately why they won.
- **Scaled dot-product attention** `softmax(QKᵀ/√dₖ)V` is the one formula to remember.
- **Multi-head** attention lets each layer learn many interpretations at once.
- **Positional encodings** inject order into a permutation-invariant mechanism.

## Read further

- Our tutorial: [Transformers Explained](../tutorials/transformers.md)
- Our tutorial: [How LLMs Actually Work](../tutorials/how-llms-work.md)
- Paper: [arXiv:1706.03762](https://arxiv.org/abs/1706.03762)
- Companion walkthrough: [The Annotated Transformer](https://nlp.seas.harvard.edu/2018/04/03/attention.html)

## Cite this

```text
@inproceedings{vaswani2017attention,
  title   = {Attention is All You Need},
  author  = {Vaswani, Ashish and Shazeer, Noam and Parmar, Niki and
             Uszkoreit, Jakob and Jones, Llion and Gomez, Aidan N and
             Kaiser, Lukasz and Polosukhin, Illia},
  booktitle = {Advances in Neural Information Processing Systems},
  year    = {2017}
}
```