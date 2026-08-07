# Building Your First LangChain Agent

LangChain is a framework for building applications powered by large language models (LLMs). On its own, an LLM can only do one thing: take in text and predict more text. It cannot look up today's weather, query a database, or do arithmetic reliably. LangChain's job is to wrap an LLM with the scaffolding needed to make it *useful* — giving it tools to call, memory to remember past turns, and a structured way to decide what to do next.

This tutorial builds understanding from the ground up: what an agent actually is, why each piece of code exists, and how to avoid the mistakes beginners commonly make. By the end, you'll have a working tool-using agent and a real mental model of how it operates internally — not just code you copied.

> This is a conceptual, hands-on walkthrough aimed at beginners. It is not a production deployment guide. Treat the code as a foundation to build on, not a finished product.

## Prerequisites

Before starting, you should have:

- Python 3.10 or newer installed
- An API key for a model provider (e.g. OpenAI)
- Basic familiarity with Python functions, classes, and dictionaries
- No prior LangChain experience needed

Install the packages you'll need:

```bash
pip install langchain langchain-openai
```

Set your API key as an environment variable so your code never has it hardcoded:

```bash
# macOS/Linux
export OPENAI_API_KEY="your-key-here"

# Windows PowerShell
$env:OPENAI_API_KEY="your-key-here"
```

## Core concept: what is an "agent," really?

Before writing code, it's worth being precise about what an agent is, because the word gets thrown around loosely.

A plain LLM call is a one-shot request: you send a prompt, you get text back, and that's it. The model has no way to *act* — it can only *describe*.

