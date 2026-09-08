# Evaluating Agent Trajectories

The tool-call tutorial judged individual actions. This one judges the *whole path*: the sequence of reasoning steps, tool calls, and observations that carry an agent from prompt to answer. That sequence is the **trajectory**, and evaluating it is how you catch agents that are technically correct but structurally broken, or that would be correct if they didn't waste half their budget getting there.

## Prerequisites

- The Evaluating Agent Tool Calls tutorial — trajectory evaluation assumes you can already check individual calls
- Some familiarity with how agents plan: reasoning, then action, then observation (the LangChain tutorial shows this loop in practice)

## What an agent trajectory is

A trajectory is the full record of what the agent did between receiving a prompt and producing its final answer. Concretely, it's a list of steps like this, which most agent frameworks can log for you:

```
[step 0]  thought: "I need prices for two products. Call get_price twice."
[step 1]  tool_call: get_price(product_id="gizmo-3000")
[step 2]  observation: {"price": 8.75, "currency": "USD"}
[step 3]  tool_call: get_price(product_id="widget-7")
[step 4]  observation: {"price": 12.00, "currency": "USD"}
[step 5]  thought: "16.75 total. Both were returned, no errors."
[step 6]  final_answer: "Together they cost $16.75."
```

Trajectory evaluation reads this record and asks: *was the path to the answer a good one?* Not just "did it end correctly," but "were the intermediate decisions sound?" This is where planning quality, efficiency, and the failure patterns below actually get measured.

## Evaluating intermediate steps

When you evaluate a trajectory, you are checking a sequence of *decisions*:

- **Did each reasoning step follow from the actual observations?** The classic bug: the model plans from its assumptions rather than from what the tools returned, then acts on a fiction.
- **Did each tool call have a reason?** A call that the observation makes redundant is a failed intermediate decision, even if it doesn't break the final answer.
- **Was each observation actually used?** Did the agent read the tool result, or barrel ahead as if it had guessed?
- **Were the stop conditions sensible?** Did the agent stop when it had the answer, or keep going until forced?

Checking steps individually is straightforward once the framework gives you structured logs. The habit to build is reading eval failures at the *step* level, not the answer level: a failed case is a signal about a specific intermediate decision, and the trajectory is where you find it.

## The planning / action / observation cycle

Most reactive agents run a tight loop — **plan** → **act** → **observe** → **plan again** — until they produce a final answer. Evaluation targets each phase:

| Phase | What can go wrong | What to check |
|---|---|---|
| Plan/Reason | Decides to act from outdated or invented context | Reasoning must reflect the latest observation |
| Act | Calls the wrong tool, wrong args, or an unnecessary tool | Tool-call checks from the previous tutorial |
| Observe | Ignores the result, or treats a stale result as current | Every act must be followed by a used observation |
| Stop | Ends too early (partial answer) or never ends (loops) | Final-answer completeness + call-count bounds |

A healthy trajectory shows each phase feeding the next: the plan causes an action, the action's observation updates the next plan. When you evaluate, you're checking that chain. The moment a phase stops being driven by what the *last* phase produced, you have a trajectory bug.

## Successful vs. inefficient trajectories

Two trajectories can both produce a correct answer while differing hugely in quality:

| Trajectory | Steps | Quality |
|---|---|---|
| Prices → sums in one pass | 7 steps, 2 tool calls | Good: minimal, grounded, honest |
| Prices → re-checks first price "to be sure" → sums | 11 steps, 4 tool calls | Inefficient: redundant calls, more latency and cost, same answer |

Efficiency metrics make this measurable:

