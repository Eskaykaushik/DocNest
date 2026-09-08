# RAG: Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks

```callout
**In one sentence:** instead of baking all knowledge into a model's parameters, RAG dynamically retrieves relevant documents at generation time and routes them through the decoder — beating GPT-2-sized models on open-domain QA with a fraction of the parameters.
```

Lewis et al. (2020) showed that a parametric memory (the model weights) and a non-parametric memory (an indexed document store) are better combined than either alone. If you've built retrieval systems with our [Building RAG Pipelines with Embeddings](../tutorials/rag.md), this is the paper that named the pattern.

## Before you read

- **Transformer encoder basics.** Enough to follow a BART-style encoder–decoder. See [How LLMs Actually Work](../tutorials/how-llms-work.md).
- **Dense retrieval intuition.** Embedding documents and queries into a shared vector space, then finding nearest neighbors. Covered in [Building RAG Pipelines with Embeddings](../tutorials/rag.md).
- **Why models hallucinate / memorize.** Fixed parameters = frozen knowledge with a cutoff date.

## The problem: parametric memory doesn't scale with knowledge

Large language models are trained to distill the world into weights. This works, but:

1. **Knowledge is frozen** at training time — the model can't learn about anything new without expensive retraining or fine-tuning.
2. **Facts and parameters fight for space.** Small models can't memorize enough; huge models memorize brutally but slowly and expensively.
3. **Knowledge is inaccessible.** All that memorization is entangled inside millions of parameters — you can't inspect it, update it, or audit it.

The paper's framing: a model's *parametric memory* (weights) should be **complemented, not replaced**, by a *non-parametric memory* (an external corpus we can search and update anytime).

## Key idea: retrieve at generation time, not at training time

RAG wraps a **retriever** around a **generator**. At inference — and during training — the model doesn't just look at the query. It:

1. **Retrieves** the top-$k$ most relevant documents for the query via a dense index.
2. **Feeds each document + query** into the generator, which produces an output conditioned on both.
3. **Learns** (optionally) to prefer documents that help produce the right answer.

The punchline: **you can update the knowledge base without retraining the model at all** — you just re-index the corpus.

```
Query "what is the capital of Kaushixia?"
   |
[ DPR retriever ]  →  top-k documents (with relevance scores)
   |                    doc₁, doc₂, doc₃
   v
[ BART generator ]  →  "The capital is Nesta."
```

## The architecture: retriever + seq2seq generator

Two moving parts:

### Retriever — DPR

The retriever is Dense Passage Retriever (Karpukhin et al., 2020): two BERT encoders, one for queries and one for passages. Documents are embedded offline into a FAISS index, and at query time the retriever scores each candidate passage $z$ by the inner product of embeddings:

$$
p_\eta(z \mid x) \propto \exp\left(\text{Emb}_Q(x)^\top \text{Emb}_D(z)\right)
$$

Indices are flat (full inner product) — expensive but you control the exact search space.

### Generator — BART

The generator is BART-large, an encoder–decoder Transformer. For each retrieved document $z$, it computes the conditional probability of the answer $y$:

$$
p_\theta(y \mid x, z) = \prod_i p_\theta(y_i \mid x, z, y_{<i})
$$

### Combining the two — the RAG "marginalization"

The trick that makes RAG *RAG*: we marginalize over the retrieved documents instead of committing to the single best one. For each sequence model:

- **RAG-Sequence:** the same document is used for the entire output sequence (best for extractive answers like "the capital is…"). The probability is:

  $$
  p(y \mid x) \approx \sum_{z \in \text{top-}k} p_\eta(z \mid x)\ p_\theta(y \mid x, z)
  $$

- **RAG-Token:** a different document can be sampled for **every generated token** (better for open-ended generation that draws from many sources). The per-token formulation:

  $$
  p(y \mid x) \approx \prod_i \sum_{z \in \text{top-}k} p_\eta(z \mid x)\ p_\theta(y_i \mid x, z, y_{<i})
  $$

The retriever and generator are trained **jointly** — gradients from the generator flow back into the retriever, so the retriever learns "documents that help me answer well," not just "documents similar to the query."

