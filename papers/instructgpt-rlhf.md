# Training Language Models to Follow Instructions with Human Feedback

```callout
**In one sentence:** take a large language model that *predicts* text, and teach it to *help* — by fine-tuning on human demonstrations, training a reward model on human preferences, and optimizing the policy against that reward with reinforcement learning.
```

This paper (Ouyang et al., 2022) is the "InstructGPT" paper — the pipeline that turned raw predictors into assistants. It directly addresses the alignment gap left open by [GPT-3](language-models-are-few-shot-learners.md).

## Before you read

- **Pre-training vs. fine-tuning.** Pre-training learns from raw text; fine-tuning adapts to a narrower goal.
- **Language-model probabilities.** The model assigns a probability to every next token.
- **What a reward is.** A scalar score that says "this output is better than that one."

## The problem: a good predictor is not a good assistant

[GPT-3](language-models-are-few-shot-learners.md) is trained to do exactly one thing: predict the next token of text that looks like its training data. Ask it a question and it might answer, continue the question with more questions, or produce something plausible but wrong. It has the *capability* but not the *intent*.

The gap is simple to state: the training objective (likely text) is not the thing we actually want (outputs that are **helpful, honest, and harmless** — the authors' "3 H" framing). Human-written text is full of contradictions, falsehoods, and off-topic tangents, so imitating it teaches the model to imitate those too. InstructGPT reframes the goal as **following intent**, and turns human feedback into a training signal.

## Key idea: a three-step pipeline

Instead of one objective, InstructGPT uses three stages that build on each other.

### Step 1 — Supervised fine-tuning (SFT)

Collect **human-written demonstrations**: prompts plus the ideal response. Fine-tune the base model on these with the usual next-token loss. This gives a model that at least behaves like an assistant some of the time — and, crucially, a good starting point for the next steps.

### Step 2: Train a reward model on human rankings

This is the heart of it. For each prompt, generate several outputs and have human labelers **rank** them from best to worst. Train a model $r(x, y)$ to predict a scalar score for a prompt $x$ and response $y$ such that the preferred outputs get higher scores.

Rankings are turned into **pairwise** comparisons. For a preferred output $y_w$ and a rejected output $y_l$, the reward model is trained with a Bradley–Terry loss:

$$
\mathcal{L} = -\log \sigma\big(r(y_w) - r(y_l)\big)
$$

This teaches the model to separate better answers from worse ones. The reward model is a *learned proxy for human judgment* — cheap to query, and differentiable.

## Step 3: optimize the policy with PPO

Now treat the language model as a policy and train it with reinforcement learning to maximize the reward model's score. But there is a catch: optimize the reward too hard and the policy drifts into weird text that happens to score well — **reward hacking**. To prevent that, add a penalty that keeps the policy close to its starting point:

$$
\text{objective} = \mathbb{E}\left[ r_\phi(x, y) - \beta \, \mathrm{KL}\!\left(\pi_\theta \,\|\, \pi_{\text{ref}}\right) \right]
$$

- $r_\phi$ is the frozen reward model,
- $\pi_\theta$ is the policy being trained,
- $\pi_{\text{ref}}$ is the frozen model from step 1,
- $\beta$ trades reward against staying close to the reference.

This is **PPO** (proximal policy optimization) with a KL leash. The leash is what makes the whole thing safe.

## The pipeline at a glance

```
Human demonstrations ──SFT──▶ policy π_ref
                                   │
Human preference rankings ──▶ reward model r_φ
                                   │
              policy π_θ ──PPO──▶ maximize r_φ  −  β·KL(π_θ ‖ π_ref)
```

Data scale (roughly): ~13k demonstration prompts for SFT, ~33k comparison prompts for the reward model, and ~31k prompts for PPO.

## The headline result

**A 1.3B-parameter InstructGPT was preferred by human raters over the 175B GPT-3** — more than 100× smaller, yet judged more helpful. Outputs were also:

- More truthful on closed-domain question answering,
- Less likely to fabricate facts,
- Less toxic, with a smaller bias-related performance regression,
- Only a modest "alignment tax" on traditional benchmarks.

This was the surprise: **alignment was not just about scale.** A smaller model aligned to human intent could beat a much larger unaligned one.

## Code: the reward-model loss

The core of the reward model is a single pairwise ranking loss:

```python
import torch
import torch.nn.functional as F

def reward_model_loss(chosen_rewards, rejected_rewards):
    """Bradley-Terry loss: prefer the chosen completion's reward."""
    return -F.logsigmoid(chosen_rewards - rejected_rewards).mean()

# per step: (batch,) tensors, one scalar reward per completion
chosen = reward_model(chosen_input_ids)      # higher is better
rejected = reward_model(rejected_input_ids)
loss = reward_model_loss(chosen, rejected)
loss.backward()
```

Notice there is no target value — the loss only compares two scores. That is why human *rankings* (cheap, reliable) can train the reward model even though humans cannot directly produce a numeric reward.

## Limitations

- **Reward hacking is real.** The policy exploits the reward model's weaknesses.
- **The reward model is imperfect.** It learned human *preferences*, including the raters' biases.
- **Alignment is not solved.** The paper is explicit that this is a step, not a destination, and that safety failures remain.

## Key takeaways

- **Base models predict; InstructGPT follows instructions.** Intent and prediction are different objectives.
- The recipe is **SFT → reward model → PPO**, in that order.
- Human **rankings** (not scores) are the key signal — they are easier to collect and train the reward model pairwise.
- The **KL penalty** is what keeps RL optimization from drifting into reward-hacking nonsense.
- Alignment can make a **small model outperform a much larger unaligned one**.

## Read further

- Our paper: [GPT-3: Language Models are Few-Shot Learners](language-models-are-few-shot-learners.md)
- Our tutorial: [Evaluating LLM Applications](../tutorials/agent-eval-techniques.md)
- Our tutorial: [LLM-as-a-Judge, Done Right](../tutorials/eval-llm-judge.md)
- Paper: [arXiv:2203.02155](https://arxiv.org/abs/2203.02155)

## Cite this

```text
@inproceedings{ouyang2022training,
  title     = {Training language models to follow instructions with human feedback},
  author    = {Ouyang, Long and Wu, Jeff and Jiang, Xu and Almeida, Diogo and Wainwright, Carroll L. and others},
  booktitle = {Advances in Neural Information Processing Systems},
  year      = {2022}
}
```
