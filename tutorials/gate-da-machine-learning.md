# GATE DA: Machine Learning Notes

Machine Learning carries about 11 marks in the GATE DA paper, but its ideas leak into probability, linear algebra, and programming questions too. This subject note covers the exam-facing core: model families, the bias-variance trade-off, validation, and metrics.

```callout
**In one sentence:** a model is only as good as the question its metric answers — accuracy on a skewed dataset can be 90% and completely useless.
```

## The model families

| Family | Examples | GATE cue |
| --- | --- | --- |
| Supervised regression | Linear regression, polynomial regression | Predict a number |
| Supervised classification | Logistic regression, SVM, decision trees, kNN, Naive Bayes | Predict a label |
| Unsupervised clustering | k-means, hierarchical clustering | No labels; find groups |
| Dimensionality reduction | PCA | Compress features while keeping variance |
| Ensembles | Bagging, boosting, random forests | Reduce variance or bias |

Linear regression minimises squared error. Logistic regression models `P(y=1|x)` with a sigmoid and minimises log loss. SVMs maximise the margin. k-means alternates between assigning points to the nearest centroid and moving centroids to their assigned points' means.

## Bias, variance, and overfitting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| High train error, high test error | Underfitting / high bias | Richer model, better features, less regularisation |
| Low train error, high test error | Overfitting / high variance | More data, regularisation, pruning, dropout |
| Train and test error both low | Good fit | Validate on a fresh split |
| Good CV, poor production | Leakage or distribution shift | Audit feature availability and time ordering |

Expected test error decomposes into bias² + variance + irreducible noise. A more flexible model lowers bias but raises variance.

## Validation discipline

- Split into train/validation/test before fitting anything.
- Fit scalers, imputers, and feature selectors on the training fold only.
- Use k-fold cross-validation when the dataset is small.
- Use stratified splits for imbalanced classification.
- Touch the test set once, at the end.

```callout
**Leakage test:** if a feature would not be available at prediction time, delete it. A timestamp that encodes the label after the event is the classic GATE trap.
```

## Choosing a metric

| Problem | Metric to reach for | Why |
| --- | --- | --- |
| Balanced classification | Accuracy | Simple and interpretable |
| Imbalanced classification | Precision, recall, F1, PR-AUC | Accuracy hides the minority class |
| Ranking | ROC-AUC | Measures separation across thresholds |
| Regression | MAE, RMSE, R² | Different penalties for large errors |
| Probabilities | Log loss | Rewards calibrated confidence |

From a confusion matrix:

- `Precision = TP / (TP + FP)`
- `Recall = TP / (TP + FN)`
- `F1 = 2 × Precision × Recall / (Precision + Recall)`
- `Accuracy = (TP + TN) / (TP + TN + FP + FN)`

## Common pitfalls

- Reporting accuracy when 90% of cases belong to one class.
- Computing the confusion matrix with predicted and actual labels swapped.
- Standardising the whole dataset before splitting.
- Tuning hyperparameters on the test set.
- Assuming a high ROC-AUC means good performance on rare positives — check PR-AUC.

## Worked example

A fraud model is evaluated on 100 transactions: 90 legitimate, 10 fraudulent. It predicts "legitimate" for every case. The team reports 90% accuracy and asks if the model is ready.

**Input:** `TP=0`, `FP=0`, `TN=90`, `FN=10`.
**Output:** accuracy `0.90`, precision `0`, recall `0`, F1 `0` — not ready.

```python
tp, fp, tn, fn = 0, 0, 90, 10
accuracy = (tp + tn) / (tp + fp + tn + fn)
precision = tp / (tp + fp) if tp + fp else 0
recall = tp / (tp + fn) if tp + fn else 0
f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0
print(accuracy, precision, recall, f1)
```

The model has learned the majority class and nothing else. On a skewed DA question, recall and F1 expose what accuracy hides.

## Glossary

- **Bias** — error from overly simple assumptions.
- **Variance** — error from sensitivity to the training sample.
- **Regularisation** — penalty on complexity, such as L1 or L2.
- **Stratified split** — preserves class proportions in each fold.
- **R²** — proportion of target variance explained by the model.

## Wrapping up

When you meet an ML question, ask three things in order: what is being predicted, what metric is being optimised, and what information was available at prediction time. Most wrong answers fail at one of those three gates.

## Sources

- [GATE 2026 DA syllabus (official PDF)](https://gate2026.iitg.ac.in/doc/GATE2026_Syllabus/DA_2026_Syllabus.pdf)
- [Machine Learning fundamentals](../tutorials/ml-fundamentals.md)
- [Andrew Ng, Machine Learning — Stanford Online](https://www.coursera.org/learn/machine-learning)
