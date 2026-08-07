# Building Stateful Workflows with LangGraph

LangChain agents (covered in the previous tutorial) are great for simple tool-calling loops: the model decides what to call, calls it, and answers. But real applications often need more control than that — branching logic, loops that revisit earlier steps, multiple cooperating agents, or a conversation that needs to pause and resume later. This is exactly what **LangGraph** is built for.

LangGraph lets you describe your application as a **graph**: a set of nodes (steps) connected by edges (the paths execution can take between them), with a shared **state** object that flows through the whole thing. If that sounds abstract right now, it will click by the end of this tutorial — we build one from scratch.

> This tutorial assumes you've either completed the LangChain tutorial or are already comfortable with the idea of an LLM calling tools. We build on those concepts rather than repeating them.

## Prerequisites

- Python 3.10 or newer
- An API key for your model provider
- Familiarity with basic LangChain concepts (models, tools) or the previous tutorial in this series

Install what you need:

```bash
pip install langgraph langchain-openai
```

## Core concept: why a graph, instead of just a loop?

A standard LangChain agent loop looks like: *ask model → maybe call tool → ask model again → answer*. This works well when the path is simple and mostly linear.

But consider a more realistic workflow: a customer support bot that needs to (1) classify the type of request, (2) route simple questions to a direct-answer step, but (3) route complex questions to a research step first, and (4) only after research, generate a final answer — and if research comes back empty, loop back and try a different search. 

That's not a simple loop anymore — it's a **flowchart** with branches and possible cycles. Trying to force this into a single linear agent loop gets messy fast. LangGraph instead lets you draw this flowchart directly in code:

