# Function Calling with LLM APIs

Function calling (also called tool calling) is the mechanism that lets an LLM *request* a call to a function you provide, with structured arguments, instead of just returning text. It's the raw material underneath every agent — LangChain's `@tool` decorator (from the earlier tutorial) is a convenience layer over this exact API. This tutorial builds the same thing from scratch against the OpenAI API so you can see precisely what's happening under the hood.

If you understand this, the higher-level agent frameworks stop feeling like magic: they're just this loop, packaged.

## Prerequisites

- Python 3.10+
- `pip install openai`
- An OpenAI (or compatible) API key — the code works with any provider exposing the same tool-calling API
- Familiarity with a normal `chat.completions.create` call

## Core concept: the request/response dance

Here's the thing to internalize: a model does not *call* your function. A model *asks permission to call it*, in a strictly formatted way, and your code decides whether to comply.

The loop has exactly two phases:

1. **Send** your messages plus a list of tool *definitions* (name, description, parameters).
2. **Receive** either a normal text reply or a `tool_calls` request with the function name and a JSON object of arguments. If it's a tool call, you run your function and append the result as a new message, then go back to step 1.

That loop — call, check for tool request, execute, feed the result back, repeat — is the entire "agent loop" you've read about.

## Step 1: Define a tool as a Python function

```python
import json

def get_weather(city: str, unit: str = "celsius") -> str:
    """Fake weather lookup — replace with a real API in production."""
    return json.dumps({"city": city, "temp": 22 if unit == "celsius" else 72})

print(get_weather("Bengaluru"))
# {"city": "Bengaluru", "temp": 22}
```

Nothing model-related yet. This is the function your system actually runs — the source of truth. The model never sees this code; it sees only the *description* you write for it next.

## Step 2: Describe the tool to the model

The model needs a schema, not your code. This is where the quality of your descriptions decides everything — the model uses them to pick the right tool and fill in correct arguments.

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current temperature for a city.",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "City name, e.g. 'Bengaluru'.",
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "Temperature unit. Defaults to celsius.",
                    },
                },
                "required": ["city"],
            },
        },
    }
]
```

Two rules that make tool definitions reliable:

- **Write the description like it's the only hint the model gets** — because it is. A vague description ("get weather") produces vague calls. "Get the current temperature for a city" plus the parameter descriptions produces good calls.
- **Mark fields `required` explicitly.** If `city` weren't listed in `required`, the model might omit it. Forgetting `required` is the most common reason tool calls arrive half-formed.

## Step 3: Run the loop

Now the full dance: send messages with the tool list, inspect what the model wants, execute, and loop back.

```python
from openai import OpenAI

client = OpenAI()

def ask_with_tools(user_message: str) -> str:
    messages = [{"role": "user", "content": user_message}]

    for _ in range(5):  # safety cap on loop iterations
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=tools,
        )
        message = response.choices[0].message

        if not message.tool_calls:
            return message.content  # no tool requested — normal answer, done

        # The model wants tool calls. Execute each one.
        messages.append(message)
        for call in message.tool_calls:
            if call.function.name == "get_weather":
                args = json.loads(call.function.arguments)
                result = get_weather(**args)

            # Feed the result back as a "tool" message.
            messages.append({
                "role": "tool",
                "tool_call_id": call.id,
                "content": result,
            })

    return "Reached max tool-call iterations."

print(ask_with_tools("What's the weather in Mumbai right now?"))
```

Walk through what happens on "What's the weather in Mumbai right now?":

1. The model sees `get_weather` is available and returns a `tool_calls` list asking for `get_weather` with `{"city": "Mumbai"}` — it does **not** invent a temperature.
2. Your code executes the real function.
3. The result is appended as a `role: "tool"` message, linked to the call via `tool_call_id`.
4. The model reads the result and produces the final, grounded answer.

The `tool_call_id` link is the subtle but crucial detail: the model needs to know *which* tool request a given result belongs to, especially when a single response requests multiple tool calls.

## Why this is a loop, and why it can loop badly

The model can request a tool, see the result, and decide it needs *another* tool. That's the agent reasoning loop — and it's why the cap `for _ in range(5)` exists. Without it, a buggy tool or a confused model can bounce between tools forever, burning money. Real agent frameworks do exactly this loop internally; you just get it for free (with their own limits configured).

This is also where **evaluation** starts to matter: because the model decides which tools to call, a change to one tool's description can ripple through every downstream behavior. That's precisely the kind of regression the Evaluation tutorial teaches you to catch.

## Parallel calls and the `tool_call_id` rule

A single response may contain *multiple* `tool_calls`. When that happens, execute them all, and append one `tool` message per call with its matching `tool_call_id`. Returning results in the wrong order or mis-matched ids produces confusing failures that are hard to debug.

```python
# Note: results are linked by id, not by order.
messages.append({"role": "tool", "tool_call_id": call.id, "content": result})
```

## Common pitfalls

| Symptom | Likely cause | Fix |
|---|---|---|
| Model calls the wrong tool | Tool descriptions overlap or are vague | Make each description specific about what it does and when to use it |
| Tool call arrives with missing fields | Fields not listed in `required` | Add every mandatory field to `required` |
| `JSONDecodeError` on `call.function.arguments` | The model produced slightly malformed JSON | Parse defensively and ask the model to retry on failure |
| "Too many tool calls" loop | Tool keeps returning data that prompts another call | Raise your loop cap *and* fix the underlying prompt/tool logic |
| Results appear to belong to the wrong call | Mis-matched `tool_call_id` | Always echo `call.id` back in the matching `tool` message |
| Function works in chat, never gets invoked by the model | Description doesn't say *when* to use it | Add a "Use when…" clause to the description |

## Glossary (for quick reference)

- **Function/tool calling** — the API pattern where a model requests a structured call to a user-provided function.
- **Tool definition** — the JSON schema (name, description, parameters) the model sees.
- **`tool_calls`** — the part of a model response requesting execution of one or more tools.
- **`tool` message** — a message carrying a tool's result back to the model, linked by `tool_call_id`.
- **Agent loop** — the repeated send → check tool calls → execute → feed back → send cycle.
- **`tool_call_id`** — the identifier linking a tool result to the specific call it answers.

## Wrapping up

Function calling is two steps you now own end to end: describing your functions to the model in a schema, and running the send-execute-feed-back loop until the model has what it needs. The `@tool` decorators from the framework tutorials are nothing more than this loop wearing a friendlier coat. A good next step: add a second tool (say, a product lookup) to the loop above, give it an overlapping description with `get_weather`, and watch how much the quality of tool *selection* depends on how you write the descriptions.
