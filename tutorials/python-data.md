# Python Data Essentials

Before you can do machine learning, you need to move data around in Python efficiently. This tutorial covers the three libraries that show up in nearly every ML project — **NumPy** for fast numerical computation, **pandas** for tabular data, and **matplotlib** for seeing what your data looks like. It's the practical foundation the Machine Learning tutorial builds on.

If you've done the "Python Fundamentals for Building with LLMs" tutorial, you already know the language. This is the data-science layer on top of it.

## Prerequisites

- Python 3.10+
- `pip install numpy pandas matplotlib`
- Comfort with basic Python (lists, loops, functions, dicts)

## Why NumPy arrays instead of lists?

Python lists are flexible but slow — every element is an object with overhead, and a `for` loop over a million numbers is painfully slow. NumPy arrays store data in a contiguous block of memory and operate on the *whole array at once* (this is called **vectorization**). The same math runs dozens of times faster, and it reads far more cleanly.

```python
import numpy as np

prices = np.array([99.0, 149.0, 199.0, 249.0])

discounted = prices * 0.9      # every element at once — no loop
print(discounted)              # [89.1 134.1 179.1 224.1]

total = prices.sum()           # 696.0
mean_price = prices.mean()     # 174.0
```

That `prices * 0.9` line is the whole philosophy: describe what you want, not how to loop through it. NumPy also gives you the shapes and indexing you'll need constantly:

```python
matrix = np.array([[1, 2], [3, 4]])
print(matrix.shape)            # (2, 2)  — rows, columns
print(matrix[0, 1])            # 2       — row 0, column 1
print(matrix.T)                # transpose — rows become columns

# A 3x4 array of zeros — handy for preallocating results
zeros = np.zeros((3, 4))
```

Most ML code is really just shaping numbers into the right `ndarray` shapes, so getting comfortable reading `.shape`, slicing `arr[2:5]`, and doing element-wise math (`*`, `+`, `-`, `/`) pays off immediately.

## pandas: tables with labeled columns

pandas adds labels on top of NumPy: columns with names, rows with indexes, and a `DataFrame` that behaves like a spreadsheet you can query from Python.

```python
import pandas as pd

data = pd.DataFrame({
    "city":     ["Bengaluru", "Mumbai", "Delhi"],
    "price":    [120000, 150000, 110000],
    "bedrooms": [2, 3, 2],
})

print(data["price"].mean())           # 126666.67
print(data[data["bedrooms"] >= 3])    # rows where bedrooms >= 3
print(data.shape)                     # (3, 3)
```

The three operations you'll use daily:

- **Select a column:** `df["price"]` (or `df.price`), returning a `Series`.
- **Filter rows:** `df[df["bedrooms"] >= 3]` — the condition produces a boolean Series used to pick rows.
- **Summarize:** `df.describe()` prints count/mean/min/max for every numeric column at once.

Real data is never clean. The most common chores: dropping missing rows (`df.dropna()`), filling them (`df.fillna(0)`), renaming columns (`df.rename(columns={...})`), and reading files (`pd.read_csv("data.csv")`). If you can load, filter, and summarize a DataFrame, you can handle 80% of real-world ML data preparation.

## Reading a real CSV

ML datasets almost always arrive as CSV. The pattern you'll use every single time:

```python
df = pd.read_csv("housing.csv")
print(df.head())          # first 5 rows — sanity check
print(df.shape)           # how many rows and columns
print(df.dtypes)          # is each column numeric or text?
print(df["price"].isna().sum())  # how many missing prices?
```

`df.head()` is the single most-used function in data work. Load something, look at it, ask three questions — how many rows, what types, what's missing — and you already know most of what you need before any ML starts.

## Seeing your data: matplotlib

Machine learning is about patterns, and patterns are usually easier to *see* than to compute. Two plots cover most needs:

```python
import matplotlib.pyplot as plt

# Scatter — is there a relationship between bedrooms and price?
plt.scatter(df["bedrooms"], df["price"])
plt.xlabel("bedrooms")
plt.ylabel("price")
plt.show()

# Histogram — how is price distributed?
plt.hist(df["price"], bins=20)
plt.xlabel("price")
plt.ylabel("count")
plt.show()
```

The habit that separates good ML work from bad: **plot your data before training anything.** A scatter plot will show you the relationship you're about to ask a model to learn, and it will reveal problems (outliers, weird gaps, missing regions) that no metric will warn you about. Plotting first is not a nice-to-have — it's debugging.

## The mental model: everything is a two-dimensional table

Here's the big picture that ties the three libraries together. Machine learning sees the world as one table: **rows are samples, columns are features, and one column is the answer you want to predict** (the label). NumPy stores that table as numbers, pandas labels its columns, and matplotlib shows you what's in it.

```python
X = df[["bedrooms", "sqft"]]   # features — the input table
y = df["price"]                # label — the thing to predict
```

Everything after this tutorial — training a model, evaluating it, building a neural network — is manipulating `X` and `y` shaped exactly like this.

## Common pitfalls

| Symptom | Likely cause | Fix |
|---|---|---|
| `for` loops over NumPy arrays are painfully slow | Looping instead of vectorizing | Replace loops with whole-array operations (`arr * 0.9`, `arr.sum()`) |
| `KeyError` when selecting a column | Typo or the column doesn't exist | `df.columns` to list exact names first |
| Boolean filtering returns every row | Used `&` incorrectly, or `and` instead of `&` | Use `&`/`|` (with parentheses) for pandas conditions, not Python `and`/`or` |
| Plot doesn't show in a notebook | `plt.show()` missing | Call `plt.show()` after building the figure |
| Empty DataFrame after filtering | Column names don't match what you typed | `df.columns` and re-check spelling/case |

## Glossary (for quick reference)

- **NumPy `ndarray`** — a fast, n-dimensional numeric array; the backbone of ML math.
- **Vectorization** — applying an operation to an entire array at once instead of looping.
- **pandas `DataFrame`** — a labeled, spreadsheet-like table of rows and columns.
- **`Series`** — a single labeled column extracted from a DataFrame.
- **Feature (`X`)** — the input columns a model learns from.
- **Label (`y`)** — the column a model is trained to predict.
- **Plotting** — visualizing data before training to check for patterns and problems.

## Wrapping up

You now have the data toolkit: NumPy for fast math, pandas for labeled tables, matplotlib for looking before you leap. The single mental model to carry forward — rows are samples, columns are features, one column is the answer — is exactly how the Machine Learning tutorial will frame everything. A good next step: download any public CSV (housing prices, your own exports), load it, plot every column against the others, and practice filtering rows until the table feels like home.
