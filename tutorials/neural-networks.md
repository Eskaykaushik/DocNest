# Neural Networks from Scratch

Machine learning models like random forests learn rules from data. A neural network does something stranger: it's a giant pile of numbers — weights and biases — that learn to transform input into output by being nudged in the right direction, millions of tiny corrections at a time. This tutorial builds a small neural network from scratch in NumPy so you can see every moving part, then shows the same thing in PyTorch the way it's really done. It's the direct prerequisite for understanding Transformers and LLMs.

You need the Machine Learning fundamentals (features, labels, train/test split) and NumPy basics.

## Prerequisites

- Python 3.10+
- `pip install numpy torch` (the NumPy-only part needs nothing else)
- The ML fundamentals tutorial — split, fit, predict, score

## Core idea: a network is just math

A neural network is a stack of layers. Each layer multiplies its input by a matrix of **weights** (`W`), adds a vector of **biases** (`b`), and pushes the result through a nonlinear **activation** function. Chain enough layers together and the combined function can represent astonishingly complex patterns — that's the whole trick.

```python
import numpy as np

def relu(x):
    return np.maximum(0, x)   # activation: pass positives, zero out negatives

# One layer: input (3 features) -> hidden (4 neurons)
W1 = np.random.randn(3, 4)    # weights
b1 = np.zeros(4)              # biases
X = np.random.randn(5, 3)     # 5 samples, 3 features each

hidden = relu(X @ W1 + b1)    # @ is matrix multiplication
print(hidden.shape)           # (5, 4) — 5 samples, 4 hidden values
```

The **activation function** is the reason the network isn't just one big linear operation (which would be boring). Without it, stacking layers would collapse into a single matrix multiplication — no more powerful than one layer. With it, the network can represent curves, boundaries, and distinctions that straight lines can't.

## Training = gradient descent, in one idea

A network starts with random weights and produces garbage. Training fixes this with a loop:

1. **Forward pass** — push the data through and get predictions.
2. **Compute the loss** — one number saying how wrong the predictions are.
3. **Backward pass** — work out how each weight should change to reduce the loss. This is **backpropagation**, and it's just the chain rule of calculus applied smartly, layer by layer.
4. **Update** — nudge every weight in the direction that lowers the loss, by a step size called the **learning rate**.
5. Repeat, thousands of times.

That nudge is called **gradient descent**, and the "learning" you keep hearing about is literally this loop. There's no magic in a trained model — it's just a set of numbers tuned by millions of tiny corrections.

## A complete network in NumPy

Here's a two-layer network trained on a tiny synthetic problem, written out so you can see every piece:

```python
import numpy as np

np.random.seed(42)

# Synthetic data: XOR-like pattern
X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], dtype=float)
y = np.array([[0], [1], [1], [0]], dtype=float)   # XOR

# Init
W1 = np.random.randn(2, 4) * 0.5
b1 = np.zeros(4)
W2 = np.random.randn(4, 1) * 0.5
b2 = np.zeros(1)
lr = 0.5

def sigmoid(x):
    return 1 / (1 + np.exp(-x))

for _ in range(20000):
    # Forward
    z1 = X @ W1 + b1
    a1 = np.tanh(z1)
    z2 = a1 @ W2 + b2
    pred = sigmoid(z2)

    # Loss (mean squared error)
    loss = np.mean((pred - y) ** 2)

    # Backward (chain rule)
    dz2 = (pred - y) * pred * (1 - pred)
    dW2 = a1.T @ dz2
    db2 = dz2.sum(axis=0)
    dz1 = (dz2 @ W2.T) * (1 - a1 ** 2)
    dW1 = X.T @ dz1
    db1 = dz1.sum(axis=0)

    # Update
    W2 -= lr * dW2
    b2 -= lr * db2
    W1 -= lr * dW1
    b1 -= lr * db1

print(np.round(pred, 1).ravel())   # ~[0 1 1 0] — the XOR learned
```

Read the loop carefully and you'll see the two halves: the **forward pass** (compute predictions) and the **backward pass** (compute the gradients). The backprop lines look scary but they're mechanical — each layer's gradient is derived from the layer after it. Notice also that the gradient updates are all *small* (scaled by `lr`) — that slowness is deliberate, and it's why training takes so many iterations.

## The same thing in PyTorch

In practice nobody hand-writes gradients. PyTorch records every operation and computes them for you, so the forward pass is all you write:

```python
import torch

model = torch.nn.Sequential(
    torch.nn.Linear(2, 4),
    torch.nn.Tanh(),
    torch.nn.Linear(4, 1),
    torch.nn.Sigmoid(),
)

X_t = torch.tensor(X)
y_t = torch.tensor(y)
loss_fn = torch.nn.MSELoss()
optimizer = torch.optim.SGD(model.parameters(), lr=0.5)

for _ in range(20000):
    pred = model(X_t)                 # forward
    loss = loss_fn(pred, y_t)         # loss
    optimizer.zero_grad()
    loss.backward()                   # backward (automatic)
    optimizer.step()                  # update

print(torch.round(model(X_t), decimals=1).ravel())  # ~[0 1 1 0]
```

Compare with the NumPy version and the correspondence is exact: `Linear` layers replace the manual `X @ W + b`, `loss.backward()` is the entire backprop block, and `optimizer.step()` is the update. The concepts you just learned by hand are precisely what the framework automates — which is why building one from scratch once is worth it.

## Deep learning is just "more layers, bigger data"

The "deep" in deep learning refers to stacking *many* layers. More layers let the network build hierarchical understanding: in image models, early layers detect edges, middle layers detect shapes, late layers detect objects. LLMs are the same idea at massive scale — attention layers stacked a hundred deep, trained on billions of tokens. The training loop you just wrote, with a slightly better loss function and far more parameters, is the loop that trains GPT. Nothing fundamentally different — just bigger.

## Common pitfalls

| Symptom | Likely cause | Fix |
|---|---|---|
| Network predicts the same value for everything | Weights not initialized well, or learning rate too high/low | Scale initial weights small; try a smaller `lr` |
| Loss barely moves | Learning rate too small, or data not scaled | Increase `lr` or normalize inputs to ~0–1 |
| Loss explodes to `NaN` | Learning rate too high | Decrease `lr` |
| Great on training, bad on new data | Overfitting (see ML fundamentals) | Add more data, or regularization (e.g. dropout) |
| Training "works" but is slow | Hand-writing loops | Let a framework like PyTorch do backprop |

## Glossary (for quick reference)

- **Weight / bias** — the learnable numbers inside a network; the entire model is these.
- **Activation** — a nonlinear function (ReLU, tanh, sigmoid) that lets stacked layers represent complex patterns.
- **Forward pass** — computing predictions by pushing data through the network.
- **Loss** — one number measuring how wrong the predictions are.
- **Backpropagation** — computing the gradient of the loss w.r.t. every weight, via the chain rule.
- **Gradient descent** — repeatedly nudging weights in the direction that lowers the loss.
- **Learning rate** — the size of each weight update.
- **Layer** — one transform (weights + bias + activation) in the stack.

## Wrapping up

You've now seen every part of a neural network with your own hands: weights, activations, the forward pass, and gradient descent via backpropagation. Nothing in deep learning — including the Transformer architecture in the next tutorial — adds a concept you haven't already met; it just scales it up and optimizes it. A good next step: retrain the NumPy network on real data (any two-feature classification problem) and watch the loss curve as you vary the learning rate, until you can predict what will happen before you run it.
