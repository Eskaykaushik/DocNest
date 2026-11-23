# GATE DA: Probability & Statistics Notes

Probability and Statistics carry roughly 16 marks in the GATE DA paper, and the concepts keep reappearing inside machine learning questions. This note focuses on the parts that turn into numerical answers: conditional probability, distributions, moments, estimation, testing, and regression.

```callout
**In one sentence:** a GATE probability question is usually asking you to name the experiment, identify the random variable, and apply one rule cleanly — not to do heroic algebra.
```

## The core vocabulary

| Term | Meaning | GATE cue |
| --- | --- | --- |
| Sample space `S` | All possible outcomes | "A die is rolled twice" → 36 ordered pairs |
| Event | A subset of `S` | "At least one six" is a set of outcomes |
| Marginal `P(A)` | Probability of `A` alone | Ignore the other variable |
| Joint `P(A, B)` | Probability both happen | Look for "and" |
| Conditional `P(A|B)` | Probability of `A` given `B` | Look for "given", "if", "known" |
| Independent | `P(A, B) = P(A)P(B)` | Product rule applies |
| Mutually exclusive | `P(A, B) = 0` | Addition rule simplifies |

The most common trap is treating **mutually exclusive** and **independent** as synonyms. They are opposites in practice: if two non-trivial events are mutually exclusive, knowing one happened tells you the other did not, so they are dependent.

## Bayes' theorem

`P(A|B) = P(B|A) P(A) / P(B)`

Expand the denominator with the law of total probability when the event can happen through several routes:

`P(B) = P(B|A)P(A) + P(B|Aᶜ)P(Aᶜ)`

Use this template for medical tests, spam filters, defective batches, and any question that gives you a test accuracy but asks for the probability that a positive result is real.

### Worked template

A disease affects 1% of a population. A test is 99% sensitive and 95% specific.

- `P(D) = 0.01`, `P(+|D) = 0.99`, `P(+|Dᶜ) = 0.05`
- `P(+) = 0.99 × 0.01 + 0.05 × 0.99 = 0.0594`
- `P(D|+) = 0.0099 / 0.0594 ≈ 0.167`

A positive result means about a one-in-six chance of disease, not 99%. Base rates win.

## Random variables and distributions

| Distribution | Use when | Key parameters |
| --- | --- | --- |
| Bernoulli | One yes/no trial | `p` |
| Binomial | `n` independent yes/no trials | `n`, `p` |
| Poisson | Counts of rare events in a fixed window | `λ` |
| Uniform | Every point in an interval is equally likely | `a`, `b` |
| Exponential | Waiting time between Poisson events | `λ` |
| Normal | Sums/averages of many small effects | `μ`, `σ²` |

Moments you should be able to compute on sight:

- `E[aX + b] = aE[X] + b`
- `Var(aX + b) = a²Var(X)`
- `Var(X + Y) = Var(X) + Var(Y)` only when `X` and `Y` are uncorrelated
- `Cov(X, Y) = E[XY] − E[X]E[Y]`
- `Corr(X, Y) = Cov(X, Y) / (σX σY)`

## Estimation and testing

For a sample mean from a large sample, the standard error is `σ/√n`. A 95% confidence interval is roughly `x̄ ± 1.96 × σ/√n` when `σ` is known or `n` is large.

Hypothesis testing is a decision trace, not a formula hunt:

1. State `H0` and `H1` in terms of a parameter.
2. Choose the statistic and its distribution under `H0`.
3. Compute the test statistic from the sample.
4. Compare with the critical value, or compare the p-value with `α`.
5. Reject or fail to reject `H0` — never "accept `H0`".

```callout
**Wording matters:** "fail to reject" means the data did not provide enough evidence. In an MSQ, an option that says "proves H0 is true" is wrong even when the p-value is large.
```

## Regression and correlation

Simple linear regression fits `y = β0 + β1x + ε`. The slope is `β1 = Cov(x, y) / Var(x)`, and `R²` is the fraction of variance in `y` explained by the model. Correlation measures linear association; zero correlation does not imply independence.

## Common pitfalls

- Using `P(A, B) = P(A)P(B)` before checking independence.
- Using Binomial when trials change probability after each draw — that is Hypergeometric.
- Forgetting the `+b` inside `Var(aX + b)` does not change variance, but `a` is squared.
- Rounding a NAT answer to two decimals when the question asks for three.
- Treating a high p-value as proof that the null hypothesis is true.

## Worked example

A spam filter flags about 5% of legitimate mail and catches 90% of spam. Only 2% of incoming mail is spam. You need the probability that a flagged message is actually spam.

**Input:** `P(spam) = 0.02`, `P(flag|spam) = 0.90`, `P(flag|ham) = 0.05`.
**Output:** `P(spam|flag) = 0.2654` — about 27%.

```python
p_spam = 0.02
p_flag_given_spam = 0.90
p_flag_given_ham = 0.05

p_flag = p_flag_given_spam * p_spam + p_flag_given_ham * (1 - p_spam)
posterior = p_flag_given_spam * p_spam / p_flag
print(round(posterior, 4))
```

The denominator is the total probability of a flag: a small contribution from real spam plus a larger contribution from false positives on the huge pile of legitimate mail. That is why a "90% accurate" filter can still be wrong most of the time.

## Glossary

- **CDF** — cumulative distribution function, `F(x) = P(X ≤ x)`.
- **PMF / PDF** — probability mass for discrete variables, density for continuous ones.
- **Sensitivity** — `P(positive | condition present)`.
- **Specificity** — `P(negative | condition absent)`.
- **Standard error** — standard deviation of a sampling statistic, not of the raw data.

## Wrapping up

Practise in this order: Bayes, distributions, moments, confidence intervals, tests. Write the experiment in one sentence before touching the formula — most wrong answers are wrong model choices, not wrong arithmetic. The same base-rate habit appears in [General Aptitude](../tutorials/gate-da-general-aptitude.md) percentage questions.

## Sources

- [GATE 2026 DA syllabus (official PDF)](https://gate2026.iitg.ac.in/doc/GATE2026_Syllabus/DA_2026_Syllabus.pdf)
- [Probability and Statistics — NPTEL](https://nptel.ac.in/courses/111107137)
- [Sheldon Ross, *A First Course in Probability*](https://www.pearson.com/en-us/subject-catalog/p/a-first-course-in-probability/P200000003277)
