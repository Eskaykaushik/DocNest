# Building RAG Pipelines with Embeddings

Retrieval-Augmented Generation (RAG) is how you get an LLM to answer questions about *your* documents instead of only what it memorized during training. You store your content in a searchable index, retrieve the most relevant chunks for a question, and hand them to the model as context. This tutorial builds a complete, minimal RAG pipeline — chunking, embeddings, vector search, and generation — with enough depth that you understand why each piece exists.

The LangChain agent tutorial covers tool use and the Python fundamentals tutorial covers the Python you'll need. This tutorial stands alone, but it reuses those ideas.

## Prerequisites

- Python 3.10+
- `pip install openai chromadb` (the `chromadb` library runs a small local vector store with zero setup)
- An API key for an embedding model and a chat model (this tutorial uses OpenAI's, but any provider works)

## Core concept: why RAG at all?

An LLM's knowledge is frozen at the end of its training run. It doesn't know about your internal documents, your latest release notes, or last week's pricing change — and it will happily invent plausible-looking answers about them. That's called **hallucination**, and it's the fundamental problem RAG exists to solve.

RAG sidesteps the problem instead of trying to fix the model: don't make the model know the answer, just *give* it the answer at question time. The pipeline has four stages:

1. **Chunk** your documents into manageable pieces.
2. **Embed** each chunk into a high-dimensional vector.
3. **Store** those vectors in a searchable index.
4. **Retrieve** the most relevant chunks for a query and send them to the model as context.

The heavy lifting in "relevance" is done by **embeddings** — vectors where semantically similar text lands close together, so that searching for a vector near your question's vector finds the right chunks even when no words match exactly.

## Step 1: Chunk your documents

Models have a context window, and retrieval works better with focused pieces than with one giant blob. Chunking is the art of splitting a document into self-contained units of a few hundred tokens.

```python
def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        start = end - overlap  # overlap preserves context across boundaries
    return chunks

document = open("pricing-policy.txt").read()
chunks = chunk_text(document)
print(f"Split {len(document)} chars into {len(chunks)} chunks")
```

The **overlap** matters more than it looks: without it, a sentence split across a chunk boundary gets truncated on both sides, and retrieval can't find the idea it's missing half of. For a production system, chunk *along paragraph or heading boundaries* rather than blindly counting characters — a chunk that starts and ends cleanly is far more useful to the model.

## Step 2: Embed the chunks

An embedding model converts text into a list of numbers (typically 256–3072 dimensions) such that similar meanings map to nearby points in space. "How much is the Pro plan?" and "What does premium cost?" produce nearby vectors even though they share almost no words.

```python
from openai import OpenAI

client = OpenAI()

def embed(texts: list[str]) -> list[list[float]]:
    response = client.embeddings.create(model="text-embedding-3-small", input=texts)
    return [item.embedding for item in response.data]

embeddings = embed(chunks)
print(f"Each chunk is now a vector of {len(embeddings[0])} numbers")
```

Two practical notes:

- **Embeddings are cheap relative to chat completions**, so re-embedding your corpus during development is normal. In production you store them and only embed new chunks as they arrive.
- **The embedding model must match your query-time embedding model.** If you embed your documents with model A and your questions with model B, the two vector spaces are different and retrieval silently breaks. This is a classic gotcha.

## Step 3: Store them in a vector store

A vector store is just a database with an index that supports "find the N vectors nearest to this one" efficiently. Chroma does this in a local file with no server.

```python
import chromadb

collection = chromadb.Client().create_collection("docs")

collection.add(
    ids=[f"chunk-{i}" for i in range(len(chunks))],
    documents=chunks,
    embeddings=embeddings,
)
```

That's it. The store also keeps the original text next to each vector, which we'll need in the next step — the model can't read vectors, it reads text.

## Step 4: Retrieve and generate

Now the query side: embed the question, find the nearest chunks, and construct a grounded prompt.

```python
def search(query: str, top_k: int = 3) -> list[str]:
    result = collection.query(query_embeddings=[embed([query])[0]], n_results=top_k)
    return result["documents"][0]

def answer(question: str) -> str:
    context = "\n\n".join(search(question))
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Answer using only the provided context. "
                                          "If the context doesn't contain the answer, say so."},
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"},
        ],
    )
    return response.choices[0].message.content

print(answer("What is the refund policy?"))
```

Two details do most of the work:

- The system message explicitly forbids answering outside the context. This is what turns "maybe hallucinate" into "admit when it doesn't know."
- Retrieving **top_k** (3) chunks rather than 1 gives the model enough signal to synthesize a complete answer, while keeping the context window under control.

## The feedback loop: quality starts with retrieval

If RAG answers are bad, the instinct is to blame the model. Almost always, it's actually the retrieval that's wrong — the right chunk wasn't found, so the model had nothing to work with. Before touching your prompt, verify retrieval on its own: for a handful of questions you know the answers to, print `search(question)` and check whether the returned chunks actually contain the facts. If they don't:

- Reduce chunk size, or chunk on paragraph boundaries.
- Increase `top_k`.
- Re-check that the embedding model used at index time matches the one at query time.

This "evaluate retrieval separately from generation" mindset is the foundation of the RAG evaluation tutorial you'll build on later.

## Common pitfalls

| Symptom | Likely cause | Fix |
|---|---|---|
| Retrieval returns irrelevant chunks | Chunks too large or split mid-sentence | Chunk on paragraph boundaries; use overlap |
| Answers hallucinate despite RAG | Model told to answer from general knowledge | System message: answer only from context, say "I don't know" otherwise |
| Search works in development, fails after re-indexing | Different embedding model used | Pin the embedding model name everywhere; re-embed after any change |
| Context window overflow | Too many chunks or oversized chunks | Lower `top_k` or chunk size |
| Every query returns the same handful of chunks | Index contains near-duplicate content | Deduplicate documents before indexing |
| Model answers are stale even after adding new docs | Store never re-embedded | Re-run embedding for new/updated chunks, not just the prompt |

## Glossary (for quick reference)

- **RAG** — Retrieval-Augmented Generation: retrieving relevant context and handing it to an LLM before it answers.
- **Chunk** — a self-contained segment of a document, sized to fit comfortably in the context window.
- **Embedding** — a vector of numbers representing text's meaning; similar texts have nearby vectors.
- **Vector store** — a database optimized for nearest-neighbor search over embeddings.
- **Top-K retrieval** — returning the K most similar chunks to a query.
- **Hallucination** — a model confidently producing information it doesn't actually have.
- **Context window** — the maximum prompt + output length a model accepts.

## Wrapping up

RAG is a four-stage pipeline — chunk, embed, store, retrieve — and its failure modes live mostly in the first and fourth stages. Build the retrieval step first and verify it in isolation before you add generation, because a model can only answer with what retrieval gives it. A good next step: index a real document set (your own notes, or a public manual), and test how answer quality changes as you vary chunk size and `top_k`.
