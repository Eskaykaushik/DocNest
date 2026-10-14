# LoRA: Low-Rank Adaptation of Large Language Models

```callout
**In one sentence:** instead of fine-tuning all 175 billion weights of a model, freeze it and train two tiny low-rank matrices whose product is added to each weight matrix — matching full fine-tuning quality with a fraction of the parameters, and no extra inference latency.
```

This paper (Hu et al., 2022) is why you can now ship one base model plus a drawer full of small task adapters. It builds on the parameter-efficient side of [How LLMs Actually Work](../tutorials/how-llms-work.md).

## Before you read

- **Matrix multiplication** and the shape of a linear layer.
- **Fine-tuning.** Continuing training on a target dataset after pre-training.
- **Model size intuition.** GPT-3 is 175B parameters; every full fine-tune produces another 175B-parameter artifact.

## The problem: fine-tuning doesn't scale to many tasks

Full fine-tuning updates every weight. That means:

1. **Storage explodes.** Each task needs its own complete copy of the model — 10 tasks means 10 × 175B parameters.
2. **Serving is expensive.** Switching tasks means swapping massive models in and out of memory.
3. **It is overkill.** Much of what a task needs is a small *adjustment*, not a rewrite of the entire network.

Prior methods (adapters, prefix-tuning) shrink the *training* cost but **add inference latency**: they insert new layers or extra tokens that every forward pass must push through. LoRA wants both low training cost *and* zero added latency.

## Key idea: learn a low-rank correction, not new weights

Freeze the pre-trained weight $W_0 \in \mathbb{R}^{d \times k}$ and represent the update as a **low-rank** product of two small matrices:

$$
W = W_0 + \Delta W = W_0 + B A
$$

where $A \in \mathbb{R}^{r \times k}$ and $B \in \mathbb{R}^{d \times r}$, and the rank $r \ll \min(d, k)$.

Only $A$ and $B$ are trained. If $d = k = 4096$ and $r = 8$, full fine-tuning updates ~16.7M weights per matrix while LoRA updates ~65K — about **250× fewer**.

The forward pass becomes:

$$
h = W_0 x + \Delta W x = W_0 x + B A x
$$

Two details make it train cleanly:

- **$A$ is initialized with small random values, $B$ at zero.** So $\Delta W = BA = 0$ at the start: training begins exactly at the pre-trained model.
- A scaling factor $\alpha / r$ is applied to $\Delta W$, so changing $r$ does not require retuning the learning rate.

## Why a low-rank update is enough

The bet is that adapting a pre-trained model to a new task does not require changing the model in a full-rank direction. The paper (and the earlier "intrinsic dimensionality" work) argues that the *task-specific* part of the weight change lives in a low-dimensional subspace. So a small $r$ captures almost all of the benefit.

The rank is a single dial: $r = 1$ already helps, $r = 4$ to $r = 16$ is typical, and returns flatten quickly.

## The pay-off: merge before serving

Because $\Delta W = BA$ is just another matrix, you can **fold it into the base weights** once training is done:

$$
W_{\text{merged}} = W_0 + \frac{\alpha}{r} B A
$$

The deployed model is exactly the same architecture and size as the original, so **inference latency is unchanged**. You can also keep adapters separate and swap them at request time, paying only for loading a small matrix pair.

## LoRA at a glance

```
              ┌───────────────┐
   x ─────────▶ W0 (frozen)   ─────────────┐
     │         └───────────────┘            ▼
     │                                     ( + )
     └──▶ A (r×k) ──▶ B (d×r) ─────────────▶
           trained        trained

  params trained: r·(d + k)   vs.   d·k for full fine-tuning
  inference:      merge B·A into W0  →  zero overhead
```

## Results

On GPT-3 175B:

- LoRA matched or beat full fine-tuning on many tasks while training **~10,000× fewer parameters**.
- It outperformed adapters and prefix-tuning at comparable parameter budgets (and without adding latency).
- Multiple low-rank adapters could be combined at inference, and 4-bit base models with LoRA preserved quality — making large models fine-tunable on a single GPU.

## Code: a LoRA linear layer

The entire mechanism is a frozen base weight plus two trainable factors:

```python
import math
import torch
import torch.nn as nn

class LoRALinear(nn.Module):
    def __init__(self, base: nn.Linear, rank: int = 8, alpha: int = 16):
        super().__init__()
        self.base = base
        for p in self.base.parameters():
            p.requires_grad = False          # freeze the original weights
        d_out, d_in = base.weight.shape
        self.A = nn.Parameter(torch.randn(rank, d_in) * (1 / rank))
        self.B = nn.Parameter(torch.zeros(d_out, rank))   # start at ΔW = 0
        self.scale = alpha / rank

    def forward(self, x):
        return self.base(x) + self.scale * (x @ self.A.T @ self.B.T)

    @torch.no_grad()
    def merge(self):
        self.base.weight += self.scale * (self.B @ self.A)
        self.A = self.B = None               # optional: drop the factors
```

The `B = 0` initialization is what makes training stable — without it, the model starts from a perturbed state and early gradients are noisy.

## Limitations

- **Rank is a hyperparameter** that must be tuned per task.
- Merging bakes in one task; serving *many* tasks means keeping adapters separate and doing the extra matmul.
- It does not change what the base model *can* do — LoRA adapts, it does not add knowledge the model never had.

## Key takeaways

- Fine-tuning can be reframed as learning a **low-rank correction** $BA$ to frozen weights.
- Only $A$ and $B$ are trained, cutting trainable parameters by orders of magnitude.
- Initialize $A$ random and $B$ zero so training starts at the pre-trained model.
- $\Delta W$ can be **merged** back into $W_0$ — no inference-side latency.
- LoRA made fine-tuning giant models practical on modest hardware.

## Read further

- Our tutorial: [How LLMs Actually Work](../tutorials/how-llms-work.md)
- Our tutorial: [Serving LLM Applications in Production](../tutorials/serving-llm-apps.md)
- Paper: [arXiv:2106.09685](https://arxiv.org/abs/2106.09685)
- Code: [microsoft/LoRA](https://github.com/microsoft/LoRA)

## Cite this

```text
@inproceedings{hu2022lora,
  title     = {LoRA: Low-Rank Adaptation of Large Language Models},
  author    = {Hu, Edward J. and Shen, Yelong and Wallis, Phillip and Allen-Zhu, Zeyuan and Li, Yuanzhi and Wang, Shean and Wang, Lu and Chen, Weizhu},
  booktitle = {International Conference on Learning Representations},
  year      = {2022}
}
```
