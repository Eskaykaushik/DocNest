# Machine Learning Fundamentals

Machine learning is the field of writing programs that *learn from data* instead of being hand-coded. Instead of you writing rules ("if the house has 3 bedrooms, price it at…"), you show the computer thousands of examples and it figures out the rules itself. This tutorial covers the core concepts — features and labels, training vs. test data, overfitting, and the standard workflow — with a real, working example you can run. It's the bridge between Python data skills and the deep learning tutorials that follow.

If you've done the "Python Data Essentials" tutorial, you have everything you need.

## Prerequisites

- Python 3.10+
- `pip install scikit-learn`
- Comfort with pandas DataFrames and NumPy arrays

## The mental model: X predicts y

Every ML problem, no matter how sophisticated, starts as the same shape. You have a table where **rows are examples**, some **columns are inputs (`X`)**, and one **column is the answer you want to predict (`y`)**.

- Predicting house prices: `X` = bedrooms, size, location… `y` = price
- Spam detection: `X` = email text, `y` = "spam" or "not spam"
- Image classification: `X` = pixels, `y` = "cat", "dog", or "car"

Two broad families:

- **Supervised learning** — you have `y` and teach the model to predict it (regression for numbers, classification for categories).
- **Unsupervised learning** — you have only `X` and the model finds structure (clustering, grouping customers).

Most of this tutorial is supervised learning, because that's what nearly every practical model — including the LLMs and agents you'll build later — actually does under the hood.

## The cardinal sin: evaluating on the data you trained on

Here's the trap that defines the entire field. If you train a model on data and then measure its accuracy on *that same data*, the number looks great — because the model has memorized the answers. The moment it meets new data, it falls apart.

The fix is the single most important practice in ML: **split your data**. Train on one part, test on a part the model has never seen.

```python
from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)
```

- `train_test_split` shuffles and carves off 20% of your data for testing.
- The model only ever sees `X_train`/`y_train` during training.
- You measure success on `X_test`/`y_test` — the part it's never seen.
- `random_state=42` makes the split reproducible, so your results can be compared run to run.

Never, ever judge a model by how it does on its own training data. Judge it by the holdout set.

## A complete first model

Let's train a real classifier end to end. The Iris dataset (a classic) has 150 flowers with four measurements and a species label — a perfect first problem.

```python
from sklearn.datasets import load_iris
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

iris = load_iris()
X, y = iris.data, iris.target

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)          # learn from the training data

predictions = model.predict(X_test)  # predict on never-seen data
print(f"Accuracy: {accuracy_score(y_test, predictions):.2f}")
# Accuracy: 1.00  (Iris is easy — don't expect this on real data)
```

That's the complete supervised learning loop, and it's the same loop every model follows for the rest of your ML career: **split → fit → predict → score**. The only things that change between problems are the algorithm, the data, and the evaluation metric.

## Underfitting vs. overfitting

The deep question is *why* a model fails, and it comes down to two failure modes:

- **Underfitting** — the model is too simple to capture the pattern. It does poorly on *both* training and test data. Fix: use a more powerful model, add features, train longer.
- **Overfitting** — the model is so flexible it memorizes the training data, quirks and noise included. It does *great* on training data but *poorly on new data*. Fix: simplify the model, add more data, or add regularization.

How do you know which one you have? Compare the two numbers: **train accuracy vs. test accuracy**. Both low → underfitting. Train high, test low → overfitting. That gap between training and test performance is the single most informative number in machine learning, and you should always compute both.

## Metrics: accuracy is not always enough

`accuracy_score` counts how many predictions were right. That's fine when classes are balanced — but imagine a fraud detector where 99% of transactions are legitimate. A model that says "not fraud" for everything gets 99% accuracy while catching zero fraud. Useless.

For those cases you need more precise metrics:

- **Precision** — of everything the model *flagged*, how much was actually correct? (Minimize false alarms.)
- **Recall** — of everything that *should* have been flagged, how much did it catch? (Minimize missed cases.)
- **F1** — a balanced blend of the two.

```python
from sklearn.metrics import classification_report

print(classification_report(y_test, predictions))
```

Pick the metric that matches the cost of being wrong. For fraud and disease detection, missing a case is far worse than a false alarm — optimize recall. For spam, annoying someone with a false "spam" is bad — optimize precision. The metric is the contract for "what does good mean," and it must match the business cost, not the default.

## The workflow in one sentence

Real ML work always follows the same rhythm, and it's worth internalizing before you add any complexity:

1. **Load and inspect** the data (see the Python Data Essentials tutorial).
2. **Split** into train and test.
3. **Fit** a *simple* baseline model first — you need a number to beat.
4. **Measure** train and test performance separately.
5. **Iterate** — add features, try another algorithm, compare against the baseline.

Start simple, get a number, then improve. Teams that skip step 3 often polish a complicated model for weeks without ever knowing a trivial one would have matched it.

## Common pitfalls

| Symptom | Likely cause | Fix |
|---|---|---|
| 99% accuracy, model still useless | Metric doesn't match the problem (imbalanced classes) | Use precision/recall/F1 instead of raw accuracy |
| Great on training, terrible on new data | Overfitting | Simplify the model, add data, or compare train vs. test gap |
| Good scores, but "it just got lucky" | No holdout set — scored on training data | Always use `train_test_split` before fitting |
| Random results across runs | No fixed `random_state` | Set `random_state=42` on splits and models |
| Model crashes on text/categorical data | Algorithms need numbers | Encode categories to numbers (e.g. one-hot encoding) |

## Glossary (for quick reference)

- **Feature (`X`)** — the input columns a model learns from.
- **Label (`y`)** — the target column a model predicts.
- **Supervised learning** — learning from labeled examples (regression / classification).
- **Unsupervised learning** — finding structure in unlabeled data (clustering).
- **Train/test split** — holding out a slice of data the model never trains on, to measure true performance.
- **Overfitting** — memorizing training data so well that new data fails.
- **Underfitting** — too simple to capture the real pattern.
- **Baseline** — a simple first model that gives you a number to beat.

## Wrapping up

Machine learning is one loop — split, fit, predict, score — plus the discipline of never trusting a number measured on training data. The overfitting concept you learned here is the seed of everything that follows: when deep learning models "hallucinate" or generalize badly, it's the same disease with fancier symptoms. A good next step: take any CSV, split it, fit a `RandomForestClassifier` or regressor, and deliberately print train vs. test accuracy to *see* the gap before moving to the Deep Learning tutorial.
