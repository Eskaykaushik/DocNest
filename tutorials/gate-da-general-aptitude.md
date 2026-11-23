# GATE DA: General Aptitude Notes

General Aptitude is the fixed 15-mark paper common to every GATE exam. It is not part of the DA subject score, but it is the largest single block after Programming and Probability. This subject note covers verbal ability, numerical ability, and reasoning — the three areas that reward short, daily practice.

```callout
**In one sentence:** GA questions are rarely hard; they are short, tricky, and expensive to guess on because MCQs carry negative marking.
```

## Paper shape

| Area | Typical weight | Question types |
| --- | --- | --- |
| Verbal Ability | 4–5 marks | Grammar, vocabulary, sentence completion, reading comprehension |
| Numerical Ability | 5–6 marks | Arithmetic, percentages, ratio, time-speed-distance, work, data interpretation |
| Reasoning | 4–5 marks | Series, analogy, coding-decoding, syllogism, critical reasoning |

The exact split varies by year. Treat all three areas as required, not optional.

## Verbal ability

| Pattern | What to check |
| --- | --- |
| Error spotting | Subject-verb agreement, tense, article, preposition |
| Sentence completion | Tone and collocation, not just dictionary meaning |
| Synonym / antonym | Connotation and context |
| Reading comprehension | Main idea, inference, and the exact line that supports it |

Read the whole sentence before choosing. A word can be "correct English" and still be wrong for the tone of the passage.

## Numerical ability

| Topic | Core idea |
| --- | --- |
| Percentages | `new = old × (1 ± r/100)` |
| Profit and loss | Calculate percentage on cost price unless stated otherwise |
| Ratio | Keep units identical before comparing |
| Time and work | Add rates, not times: `1/t₁ + 1/t₂` |
| Speed and distance | Average speed is total distance ÷ total time |
| Data interpretation | Read the axis, the unit, and the base year |

Successive percentage changes multiply; they do not cancel. A 20% rise followed by a 20% fall leaves a 4% loss.

```callout
**NAT habit:** write the unit next to every intermediate value. Most GA numerical mistakes are unit mistakes, not arithmetic mistakes.
```

## Reasoning

| Pattern | First move |
| --- | --- |
| Number series | Check differences, then ratios, then alternating rules |
| Analogy | State the relationship in one sentence before choosing |
| Coding-decoding | Write the letter-to-number mapping explicitly |
| Syllogism | Draw sets; do not rely on how plausible the statement sounds |
| Critical reasoning | Find the conclusion, then the assumption that connects it to the evidence |

For syllogisms, "all A are B" does not mean "all B are A". A valid conclusion must hold for every possible diagram, not just one convenient drawing.

## Common pitfalls

- Assuming a 10% increase and a 10% decrease return to the original value.
- Averaging ratios directly instead of recomputing from totals.
- Choosing the "reasonable" option in a syllogism rather than the logically forced one.
- Losing marks on MCQs by guessing when several options feel plausible.
- Spending ten minutes on a two-mark question while later easy questions stay blank.

## Worked example

A shop raises a price by 20% during a festival, then discounts the new price by 20% afterwards. What is the net percentage change from the original price?

**Input:** original price `100`, rise `+20%`, fall `−20%`.
**Output:** final price `96`, net change `−4%`.

```python
price = 100
price *= 1.20
price *= 0.80
print(price, (price - 100) / 100 * 100)
```

The multipliers are `1.20 × 0.80 = 0.96`. The two percentages are applied to different bases, so they do not cancel. This same base-rate habit shows up in [Probability & Statistics](../tutorials/gate-da-probability-statistics.md), where a test's accuracy depends on the population it is applied to.

## Glossary

- **Premise** — a statement used as evidence in reasoning.
- **Conclusion** — the claim the argument is trying to establish.
- **Assumption** — an unstated link between premise and conclusion.
- **Percentage point** — the arithmetic difference between two percentages.
- **Data interpretation** — answering questions from tables, charts, or graphs.

## Wrapping up

Give GA fifteen focused minutes a day: five verbal, five numerical, five reasoning. Keep an error log by question type. Because GA is common to all GATE papers, this is the one subject note worth revisiting even if you change papers.

## Sources

- [GATE 2026 official portal](https://gate2026.iitg.ac.in/)
- [GATE 2026 DA syllabus (official PDF)](https://gate2026.iitg.ac.in/doc/GATE2026_Syllabus/DA_2026_Syllabus.pdf)
- [R.S. Aggarwal, *A Modern Approach to Verbal & Non-Verbal Reasoning*](https://www.schandpublishing.com/)
