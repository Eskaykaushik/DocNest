# GATE AI & Data Science: the syllabus map

GATE's Data Science and Artificial Intelligence paper (code **DA**) is a 2026 addition to the GATE lineup. It is not a renamed Computer Science paper. The subject paper spends its 85 marks across mathematics, programming, databases, machine learning, and core AI — with another 15 marks in General Aptitude.

```callout
**Short version:** study the DA syllabus, not a CS syllabus with the same keywords. A strong CS prep plan overweights operating systems, networks, and architecture; DA spends that time on probability, SQL, model evaluation, and search.
```

## Paper pattern at a glance

| Item | Detail |
| --- | --- |
| Mode | Computer-based test |
| Duration | 3 hours |
| Total marks | 100 |
| Questions | 65 |
| General Aptitude | 15 marks |
| Subject paper (DA) | 85 marks |
| Question types | MCQ, MSQ, NAT |
| Negative marking | Applies to MCQs only |

The mix matters. MSQs reward completeness, NATs punish sloppy rounding, and MCQs make guessing expensive. Practise all three formats, not just multiple choice.

## The eight blocks

The weightage below is indicative, based on the released DA syllabus and the pattern analysed after the first papers. The official notification is the final word for any exam year.

| Block | Indicative marks | What it really tests |
| --- | --- | --- |
| General Aptitude | 15 | Verbal ability, numerical ability, reasoning |
| Probability & Statistics | 16 | Bayes, distributions, estimation, testing, regression |
| Programming, Data Structures & Algorithms | 21 | Python, complexity, sorting, hashing, graphs |
| Machine Learning | 11 | Supervised/unsupervised learning, metrics, validation |
| Artificial Intelligence | 11 | Search, heuristics, logic, inference, CSPs |
| Linear Algebra | 10 | Matrices, rank, eigenvalues, vector spaces |
| Calculus & Optimization | 8 | Derivatives, partials, extrema, constrained optimization |
| Database Management & Warehousing | 8 | ER, relational algebra, SQL, normalization, warehousing |

Programming and probability are the two blocks you cannot defer. Together they are roughly a third of the paper, and both feed into ML questions later. General Aptitude is 15 marks of its own, so it earns a subject note too.

## What each block asks

### General Aptitude

Verbal ability, numerical ability, and reasoning. The questions are short, but the 15 marks are the easiest to recover with daily practice.

### Probability & Statistics

Counting, probability axioms, sample spaces, independent and mutually exclusive events, marginal/conditional/joint probability, Bayes' theorem, expectation and variance, covariance and correlation, common random variables, estimation, confidence intervals, hypothesis testing, and regression.

### Linear Algebra & Calculus

Matrix operations, systems of linear equations, vector spaces, basis and dimension, eigenvalues and eigenvectors, differentiation and integration, partial derivatives, maxima and minima, and optimization basics such as gradient descent and Lagrange multipliers.

### Programming, Data Structures & Algorithms

Python fundamentals, arrays, linked lists, stacks, queues, trees, graphs, recursion, hashing, searching, sorting, asymptotic complexity, and basic graph algorithms such as BFS, DFS, and shortest paths.

### Database Management & Warehousing

Entity-relationship models, the relational model, relational algebra, SQL, functional dependencies, normalization, transactions, concurrency control, and data warehousing concepts.

### Machine Learning

Supervised and unsupervised learning, linear and logistic regression, classification, clustering, feature selection, dimensionality reduction, bias-variance, overfitting, cross-validation, and evaluation metrics.

### Artificial Intelligence

State-space search, uninformed and informed search, heuristics, adversarial search, propositional and first-order logic, knowledge representation, inference, and constraint satisfaction problems.

```callout
**Overlap with DocNest:** the [machine learning fundamentals](../tutorials/ml-fundamentals.md) and [Python data essentials](../tutorials/python-data.md) tutorials cover the intuition behind several DA topics. These subject notes add the exam-facing layer: definitions, traps, and numerical answer discipline.
```

## Subject-wise notes

Each GATE subject has its own note. Work through them in this order, or jump directly to the one you are revising.

