# Language Models are Few-Shot Learners (GPT-3)

```callout
**In one sentence:** scale a plain decoder-only Transformer to 175 billion parameters and it starts solving tasks from a few examples *in the prompt*, no gradient updates required — a phenomenon called in-context learning.
```

This paper (Brown et al., 2020) turned "just make it bigger" from a hunch into a research program. It builds directly on the decoder-only view of the Transformer in our [How LLMs Actually Work](../tutorials/how-llms-work.md) tutorial.

## Before you read

- **Autoregressive language modeling.** The model predicts the next token, again and again. That is the *entire* training objective.
- **The Transformer decoder.** Causal self-attention, stacked with feed-forward layers. See [Transformers Explained](../tutorials/transformers.md).
- **Fine-tuning.** The old default: collect labeled data for each task, update the weights. GPT-3 asks whether that is even necessary.

## The problem: every task needed its own labels

In 2020, the recipe for strong NLP was: pre-train a model, then **fine-tune** it on a task-specific labeled dataset. That works, but it has three costs:

1. **You need labels.** Thousands of examples per task, which is expensive and slow to collect.
2. **Generalization is narrow.** A fine-tuned model can be brittle to distribution shift — it exploits spurious patterns in the training set.
3. **Humans don't learn this way.** A person can do a new task from a one-line instruction and a couple of examples, with no weight updates.

GPT-3's question: can a large enough language model do the same — learn a task from the prompt alone?

## Key idea: in-context learning

The model's weights are frozen. The "learning" happens entirely inside the prompt, as the model conditions on examples and continues the pattern:

```
Zero-shot:  Translate English to French:
            cheese =>
            -> fromage

One-shot:   Translate English to French:
            sea otter => loutre de mer
            cheese =>
            -> fromage

Few-shot:   Translate English to French:
            sea otter => loutre de mer
            peppermint => menthe poivrée
            plush giraffe => girafe peluche
            cheese =>
            -> fromage
```

Nothing is trained. The examples act as a **conditioning signal**, and the task is inferred on the fly. Accuracy tends to rise with the number of examples — but only once the model is large enough.

## The model: size is the intervention

GPT-3 is an autoregressive decoder-only Transformer, architecturally close to GPT-2 but far bigger:

| Model    | Parameters | Layers | Heads | Context |
|----------|-----------:|-------:|------:|--------:|
| GPT-3 Small  | 0.125B | 12  | 12 | 2048 |
| GPT-3 Medium | 0.35B  | 24  | 16 | 2048 |
| GPT-3 Large  | 0.76B  | 24  | 16 | 2048 |
| GPT-3 XL     | 1.3B   | 24  | 24 | 2048 |
| GPT-3 2.7B   | 2.7B   | 32  | 32 | 2048 |
| GPT-3 6.7B   | 6.7B   | 32  | 32 | 2048 |
| GPT-3 13B    | 13B    | 40  | 40 | 2048 |
| GPT-3 175B   | 175B   | 96  | 96 | 2048 |

The key experimental move is the **sweep**: train the same architecture at eight sizes on the same data and measure how few-shot ability changes with scale.

## The math: one objective, everything else emergent

Training minimizes the negative log-likelihood of the next token over a large corpus:

$$
\mathcal{L} = -\sum_{t} \log P_\theta(x_t \mid x_{<t})
$$

where $x_{<t}$ is the sequence of tokens before position $t$. That is the whole loss — no task heads, no per-task objectives.

For **classification**, GPT-3 does not use a classification head. Instead it scores each candidate completion by its conditional log-probability and picks the highest:

$$
\hat{y} = \arg\max_{y \in \mathcal{Y}} \; P_\theta(y \mid \text{prompt})
$$

For multiple-choice questions this means comparing the log-probability of each answer string. For multiple-choice, vanilla GPT-3 is actually *worse* than fine-tuning — because it ranks whole continuations rather than scoring the exact answer token — a gap later fixed by simply re-normalizing over the answer tokens.

## The surprising result: emergent ability

Few-shot performance is flat and near-random for small models, then jumps sharply past a threshold. The same prompt that a 1.3B model fails at, a 175B model performs well on. The capability does not improve smoothly — it **emerges** with scale.

When you plot accuracy against model size, small models look flat across shot counts, while large models climb steeply from zero- to few-shot. In-context learning is a **large-model property**, not a generic one.

## Results worth remembering

- GPT-3 175B few-shot matched or beat fine-tuned state of the art on several benchmarks: TriviaQA, LAMBADA, and translation into/out of English.
- Performance scales smoothly with model size and with the number of in-context examples.
- On tasks where fine-tuning still won (natural-language inference, reading comprehension), the gap was small — and closing.
- It wrote passable code and simple arithmetic, despite learning none of these explicitly.

## Code: rank choices like GPT-3 does

Multiple-choice tasks are scored by comparing the model's likelihood of each completion:

```python
import torch
import torch.nn.functional as F

def score_choice(model, prompt_ids, choice_ids):
    """Log-probability the model assigns to `choice_ids` after `prompt_ids`."""
    ids = torch.cat([prompt_ids, choice_ids], dim=-1)
    logits = model(ids)                                  # (1, seq, vocab)
    logprobs = F.log_softmax(logits, dim=-1)
    start = prompt_ids.shape[-1]
    total = 0.0
    for i, tok in enumerate(choice_ids[0]):
        total += logprobs[0, start - 1 + i, tok].item()  # predict token i from i-1
    return total

def answer(model, prompt_ids, choices):
    return max(range(len(choices)),
               key=lambda i: score_choice(model, prompt_ids, choices[i]))
```

The subtle bug in the original paper: they scored every completion *per token* rather than normalized by length, which penalized longer correct answers. Normalizing by token count recovers most of the gap to fine-tuning.

## Why it mattered

- **Prompting became a first-class interface.** You can change a model's behavior without touching its weights.
- **Scale became a strategy.** The clean scaling curves gave the field a reason to invest in huge models.
- **Emergent abilities entered the vocabulary**, along with the debate over whether they are real or an artifact of metrics (later papers argued the latter — the curves can look sharp purely from thresholded accuracy).

The weaknesses were just as consequential: GPT-3's few-shot gains were uneven, its reasoning shaky, and its outputs were not reliably aligned with human intent — the exact problems our next paper, [InstructGPT](instructgpt-rlhf.md), set out to fix.

## Key takeaways

- **In-context learning** = solving a new task from examples in the prompt, with frozen weights.
- The training objective never changed; **capability emerged from scale**.
- Few-shot performance improves with both **model size** and **number of examples**.
- Multiple-choice scoring is just comparing next-token log-probabilities.
- A base model is a raw predictor — **steering and safety are separate problems**.

## Read further

- Our tutorial: [How LLMs Actually Work](../tutorials/how-llms-work.md)
- Our paper: [Chain-of-Thought Prompting](chain-of-thought-prompting.md)
- Paper: [arXiv:2005.14165](https://arxiv.org/abs/2005.14165)

## Cite this

```text
@inproceedings{brown2020language,
  title     = {Language Models are Few-Shot Learners},
  author    = {Brown, Tom B. and Mann, Benjamin and Ryder, Nick and Subbiah, Melanie and Kaplan, Jared and Dhariwal, Prafulla and others},
  booktitle = {Advances in Neural Information Processing Systems},
  year      = {2020}
}
```
