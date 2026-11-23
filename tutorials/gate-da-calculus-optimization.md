# GATE DA: Calculus & Optimization Notes

Calculus and Optimization carry about 8 marks in the GATE DA paper, but the same ideas appear inside regression, gradient descent, and probability. This subject note covers derivatives, partial derivatives, extrema, convexity, gradients, and constrained optimization. Matrix identities live in the [Linear Algebra](../tutorials/gate-da-linear-algebra.md) note.

```callout
**In one sentence:** a stationary point is only a candidate; the Hessian, the domain, and any constraint decide whether it is the answer.
```

## Differential calculus essentials

| Object | Meaning | GATE use |
| --- | --- | --- |
| Derivative `f'(x)` | Instantaneous rate of change | Slope, marginal change |
| Partial derivative `∂f/∂x` | Change with other variables fixed | Multivariable models |
| Gradient `∇f` | Vector of partial derivatives | Direction of steepest increase |
| Hessian `H` | Matrix of second partial derivatives | Local curvature |
| Stationary point | `∇f = 0` | Candidate minimum or maximum |
| Inflection point | Second derivative changes sign | Change in concavity |

Basic rules worth keeping on speed dial:

- `d(xⁿ)/dx = n xⁿ⁻¹`
- `d(eˣ)/dx = eˣ`
- `d(ln x)/dx = 1/x`
- product rule: `(fg)' = f'g + fg'`
- chain rule: `d f(g(x)) = f'(g(x)) g'(x)`

## Classifying extrema

For one variable, use the second derivative test:

- `f'(x) = 0` and `f''(x) > 0` → local minimum;
- `f'(x) = 0` and `f''(x) < 0` → local maximum;
- `f''(x) = 0` → test fails; inspect higher derivatives or nearby points.

For multiple variables, inspect the Hessian at the stationary point:

- positive definite → local minimum;
- negative definite → local maximum;
- indefinite → saddle point.

Always check endpoints and boundary constraints separately. The global optimum can sit on the boundary even when no interior stationary point exists.

## Convexity

A function is convex if a line segment between any two points on its graph lies above the graph. For differentiable functions, convexity means `f(y) ≥ f(x) + ∇f(x)ᵀ(y − x)`.

| Shape | Guarantee |
| --- | --- |
| Convex | Any local minimum is global |
| Strictly convex | The global minimum is unique |
| Concave | Any local maximum is global |
| Non-convex | Multiple local optima are possible |

Squared error is convex; log loss is convex; a neural network loss surface generally is not.

## Gradient descent

Gradient descent updates parameters against the gradient:

`w ← w − η∇f(w)`

The learning rate `η` controls step size. Too small and training crawls; too large and it overshoots or diverges. The minus sign is the whole point: you move downhill.

## Constrained optimization

For an equality constraint `g(x) = c`, build the Lagrangian:

`L(x, λ) = f(x) − λ(g(x) − c)`

Then solve `∇f = λ∇g` together with `g = c`. The multiplier `λ` measures how much the optimum would improve if the constraint were relaxed slightly.

Inequality constraints need KKT conditions: stationarity, primal feasibility, dual feasibility, complementary slackness, and stationarity of the Lagrangian. GATE usually tests the equality case or a simple boundary check.

```callout
**MSQ trap:** "the gradient is zero" is a necessary condition for an interior optimum, not a sufficient one. A saddle point also has zero gradient.
```

## Common pitfalls

- Moving **with** the gradient in gradient descent.
- Forgetting to check endpoints or boundaries.
- Treating `f'' = 0` as a maximum or minimum.
- Dropping the constraint equation when using Lagrange multipliers.
- Assuming convexity for every smooth-looking function.

## Worked example

Minimize `f(x, y) = x² + 2y²` subject to `x + y = 3`.

**Input:** objective `x² + 2y²`, constraint `x + y = 3`.
**Output:** `x = 2`, `y = 1`, minimum value `6`.

Set `L = x² + 2y² − λ(x + y − 3)`. The conditions are `2x = λ`, `4y = λ`, and `x + y = 3`. So `x = λ/2` and `y = λ/4`; the constraint gives `3λ/4 = 3`, hence `λ = 4`.

```python
from fractions import Fraction

lam = Fraction(4, 1)
x = lam / 2
y = lam / 4
print(x, y, x * x + 2 * y * y)
```

The decision trace matters more than the code: translate the constraint into a Lagrangian, solve the stationarity equations, then substitute back into the original objective.

## Glossary

- **Gradient** — vector of first partial derivatives.
- **Hessian** — matrix of second partial derivatives.
- **Convex** — bowl-shaped, with one global minimum.
- **Lagrange multiplier** — weight attached to an equality constraint.
- **KKT conditions** — first-order conditions for constrained problems with inequalities.

## Wrapping up

Practise derivatives until the chain rule is automatic, then move to classification and constraints. Pair this note with the [Linear Algebra](../tutorials/gate-da-linear-algebra.md) note when a question involves eigenvalues, positive definiteness, or quadratic forms.

## Sources

- [GATE 2026 DA syllabus (official PDF)](https://gate2026.iitg.ac.in/doc/GATE2026_Syllabus/DA_2026_Syllabus.pdf)
- [Convex Optimization — Boyd and Vandenberghe](https://web.stanford.edu/~boyd/cvxbook/)
- [Khan Academy — Multivariable calculus](https://www.khanacademy.org/math/multivariable-calculus)
