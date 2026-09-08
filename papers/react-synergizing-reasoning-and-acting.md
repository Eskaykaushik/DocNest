# ReAct: Synergizing Reasoning and Acting in Language Models

```callout
**In one sentence:** give an LLM a loop where it *reasons* (writing thoughts) and *acts* (calling tools), interleaved, and the two reinforce each other — letting the model solve multi-step tasks it could neither reason through nor act through alone.
```

Yao et al. (2022) is the intellectual ancestor of most agent frameworks you've touched — including the ones behind our [Building Your First LangChain Agent](../tutorials/langchain.md), [Building Stateful Workflows with LangGraph](../tutorials/langgraph.md), and [Function Calling](../tutorials/function-calling.md) tutorials.

## Before you read

- **Chain-of-Thought prompting.** Reasoning traces alone — [our paper walkthrough](../papers/chain-of-thought-prompting.md) covers it, and it's the direct predecessor of ReAct.
- **Tool use / function calling** intuition: letting a model query Wikipedia, run code, or search the web.
- **Reinforcement-learning agents** — the paper compares against *acting-only* RL agents too, and you'll get more out of it if you know what those look like.

## The problem: thinking and doing are treated as separate problems

By 2022 there were two dominant paradigms for getting LLMs to do more than answer:

1. **Reasoning-only (Chain-of-Thought)** — the model thinks, but stays *trapped in its parameters*. It can't check facts, fetch new information, or fix its own arithmetic by computation.
2. **Acting-only agents** — the model calls tools, but without deliberation: actions get chosen without recorded reasoning, so the model can't adapt its course when something goes wrong.

Each alone fails on multi-hop tasks. Reasoning alone can't ground itself; acting alone is brittle and opaque. ReAct's whole argument is: **these aren't competing paradigms** — you should interleave them.

## Key idea: thoughts and actions, interleaved

ReAct gives the language model a *scratchpad* and a loop. At each step the model emits one of:

- **Thought** — free-text reasoning about what to do next (`Thought: I need to know the population…`),
- **Action** — a tool call (`Action: Search[population of France]`),
- **Observation** — the tool's result, fed straight back into the context,
- …repeat, until a **Finish** action emits the final answer.

```
Thought: I need to compare populations, but I don't know them.
Action: Search[population of Germany, France]
Observation: Germany ≈ 84M, France ≈ 68M
Thought: Germany has more. I have both numbers now.
Action: Finish[Germany]
```

Each turn is just more text in the prompt — the model literally writes its own future context. There is **no training** involved: it's prompting, with an execution loop on the outside.

## The math (light)

There isn't much math — that's the beauty. The generation loop is a fixed point. With a model $\pi_\theta$ and a policy prompt $P$, the agent's next token distribution conditions on the full trace so far:

$$
p_\theta(\text{trace}_{t+1} \mid \text{trace}_t, P) = \prod_i p_\theta(\text{token}_i \mid \text{trace}_t, \text{token}_{<i}, P)
$$

The *acting* part is what makes this non-trivial: observations from the environment are **non-differentiable and sampled**, so you can't backprop — you simply append the observed result to the context and let the model continue. Reasoning updates beliefs; actions ground those beliefs in the world.

## Why interleaving wins

Three concrete benefits the paper demonstrates on HotpotQA, ALFWorld (a text-based kitchen simulator), and FEVER:

1. **Grounding.** Actions return real observations, so the model can't drift into hallucinated facts. Reasoning becomes *evidence-based*.
2. **Course correction.** Because reasoning is written down, when an action fails ("document not found") the model can *see* the failure and try a different route.
3. **Interpretability and controllability.** The whole trajectory is a human-readable transcript — you can audit *why* the agent answered, and you can even inject guidance mid-loop by editing the trace.

Numbers from the paper: on HotpotQA, ReAct *without any task-specific fine-tuning* outperformed all prior prompting methods and matched a fine-tuned 32,000-parameter model that had seen the dataset. In ALFWorld, ReAct jumped from **nothing solves it** (0% success for prompted baselines) to **28% with a zero-shot prompt and ~70% with few-shot**.

## Code: a ReAct loop in ~40 lines

Everything interesting lives in the loop wiring. The model is a black box; the tools are plain Python functions; the "agent" is a `while` loop around the prompt.

```python
TOOLS = {
    "Search": lambda q: search_engine.run(q),
    "Lookup": lambda term: wikipedia.lookup(term),
    "Calculator": lambda expr: eval(expr),      # you'd sandbox this in production
}

def react_agent(client, question, max_steps=8):
    trace = f"Question: {question}\n"
    for _ in range(max_steps):
        response = client.complete(
            f"{trace}Thought:"
        )
        thought = response.split("\n", 1)[0]
        trace += f"Thought: {thought}\n"

        action = client.complete(f"{trace}Action:").split("\n", 1)[0]
        trace += f"Action: {action}\n"

        name, _, arg = action.partition("[")
        arg = arg.rstrip("]")
        if name == "Finish":
            return arg
        observation = TOOLS[name](arg)          # non-differentiable, sampled
        trace += f"Observation: {observation}\n"
    return trace

print(react_agent(client, "Who is older, the author of this paper or Demis Hassabis?"))
```

Replace `client.complete` with any LLM and you have a genuinely functional ReAct agent. This exact shape — think → act → observe loop — is what LangChain and LangGraph wrap up for you today, and our [Building Your First LangChain Agent](../tutorials/langchain.md) tutorial builds a production-ish version of it.

## Why it works

- **It's prompting, so it inherits pretraining.** No RL, no fine-tuning — the loop is grounded in the same "think before you infer" text the model already saw.
- **Self-correcting attention.** Each Observation lands in the context, letting later tokens attend to earlier failures.
- **Explicit scratchpad.** Volume of useful computation per step goes up relative to CoT because the loop *forces* alternating thought/action, keeping the model honest.

## Limits (what ReAct isn't)

- **Sampling cost per step** — every loop iteration is a full model call; hot loops get expensive.
- **No persistent memory** — each trace lives or dies in one context window. Long-horizon tasks need summarization (follow-up work).
- **Brittle tool grammar** — errors in the `Action[arg]` syntax can derail the whole trajectory; parsing needs care.
- **Bad tools, bad traces** — the agent is only as reliable as the observations it feeds itself.

## Key takeaways

- **Thinking alone and acting alone are both crippled; interleaving both fixes the two deficits at once.**
- The agent is a **prompt + loop**, not a new architecture: thoughts/actions/observations are just context text.
- Reasoning **grounds** actions; actions **correct** reasoning. That two-way street is the whole trick.
- The scaffold (think → act → observe → finish) is the DNA of today's agent frameworks.

## Read further

- Our tutorial: [Building Your First LangChain Agent](../tutorials/langchain.md)
- Our tutorial: [Function Calling](../tutorials/function-calling.md)
- Related paper: [Chain-of-Thought Prompting](../papers/chain-of-thought-prompting.md)
- Paper: [arXiv:2210.03629](https://arxiv.org/abs/2210.03629)
- Reference implementation: [princeton-nlp/ReAct](https://github.com/princeton-nlp/ReAct)

## Cite this

```text
@inproceedings{yao2023react,
  title     = {ReAct: Synergizing Reasoning and Acting in Language Models},
  author    = {Yao, Shunyu and Zhao, Jeffrey and Yu, Dian and Du, Nan
               and Shafran, Izhak and Narasimhan, Karthik and Cao, Yuan},
  booktitle = {International Conference on Learning Representations},
  year      = {2023}
}
```