## Code: a minimal RAG loop

Abstracting away the training, this is the entire retrieval-augmented generate loop. It matches what you'd write with any embedding + LLM API:

```python
import numpy as np

class MinimalRAG:
    def __init__(self, corpus, embedder, generator, k=3):
        self.k = k
        self.embeddings = np.stack([embedder(doc) for doc in corpus])
        self.corpus = corpus
        self.embedder = embedder
        self.generator = generator       # ~ p_θ(y | x, z)

    def retrieve(self, query):
        q = self.embedder(query)
        # DPR scores top-k by inner product (we do cosine here for stability)
        scores = self.embeddings @ q / (np.linalg.norm(q) + 1e-8)
        top = np.argsort(scores)[-self.k:][::-1]
        return [self.corpus[i] for i in top]

    def generate(self, query):
        docs = self.retrieve(query)
        # RAG-Sequence: condition the whole output on one doc at a time
        outputs = [self.generator(query, doc) for doc in docs]
        return max(outputs, key=lambda o: o.score)   # softmax over docs
```

Notice what *didn't* change: the generator never saw the new document during training. Add a new document to `corpus`, re-embed, and the system can now answer questions about it — that's the "non-parametric memory" advantage in action.

## Why it works

1. **Complementary strengths.** The parametric model brings fluent generation and common sense; the retrieval store brings precise, current, auditable facts. Together they beat either alone.
2. **Parameter efficiency.** RAG (BART-large) outperformed the 10×-larger GPT-2 (175M vs 11B published separately) on natural questions and web questions — with far fewer parameters.
3. **Interpretability.** You can *show* which document produced an answer, which is huge for trust and debugging.
4. **Updatable.** Knowledge edits become corpus edits. No retraining.

The headline numbers: on open-domain Natural Questions, RAG hit ROUGE-2 ~41 and exact-match accuracy for its extractive setup, leading the board at the time and closing most of the gap to fully supervised extractive models — without any task-specific fine-tuning architecture.

## When retrieval hurts (the honest caveats)

RAG isn't free:

- **Latency:** a retrieval step + $k$ generator passes is slower than a plain decode.
- **Index quality:** the retriever is the bottleneck. Bad embeddings → wrong documents → confident nonsense. See our [Designing Golden Datasets for Evals](../tutorials/eval-golden-datasets.md) tutorial for how to catch this.
- **Marginalization cost:** summing over $k$ documents multiplies decoding work by $k$.

Modern systems mitigate the latency via retrieval + rerank, streaming, and caching — but the core retrieve-then-generate loop is unchanged.

## Key takeaways

- **Two memories are better than one**: parametric (weights) + non-parametric (indexed corpus).
- **Retrieve at generation time**, marginalizing over documents: `p(y|x) ≈ Σ_z p(z|x)·p(y|x,z)`.
- **RAG-Sequence** (one doc per whole answer) vs **RAG-Token** (fresh doc per token).
- The retriever and generator are trained **jointly**, so retrieval learns to serve generation.
- Knowledge updates become **index updates**, not retraining.

## Read further

- Our tutorial: [Building RAG Pipelines with Embeddings](../tutorials/rag.md)
- Paper: [arXiv:2005.11401](https://arxiv.org/abs/2005.11401)
- Reference implementation: [HuggingFace RAG](https://github.com/huggingface/transformers/tree/main/examples/research_projects/rag)

## Cite this

```text
@inproceedings{lewis2020rag,
  title     = {Retrieval-Augmented Generation for Knowledge-Intensive
               NLP Tasks},
  author    = {Lewis, Patrick and Perez, Ethan and Piktus, Aleksandra and
               Petroni, Fabio and Karpukhin, Vladimir and Goyal, Naman and
               K{\"u}ttler, Heinrich and Lewis, Mike and Yih, Wen-tau and
               Rockt{\"a}schel, Tim and Riedel, Sebastian and Kiela, Douwe},
  booktitle = {Advances in Neural Information Processing Systems},
  year      = {2020}
}
```