| # | Subject note | Marks | Use it for |
| --- | --- | --- | --- |
| 1 | [Syllabus map](../tutorials/gate-da-syllabus.md) | — | Boundaries, pattern, allocation |
| 2 | [Probability & Statistics](../tutorials/gate-da-probability-statistics.md) | 16 | Bayes, distributions, testing |
| 3 | [Linear Algebra](../tutorials/gate-da-linear-algebra.md) | 10 | Matrices, rank, eigenvalues |
| 4 | [Calculus & Optimization](../tutorials/gate-da-calculus-optimization.md) | 8 | Gradients, extrema, constraints |
| 5 | [Programming, DSA & Complexity](../tutorials/gate-da-programming-dsa.md) | 21 | The largest subject block |
| 6 | [DBMS & Warehousing](../tutorials/gate-da-dbms-warehousing.md) | 8 | SQL, normalization, warehousing |
| 7 | [Machine Learning](../tutorials/gate-da-machine-learning.md) | 11 | Metrics, bias-variance, validation |
| 8 | [Artificial Intelligence](../tutorials/gate-da-artificial-intelligence.md) | 11 | A*, logic, constraint solving |
| 9 | [General Aptitude](../tutorials/gate-da-general-aptitude.md) | 15 | Verbal, numerical, reasoning |

General Aptitude has its own note, but give it fifteen focused minutes a day instead of a monthly cram.

## How to use these notes

Every subject note follows the same shape: the exam-facing concept, a compact reference table, the mistakes that cost marks, and one worked example with concrete numbers. Treat the worked example as a template you can replay with different values — GATE numerical answers are usually the same idea wearing a new costume.

## Common pitfalls

- **Preparing from CS questions only** — DA shares math and programming with CS, but not the subject mix.
- **Ignoring NAT precision** — an otherwise correct answer loses the mark if you round early.
- **Memorising formulas without conditions** — `P(A|B)` assumes `P(B) > 0`; Binomial assumes independent trials; a gradient assumes differentiability.
- **Studying AI as only deep learning** — the DA paper asks about search, logic, and CSPs, not transformers.
- **Treating General Aptitude as optional** — 15 marks is more than any single DA subject block.

## Worked example

A candidate has 70 hours left and wants to allocate time by marks across all eight blocks, instead of by comfort.

**Input:** marks — General Aptitude 15, Probability 16, Programming 21, ML 11, AI 11, Linear Algebra 10, Calculus 8, DBMS 8.
**Output:** about 10.5h GA, 11.2h Probability, 14.7h Programming, 7.7h ML, 7.7h AI, 7h Linear Algebra, 5.6h Calculus, and 5.6h DBMS.

```python
weights = {
    "General Aptitude": 15,
    "Probability": 16,
    "Programming": 21,
    "ML": 11,
    "AI": 11,
    "Linear Algebra": 10,
    "Calculus": 8,
    "DBMS": 8,
}
print({name: round(70 * mark / 100, 1) for name, mark in weights.items()})
```

The point is not the arithmetic. It is that time follows marks, so the 21-mark programming block gets more hours than the 8-mark DBMS block even if DBMS feels easier.

## Glossary

- **MCQ** — multiple-choice question; negative marking applies.
- **MSQ** — multiple-select question; choose every correct option.
- **NAT** — numerical answer type; you type a number, with no options to sanity-check against.
- **GA** — General Aptitude, the fixed 15-mark common paper.

## Wrapping up

Start with Probability and Programming, then use their vocabulary in ML. Keep a one-page error log: every wrong answer gets labelled with its subject, its cause, and the rule you missed. After four weeks the log, not the syllabus PDF, tells you what to revise.

## Sources

- [GATE 2026 DA syllabus (official PDF)](https://gate2026.iitg.ac.in/doc/GATE2026_Syllabus/DA_2026_Syllabus.pdf)
- [GATE 2026 official portal](https://gate2026.iitg.ac.in/)
- [GATE Data Science and AI syllabus — pattern and section analysis](https://www.scaler.com/blog/gate-data-science-and-ai-da-syllabus/)