- **Tool calls per task** (compare against the reference trajectory's call count)
- **Model round-trips per task** (each one is latency; each is cost)
- **Tokens per completed task**
- **Depth vs. breadth**: did the agent explore efficiently, or fan out and back up pointlessly?

Inefficiency is not merely an economic nuisance. Redundant steps mean more chance a step goes wrong, more latency for users, and — critically — *cheap evaluation cannot measure it*. A final-answer eval will score the inefficient trajectory 100%.

## Failure patterns

Certain trajectory shapes recur across agents. Recognizing them lets you write targeted eval cases:

- **The unnecessary loop.** The same tool called repeatedly with the same result, as in the tool tutorial's crash-loop — here you see it at the whole-trajectory level.
- **Answer-first planning.** The agent commits to an answer before observing anything and forces the observations to fit it. Look for reasoning that cites facts the tool never returned.
- **Stopping too early.** A multi-part question answered for only one part. Detectable by comparing the question's intents against the final answer's coverage.
- **Forever planning (analysis paralysis).** Many reasoning steps, no actions — or one giant "plan" step that never converges to a tool call.
- **Belief without evidence.** A confident final answer with zero tool calls for a data-dependent question. The "memory pricing" case from the tool tutorial, viewed at trajectory scale.

Once you can name a pattern, you can build dataset cases that trigger it and a check that detects it — which is the practical definition of trajectory evaluation working.

## Example trajectory (and its verdict)

A support agent is asked: "My order #1042 shipped three days ago. Did it leave the warehouse?"

```
[0]  thought: "I need order status. Call get_order_status."
[1]  tool_call: get_order_status(order_id="1042")
[2]  observation: {"status": "in_transit", "shipped_at": "2026-08-01T09:00Z"}
[3]  thought: "Status is in_transit, so it has left the warehouse. Answer."
[4]  final_answer: "Yes — order #1042 is in transit, which means it has left the warehouse."
```

Best-practice trajectory evaluation of this:

- **Steps** — a coherent plan/act/observe loop, one tool call, no redundancy.
- **Groundedness** — every claim in the final answer traces to the observation.
- **Efficiency** — one round trip; reference expects one. 
- **Verdict**: pass. The good version of the same question would add a second call for the tracking URL the user didn't ask for — correct tool use, wasteful trajectory.

## How trajectory evaluation differs from final-answer evaluation

| | Final-answer evaluation | Trajectory evaluation |
|---|---|---|
| What it inspects | The last message | The full step record |
| Question it answers | "Was the output right?" | "Was the *process* right?" |
| Catches | Wrong/hallucinated answers | Wrong process with a lucky outcome |
| Fails to catch | Lucky wrong-process outcomes | Bad final answer despite clean process |
| Typical checks | Substring, LLM judge, exact match | Tool selections, order constraints, call counts, step-groundedness |
| Cost to run | Cheap, few checks | More work; needs structured logs |

You want both. Final-answer eval tells you whether users get good answers; trajectory eval tells you whether the agent is *reliably* good — whether the good answer came from a process you can depend on, or from a broken process that happened to land. For agents that handle money, booking, or anything irreversible, trajectory quality is safety.

## Key Takeaways

- A trajectory is the full plan/act/observe loop record; evaluate the loop, its steps, and its endpoints — not just the endpoint.
- Check that each phase is driven by the previous one's output: plan from the real observation, act from the plan, stop when the answer is in hand.
- Measure efficiency (calls, round-trips, tokens per task) — final-answer evals are blind to wasteful processes.
- Learn the failure patterns — loops, answer-first planning, early stopping, analysis paralysis — and encode each as eval cases.
- Trajectory and final-answer evaluation answer different questions; production agents need both.

## A practical exercise

Take one of your agent's real conversations and reconstruct its trajectory from logs (any framework worth using can output one). Then:

1. Write down the one-line verdict a *final-answer* eval would give.
2. Write down the step-by-step checks a *trajectory* eval would run (selection, args, order, groundedness, call count).
3. Find one step where the two verdicts would disagree — a correct answer arrived at sloppily, or a perfect trajectory with a bad answer.
4. Add that disagreement as a case to your eval dataset.

## Wrapping up

You now evaluate the path as well as the destination. The next tutorial, LLM-as-a-Judge for Agent Evaluation, covers the engine behind most of the fuzzy checks you've seen — teaching a second model to grade planning quality, relevance, and open-ended answers with a rubric.