# GATE DA: Linear Algebra Notes

Linear Algebra contributes about 10 marks directly and shows up again inside machine learning, PCA, and regression. This subject note covers the exam-facing core: matrices, systems of equations, vector spaces, and eigenpairs. Optimization moves to its own [Calculus & Optimization](../tutorials/gate-da-calculus-optimization.md) note.

```callout
**In one sentence:** a matrix is a linear map, an eigenvector is a direction the map does not turn, and rank tells you how much of that map is actually independent.
```

## Matrices you can trust

For a matrix `A` of shape `m × n`:

| Idea | Test or meaning | GATE use |
| --- | --- | --- |
| Rank | Number of independent rows/columns | Solvability of `Ax = b` |
| Determinant | Scaling factor; zero means singular | Invertibility test for square matrices |
| Inverse `A⁻¹` | Exists only when `det(A) ≠ 0` | Solving `x = A⁻¹b` |
| Trace | Sum of diagonal entries | Equals sum of eigenvalues |
| Transpose `Aᵀ` | Rows become columns | Needed for `xᵀx` and covariance forms |
| Positive definite | `xᵀAx > 0` for all non-zero `x` | Convex quadratic, valid covariance |

A system `Ax = b` has:

- a unique solution when `rank(A) = rank([A|b]) = n`;
- infinitely many when the ranks match but are less than `n`;
- no solution when `rank(A) < rank([A|b])`.

Do not skip the augmented rank check. `rank(A) = n` alone does not make an inconsistent system consistent.

## Vector spaces and basis

A vector space is a set closed under addition and scalar multiplication. A **basis** is a linearly independent set that spans the space, and its size is the **dimension**.

| Idea | Quick test |
| --- | --- |
| Linear independence | No non-trivial combination of vectors gives zero |
| Span | Every vector in the space is a combination of the set |
| Basis | Independent and spanning |
| Dimension | Number of vectors in any basis |
| Null space | Solutions of `Ax = 0` |
| Column space | All possible outputs `Ax` |

The rank-nullity theorem connects them: `rank(A) + nullity(A) = n` for an `m × n` matrix.

## Eigenvectors in one pass

Solve `det(A − λI) = 0` for `λ`, then solve `(A − λI)v = 0` for each `v`. Useful identities for NAT questions:

- sum of eigenvalues = trace of `A`;
- product of eigenvalues = determinant of `A`;
- eigenvectors of a symmetric matrix with distinct eigenvalues are orthogonal;
- a matrix is singular exactly when `0` is an eigenvalue.

```callout
**ML shape check:** if `X` is `n × d` and `w` is `d × 1`, predictions are `Xw` with shape `n × 1`. If those shapes do not line up, the model is wrong before the maths starts.
```

## Common pitfalls

- Assuming a non-zero determinant is enough for any matrix — determinants only exist for square matrices.
- Confusing `v` and `λ` in `Av = λv`.
- Using `rank(A) = n` alone to declare `Ax = b` consistent.
- Forgetting that `xᵀx` is a scalar, while `xxᵀ` is a matrix.
- Treating the null space as the set of inputs that make `Ax = b` false; it is specifically the set that makes `Ax = 0`.

## Worked example

A team wants the single direction that preserves the most variance in a two-feature dataset. The covariance matrix is symmetric, so its eigenvectors give the principal directions.

**Input:** covariance matrix `[[2, 1], [1, 2]]`.
**Output:** eigenvalues `3` and `1`; principal direction `(0.707, 0.707)`.

```python
import numpy as np

cov = np.array([[2.0, 1.0], [1.0, 2.0]])
values, vectors = np.linalg.eigh(cov)
print(values)
print(vectors[:, -1])
```

The largest eigenvalue is 3, and its eigenvector points equally along both features. Projecting onto that direction keeps more variance than choosing either original feature alone — the whole idea behind PCA.

## Glossary

- **Rank** — dimension of the column space.
- **Singular matrix** — square matrix with determinant zero and no inverse.
- **Eigenpair** — eigenvalue `λ` with its non-zero eigenvector `v`.
- **Positive definite** — all eigenvalues positive for a symmetric matrix.
- **Nullity** — dimension of the null space.

## Wrapping up

Practise rank and eigenvalue questions until the identities are automatic, then move to gradients in the [Calculus & Optimization](../tutorials/gate-da-calculus-optimization.md) note. In DA, linear algebra is rarely tested as abstract theory; it is tested as a tool for deciding whether a solution exists and which direction carries the most information.

## Sources

- [GATE 2026 DA syllabus (official PDF)](https://gate2026.iitg.ac.in/doc/GATE2026_Syllabus/DA_2026_Syllabus.pdf)
- [Linear Algebra for Data Science](https://www.scaler.com/topics/linear-algebra-for-data-science/)
- [Gilbert Strang — Linear Algebra and Learning from Data](https://math.mit.edu/~gs/learningfromdata/)