- Each **node** is a Python function that does one job (classify, research, answer, etc.)
- Each **edge** defines what runs next, and can be conditional ("if classification is 'simple', go to answer; otherwise go to research")
- A shared **state** object carries data (like the user's question, retrieved research, and the running conversation) between every node

This mental model — nodes doing work, edges deciding what happens next, state carrying data between them — is really the entire idea behind LangGraph. Everything else is details.

## Step 1: Define your state

State is the data structure that every node can read from and write to. In LangGraph, you typically define it as a `TypedDict`:

```python
from typing import TypedDict

class SupportState(TypedDict):
    question: str
    category: str
    answer: str
```

Each field here represents something that will be filled in as the graph runs: `question` starts filled in by the user, `category` gets set by a classification step, and `answer` gets set by whichever step produces the final response.

Think of `SupportState` as a shared clipboard that gets passed from node to node — each node can read what's already written on it, and add its own notes before passing it along.

## Step 2: Write your nodes

Each node is just a function that takes the current state and returns the parts of it that changed:

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

def classify(state: SupportState) -> dict:
    prompt = f"Classify this question as 'simple' or 'complex': {state['question']}"
    result = llm.invoke(prompt)
    category = "simple" if "simple" in result.content.lower() else "complex"
    return {"category": category}

def answer_directly(state: SupportState) -> dict:
    prompt = f"Answer this briefly: {state['question']}"
    result = llm.invoke(prompt)
    return {"answer": result.content}

def research_then_answer(state: SupportState) -> dict:
    # In a real app, this step might call a search tool or database.
    # Here we simulate it by asking the model to reason more thoroughly.
    prompt = f"This is a complex question, answer it in detail: {state['question']}"
    result = llm.invoke(prompt)
    return {"answer": result.content}
```

Notice the pattern: **every node receives the whole state, but only returns the piece it changed.** LangGraph automatically merges that returned dictionary back into the overall state. This keeps each node small and focused — `classify` only cares about setting `category`, it doesn't need to know or touch `answer` at all.

## Step 3: Build the graph

Now wire these nodes together, including the conditional branching logic:

```python
from langgraph.graph import StateGraph, END

graph = StateGraph(SupportState)

graph.add_node("classify", classify)
graph.add_node("answer_directly", answer_directly)
graph.add_node("research_then_answer", research_then_answer)

graph.set_entry_point("classify")

def route_after_classify(state: SupportState) -> str:
    if state["category"] == "simple":
        return "answer_directly"
    return "research_then_answer"

graph.add_conditional_edges("classify", route_after_classify)

graph.add_edge("answer_directly", END)
graph.add_edge("research_then_answer", END)

app = graph.compile()
```

Walking through this step by step:

- **`StateGraph(SupportState)`** creates a new graph that will use `SupportState` as its shared data structure.
- **`graph.add_node("classify", classify)`** registers a node — the first argument is a name (used for wiring edges), the second is the function itself.
- **`graph.set_entry_point("classify")`** tells LangGraph where execution should start when the graph runs.
- **`route_after_classify`** is a small function that looks at the current state and returns the *name* of the next node to run. This is what makes the branching "conditional" — the path taken depends on data in the state, not a fixed sequence.
- **`graph.add_conditional_edges("classify", route_after_classify)`** connects the classify node to whichever node `route_after_classify` decides on.
- **`graph.add_edge("answer_directly", END)`** and the equivalent for the research node say: once either of these finishes, the graph is done. `END` is a special built-in marker for "stop here."
- **`graph.compile()`** turns this definition into something you can actually run.

## Step 4: Run the graph

```python
result = app.invoke({"question": "What's your refund policy?", "category": "", "answer": ""})
print(result["answer"])
```

You pass in an initial state — even fields you don't have values for yet need a placeholder — and `app.invoke(...)` runs the graph from the entry point until it hits `END`, returning the final state. Depending on how the model classifies the question, it will have taken either the `answer_directly` path or the `research_then_answer` path, and you can inspect `result["category"]` to see which one it picked.

## Step 5: Understand cycles (the part a plain LangChain agent can't easily do)

The real power of LangGraph shows up when a workflow needs to **loop back**, not just branch. Suppose `research_then_answer` sometimes comes back empty, and in that case you want to try again with a different approach before giving up:

```python
def research_then_answer(state: SupportState) -> dict:
    prompt = f"This is a complex question, answer it in detail: {state['question']}"
    result = llm.invoke(prompt)
    answer = result.content
    if not answer.strip():
        return {"answer": ""}  # signal that research came up empty
    return {"answer": answer}

def route_after_research(state: SupportState) -> str:
    if state["answer"] == "":
        return "research_then_answer"  # try again
    return END

graph.add_conditional_edges("research_then_answer", route_after_research)
```

Here, `route_after_research` can send execution *back* to `research_then_answer` itself, creating a loop. This is something a simple linear agent chain cannot express cleanly — but in a graph, it's just another conditional edge. (In a real system, you'd want a retry limit here to avoid an infinite loop — see the pitfalls table below.)

## When to use LangGraph vs. a plain LangChain agent

| Situation | Better fit |
|---|---|
| Single agent, calls a few tools, answers | Plain LangChain agent |
| Multiple distinct steps with clear logic between them | LangGraph |
| Need branching based on intermediate results | LangGraph |
| Need retry loops or "try again" logic | LangGraph |
| Multiple cooperating agents (e.g. a "researcher" and a "writer") | LangGraph |
| You want to visualize or reason about the flow as a diagram | LangGraph |

## Common pitfalls

| Symptom | Likely cause | Fix |
|---|---|---|
| Graph runs forever / never reaches `END` | A conditional edge routes back into a loop with no exit condition | Add a counter to state and route to `END` after a max number of attempts |
| `KeyError` when accessing state | A field wasn't included in the initial `invoke()` call, or a node returned the wrong key name | Make sure the initial state dict includes every field defined in your `TypedDict`, and node return keys match exactly |
| Wrong branch taken every time | Routing function has a bug, or the classification prompt isn't reliable | Print/log the state before the conditional edge to see what value it's actually routing on |
| Node's changes don't show up in later nodes | Node returned the full state object instead of just the changed fields | Return a small dict with only the fields that changed |

## Glossary (for quick reference)

- **State** — the shared data structure (usually a `TypedDict`) that flows through every node in the graph.
- **Node** — a function representing one step of work; reads state, returns the parts it changed.
- **Edge** — a connection saying what runs after a given node.
- **Conditional edge** — an edge whose destination is decided at runtime by a routing function, based on the current state.
- **Entry point** — the node where graph execution begins.
- **`END`** — a built-in marker meaning "execution stops here."

## Wrapping up

You've now built a graph with branching logic and understand how to add cycles for retry-style behavior — the two things a plain agent loop struggles to express cleanly. A good next step is to extend the `SupportState` with a `history: list[str]` field, and have each node append a short note to it, so you can print the full path the graph took after it finishes running.