An **agent** changes this by putting the LLM in a loop with access to **tools** (regular functions it's allowed to call). On each turn, the agent:

1. Looks at the user's question and the conversation so far
2. Decides: "Can I answer this directly, or do I need to call a tool first?"
3. If a tool is needed, it calls that tool with some input, and gets a result back
4. It looks at the result and decides again: answer now, or call another tool?
5. This repeats until it has enough information to give a final answer

The LLM itself doesn't execute any code — it only *decides* which tool to call and with what arguments. LangChain is the layer that actually runs the Python function, hands the result back to the model, and manages this loop for you.

This distinction matters: if you understand that the model is just choosing actions in a loop (not magically "doing" things), debugging agents becomes far more intuitive.

## Step 1: Define a tool

A tool is just a regular Python function, decorated so LangChain knows how to describe it to the model. Here's a minimal tool that looks up a fictional product price:

```python
from langchain.tools import tool

@tool
def get_price(product_name: str) -> str:
    """Look up the price of a product by name."""
    catalog = {
        "widget": "$12.00",
        "gadget": "$34.50",
        "gizmo": "$8.75",
    }
    return catalog.get(product_name.lower(), "Product not found")
```

A few things to notice, since each one matters:

- **The `@tool` decorator** turns a normal function into something LangChain can hand to the model as an available action.
- **The docstring is not optional documentation — it's functional.** LangChain sends this docstring to the LLM as the tool's *description*. The model decides whether and when to call `get_price` based only on this text and the function's name. A vague docstring like `"""Gets stuff."""` will cause the model to either never use the tool, or use it incorrectly.
- **Type hints matter too.** `product_name: str` tells the model what kind of input to send. If your tool needs a number, type it as `int` or `float` so the model formats its call correctly.
- **The return value must be a string** (or something convertible to one) — this is what gets fed back into the model's next reasoning step.

Think of writing a tool the same way you'd write an API endpoint for a new intern to use without ever explaining it to them verbally: the docstring is the *entire* explanation they get.

## Step 2: Assemble the agent

Now combine the tool with a model and an agent executor — the component that actually runs the loop described above.

```python
from langchain.agents import initialize_agent, AgentType
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

agent = initialize_agent(
    tools=[get_price],
    llm=llm,
    agent=AgentType.OPENAI_FUNCTIONS,
    verbose=True,
)

response = agent.run("How much does a gizmo cost?")
print(response)
```

Breaking this down line by line:

- **`ChatOpenAI(model=..., temperature=0)`** creates the LLM connection. `temperature` controls randomness — `0` means "always pick the most likely/confident response," which is what you want for tool selection. Higher temperature (closer to `1`) is better suited for creative writing, not for reliably deciding which function to call.
- **`initialize_agent(...)`** wires everything together: which tools are available (`tools=[get_price]`), which model reasons over them (`llm=llm`), and which *strategy* the agent uses to decide when to call a tool (`agent=AgentType.OPENAI_FUNCTIONS` — a strategy built specifically around OpenAI's function-calling feature).
- **`verbose=True`** prints out the agent's internal reasoning steps as it runs — extremely useful while learning, since you can literally watch it decide to call `get_price("gizmo")` before returning an answer.
- **`agent.run(...)`** is what kicks off the loop described earlier: read the question, decide, call tool if needed, read the result, answer.

Running this should print something close to:
Entering new AgentExecutor chain...
Invoking: get_price with {'product_name': 'gizmo'}
$8.75
A gizmo costs $8.75.
The important thing to notice: **the model chose to call `get_price("gizmo")` on its own.** You never told it "if the user asks about a price, call this function." It inferred that from the tool's name and docstring, matched against the user's question.

## Step 3: Understand what happens when you add a second tool

This is the part most tutorials skip, and it's where the real learning happens. Let's add a second tool and watch how the agent *chooses* between them:

```python
@tool
def get_stock(product_name: str) -> str:
    """Check how many units of a product are currently in stock."""
    stock = {
        "widget": 120,
        "gadget": 0,
        "gizmo": 47,
    }
    count = stock.get(product_name.lower())
    if count is None:
        return "Product not found"
    return f"{count} units in stock"

agent = initialize_agent(
    tools=[get_price, get_stock],
    llm=llm,
    agent=AgentType.OPENAI_FUNCTIONS,
    verbose=True,
)

agent.run("Is the gadget in stock, and how much does it cost?")
```

With `verbose=True`, you'll see the agent call **both** tools in sequence — `get_stock("gadget")` first, then `get_price("gadget")` — before combining both results into one final sentence. It figured out on its own that answering the question fully required two separate lookups.

This is the core skill to build as a beginner: instead of memorizing agent code, get comfortable reading the verbose trace and predicting what the agent will do *before* running it. That habit alone will save you hours of confused debugging later.

## Step 4: Expose the agent over a small API

So far the agent only runs inside a Python script. To call it from a browser or any external client, wrap it in a minimal HTTP endpoint. The specific web framework doesn't matter much at this stage — the important part is the shape: a single `POST /ask` route that accepts a question and returns text.

Conceptually:

```python
# pseudocode — swap in your preferred framework (Flask, FastAPI, etc.)
@app.post("/ask")
def ask(question: str):
    answer = agent.run(question)
    return {"answer": answer}
```

Two things worth keeping in mind once you get here:

- **Re-initializing the agent on every request is wasteful.** Create it once when your server starts, and reuse the same `agent` object across requests.
- **`agent.run()` is synchronous and can take a few seconds**, especially with multiple tool calls. For real applications, you'd typically run this in an async-friendly way so one slow request doesn't block others — but that's a topic for a more advanced tutorial.

## Step 5: Call it from JavaScript

On the client side, a small `fetch` wrapper is all you need — no framework required:

```javascript
async function askAgent(question) {
  const response = await fetch("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  if (!response.ok) {
    throw new Error(`Agent request failed: ${response.status}`);
  }

  const { answer } = await response.json();
  return answer;
}
```

This function sends the user's question to your `/ask` endpoint, waits for the JSON response, and returns just the `answer` field. From a UI's perspective, this is indistinguishable from calling any other backend API — all the agent complexity is hidden behind that one route.

## Common pitfalls (and why they happen)

| Symptom | Likely cause | Why it happens | Fix |
|---|---|---|---|
| Agent never calls the tool | Docstring too vague | The model only sees the docstring, not your code | Rewrite with a concrete, specific description |
| Agent calls the wrong tool | Overlapping tool descriptions | Model can't distinguish between two similarly-worded tools | Make descriptions more distinct and specific |
| Inconsistent answers between runs | Temperature too high | Higher temperature adds randomness to *every* decision, including tool selection | Set `temperature=0` for tool-calling tasks |
| Agent calls a tool with malformed input | Missing or wrong type hints | The model infers the expected input shape from your type hints | Add precise type hints (`str`, `int`, etc.) |
| Agent loops or calls the same tool repeatedly | Tool result doesn't clearly answer the sub-question | Model can't tell if it already has what it needs | Make tool return values explicit and unambiguous |

## Glossary (for quick reference)

- **LLM** — the underlying language model (e.g. GPT-4o-mini) that generates text and decides on actions.
- **Tool** — a regular function the agent is allowed to call, described to the model via its docstring and type hints.
- **Agent** — the loop that lets an LLM decide, act via tools, observe results, and repeat until it can answer.
- **AgentExecutor** — the LangChain component that actually runs this loop (created behind the scenes by `initialize_agent`).
- **Temperature** — a setting controlling how random/creative the model's outputs are; `0` is most deterministic.

## Wrapping up

You now have a working tool-using agent, an understanding of *why* each piece of code exists (not just that it works), and a client that can talk to it over HTTP. From here, a good next exercise is to intentionally write a vague tool docstring, run the agent, and watch it fail to call the tool — then fix the docstring and watch it succeed. That single exercise will teach you more about how agents "think" than reading ten more code samples.