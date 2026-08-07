# Python Fundamentals for Building with LLMs

You don't need to be a Python expert to use LangChain or LangGraph, but a handful of Python concepts show up constantly in that code — type hints, decorators, dictionaries, and async functions being the big ones. This tutorial covers exactly those, in the context of why they matter for AI tooling specifically, rather than as an abstract "intro to Python."

If you've written basic Python before (variables, `if` statements, `for` loops, functions) but haven't used the concepts below, this tutorial fills that gap.

## Prerequisites

- Python 3.10 or newer installed (`python --version` to check)
- Basic familiarity with variables, functions, and loops
- No prior experience with type hints, decorators, or async needed — we build them from scratch here

## Part 1: Type hints

Type hints are optional annotations that describe what type a variable, argument, or return value is expected to be. Python doesn't strictly enforce them at runtime — but tools like LangChain read them to understand your code, which is exactly why they matter here.

```python
def greet(name: str) -> str:
    return f"Hello, {name}!"
```

Reading this signature: `name: str` says the `name` argument should be a string. `-> str` says the function returns a string. Without running the function, anyone reading this (a human, or in LangChain's case, an LLM inspecting your tool) immediately knows what to pass in and what to expect back.

Common type hints you'll see constantly:

```python
def add(a: int, b: int) -> int:
    return a + b

def get_names() -> list[str]:
    return ["Alice", "Bob"]

def get_user(user_id: int) -> dict:
    return {"id": user_id, "name": "Alice"}

def maybe_find(name: str) -> str | None:
    # the '| None' means this function might return None instead of a string
    return None
```

**Why this matters for LangChain specifically:** when you write a `@tool`-decorated function, LangChain inspects its type hints to tell the LLM what shape of input it expects. If you write `product_name: str`, the model knows to send a string. If you wrote no hint at all, LangChain has to guess — which leads to unreliable tool calls. Precise type hints are one of the highest-leverage things you can do to make an agent behave predictably.

## Part 2: Dictionaries, deeply

Dictionaries (`dict`) store key-value pairs, and they are *everywhere* in LLM application code — API responses, tool outputs, and state objects (like the `SupportState` from the LangGraph tutorial) are all dictionaries or dictionary-like structures.

```python
user = {"name": "Alice", "age": 30}

print(user["name"])          # "Alice" — direct access, errors if key is missing
print(user.get("name"))      # "Alice" — safe access, returns None if missing
print(user.get("email", "no email"))  # "no email" — safe access with a fallback
```

The difference between `user["name"]` and `user.get("name")` trips up a lot of beginners: square-bracket access raises a `KeyError` if the key doesn't exist, while `.get()` returns `None` (or your specified default) instead. When you're working with data returned from an LLM or an external API — where you can't always be 100% sure a field will be present — `.get()` is usually the safer choice.

Updating and merging dictionaries:

```python
user["email"] = "alice@example.com"   # add or overwrite a key

updates = {"age": 31}
user.update(updates)                  # merge another dict's keys in

merged = {**user, **updates}          # create a new merged dict without changing the originals
```

That last pattern — `{**dict1, **dict2}` — is called dictionary unpacking, and it's exactly what LangGraph uses conceptually when merging a node's returned dict back into the overall state: newer values overwrite older ones for matching keys, everything else is preserved.

## Part 3: `TypedDict`

A `TypedDict` (used in the LangGraph tutorial) is a way to tell Python "this dictionary should always have these specific keys, with these specific types" — combining the flexibility of a dict with the safety of type hints.

```python
from typing import TypedDict

class UserRecord(TypedDict):
    name: str
    age: int
    email: str | None
```

This doesn't change how the dictionary behaves at runtime — a `UserRecord` is still a completely normal Python dict. What it does is let your editor and type-checking tools warn you if you try to access a key that doesn't exist, or assign the wrong type to one. This becomes especially valuable in LangGraph, where your state object is passed through many different functions — a `TypedDict` makes it much harder to accidentally typo a key name in one node and have it silently fail elsewhere.

## Part 4: Decorators

A decorator is a function that wraps another function to add behavior to it, without changing its actual code. You've already used one: `@tool` from the LangChain tutorial.

To understand what's happening, here's a decorator written from scratch:

```python
import time

def timed(func):
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        elapsed = time.time() - start
        print(f"{func.__name__} took {elapsed:.2f}s")
        return result
    return wrapper

@timed
def slow_add(a: int, b: int) -> int:
    time.sleep(1)
    return a + b

slow_add(2, 3)
# prints: slow_add took 1.00s
# returns: 5
```

What's happening: `@timed` above `slow_add` is exactly equivalent to writing `slow_add = timed(slow_add)`. The `timed` function takes `slow_add` as input, and returns a new function (`wrapper`) that does some extra work (timing) before and after calling the original function.

`*args` and `**kwargs` deserve a quick explanation since they show up in almost every decorator: `*args` collects any number of positional arguments into a tuple, and `**kwargs` collects any number of keyword arguments into a dict. This lets `wrapper` accept whatever arguments the original function needed, without the decorator needing to know what they are in advance.

**Why this matters for LangChain specifically:** `@tool` works the same way — it wraps your function and adds extra behavior (registering it as something an LLM can call, attaching its docstring as a description) without changing the function's actual logic. Understanding decorators demystifies what `@tool` is actually doing under the hood, rather than it feeling like magic syntax.

## Part 5: Async functions (why they show up in AI code)

LLM API calls are slow relative to normal code — they can take several seconds. If your program calls three different LLMs one after another *synchronously*, you wait for each one to finish before starting the next, even though they don't depend on each other. Async code lets you start all three at once and wait for whichever finishes, without blocking.

```python
import asyncio

async def fetch_answer(question: str) -> str:
    await asyncio.sleep(2)  # simulates a slow network call
    return f"Answer to: {question}"

async def main():
    # Sequential: takes ~6 seconds total
    a1 = await fetch_answer("What is LangChain?")
    a2 = await fetch_answer("What is LangGraph?")
    a3 = await fetch_answer("What is a tool?")

    # Concurrent: takes ~2 seconds total, since all three run at once
    results = await asyncio.gather(
        fetch_answer("What is LangChain?"),
        fetch_answer("What is LangGraph?"),
        fetch_answer("What is a tool?"),
    )

asyncio.run(main())
```

Key vocabulary:

- **`async def`** marks a function as a coroutine — a function that can be paused and resumed, rather than running start-to-finish in one go.
- **`await`** pauses execution at that line until the awaited call finishes, *without blocking the rest of the program* — other async work can proceed while it waits.
- **`asyncio.gather(...)`** runs multiple coroutines concurrently and waits for all of them to finish, which is why the second block above is roughly 3x faster than the first.

You don't need async for a simple learning script. But once you're building something like a server (recall the `/ask` endpoint from the LangChain tutorial) handling multiple users' requests at once, async becomes important — it's what allows one slow LLM call from one user to not freeze the entire server for everyone else.

## Common pitfalls

| Symptom | Likely cause | Fix |
|---|---|---|
| `KeyError` when reading a dict | Used `dict["key"]` on a key that might not exist | Use `dict.get("key", default)` instead |
| Tool called with wrong argument types | Missing or vague type hints on the tool function | Add precise type hints (`str`, `int`, `list[str]`, etc.) |
| `TypeError: object is not callable` after adding a decorator | Decorator's `wrapper` function doesn't return the original function's result | Make sure `wrapper` explicitly `return`s the inner function's output |
| `RuntimeWarning: coroutine was never awaited` | Called an `async def` function without `await` | Add `await` before the call, or run it via `asyncio.run()` at the top level |
| Program runs slower than expected despite using async | Awaited each call one at a time instead of using `asyncio.gather` | Use `asyncio.gather(...)` to run independent calls concurrently |

## Glossary (for quick reference)

- **Type hint** — an annotation describing the expected type of a variable, argument, or return value.
- **`TypedDict`** — a dict subtype with a fixed, typed set of keys, used heavily for state objects.
- **Decorator** — a function that wraps another function to add behavior, written with `@decorator_name` syntax.
- **`*args` / `**kwargs`** — syntax for accepting any number of positional/keyword arguments in a function.
- **Coroutine** — a function defined with `async def` that can be paused (`await`) and resumed.
- **`asyncio.gather`** — runs multiple coroutines concurrently and waits for all to complete.

## Wrapping up

These five concepts — type hints, dictionaries, `TypedDict`, decorators, and async — cover the vast majority of "wait, why is this code written like that?" moments you'll hit while working through LangChain and LangGraph tutorials. A good next step: go back to the `get_price` tool from the LangChain tutorial and try adding a second, more complex tool yourself, paying close attention to how precisely you write its type hints and docstring.