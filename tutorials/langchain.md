# Building Your First LangChain Agent

This tutorial walks through wiring up a small tool-using agent with LangChain, then
calling it from a browser-based client written in vanilla JavaScript. By the end you'll
have an agent that can look up a value and reason about what to do with it.

> This is a conceptual walkthrough, not a production deployment guide. Treat the code
> below as a starting point you'll adapt to your own tools and models.

## Prerequisites

Before starting, you should have:

- Python 3.10 or newer
- An API key for your model provider of choice
- Basic familiarity with functions and classes in Python

## Step 1: Define a tool

Agents become useful once they can call tools. Here's a minimal tool that looks up a
fictional product price:

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

The docstring matters here — LangChain uses it to describe the tool to the model, so the
model knows when it's appropriate to call `get_price`.

## Step 2: Assemble the agent

Next, combine the tool with a model and a lightweight agent executor:

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

Running this should print something close to `A gizmo costs $8.75.` The model decided on
its own to call `get_price("gizmo")` rather than guessing.

## Step 3: Expose it over a small API

To call this from a browser, wrap the agent in a minimal HTTP endpoint. Any lightweight
framework works here — the specifics aren't the point, just that the agent lives behind a
single `POST /ask` route that accepts a question and returns text.

## Step 4: Call it from JavaScript

On the client side, a small fetch wrapper is all you need — no framework required:

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

## Common pitfalls

A few things tend to trip people up the first time:

1. **Vague tool descriptions.** If the docstring doesn't clearly say what the tool does,
   the model may never call it.
2. **Too many tools at once.** Start with one or two tools, confirm the agent uses them
   correctly, then expand.
3. **No temperature control.** Leaving temperature at its default can make tool selection
   inconsistent — setting `temperature=0` helps for tool-calling tasks.

| Symptom                          | Likely cause                     | Fix                              |
|-----------------------------------|-----------------------------------|------------------------------------|
| Agent never calls the tool         | Docstring too vague               | Rewrite with a concrete example    |
| Agent calls the wrong tool         | Overlapping tool descriptions     | Make descriptions more distinct    |
| Inconsistent answers               | High temperature                  | Set `temperature=0`                |

## Wrapping up

You now have a working tool-using agent and a client that can talk to it. From here, a
natural next step is adding a second tool and observing how the model chooses between
them.
