# GATE DA: DBMS & Data Warehousing Notes

Database Management and Warehousing carries about 8 marks in the GATE DA paper. For a data scientist, this is the subject that decides whether you can trust the table you just queried. Expect ER modelling, relational algebra, SQL, normalization, transactions, and warehouse vocabulary.

```callout
**In one sentence:** a correct SQL answer needs the right rows, the right duplicates, and the right join — not just the right columns.
```

## ER and relational models

| Concept | Meaning | GATE cue |
| --- | --- | --- |
| Entity | A distinguishable object | Student, Order |
| Attribute | A property of an entity | `rollno`, `amount` |
| Relationship | An association between entities | Enrolls, Places |
| Cardinality | How many of each side participate | 1:1, 1:N, M:N |
| Key | Uniquely identifies a tuple | Primary, candidate, foreign |
| Weak entity | Cannot be identified without another entity | Depends on a strong entity |

An M:N relationship needs a junction table in the relational model. A foreign key references a candidate key in another table and may be null unless it is part of the primary key.

## Relational algebra

| Operation | Symbol | Purpose |
| --- | --- | --- |
| Select | `σ` | Choose rows by a predicate |
| Project | `π` | Choose columns |
| Join | `⋈` | Combine related rows |
| Rename | `ρ` | Give a relation or attribute a new name |
| Union / Intersection / Difference | `∪`, `∩`, `−` | Set operations; operands must be union-compatible |
| Set difference | `−` | Rows in A but not B |

Relational algebra works on sets, so duplicates disappear unless the question says bag semantics. SQL, by default, keeps duplicates — use `DISTINCT` when the algebra implies a set.

## SQL essentials

```sql
SELECT department, AVG(salary) AS avg_salary
FROM Employee
WHERE salary > 50000
GROUP BY department
HAVING COUNT(*) > 2
ORDER BY avg_salary DESC;
```

Order of evaluation: `FROM` → `WHERE` → `GROUP BY` → `HAVING` → `SELECT` → `ORDER BY`. This explains why a `WHERE` clause cannot use an aggregate, while `HAVING` can.

## Functional dependencies and normalization

A functional dependency `X → Y` means that equal `X` values always have equal `Y` values.

| Form | Condition |
| --- | --- |
| 1NF | Atomic values, no repeating groups |
| 2NF | 1NF and no partial dependency on part of a composite key |
| 3NF | 2NF and no transitive dependency on a non-key attribute |
| BCNF | Every determinant is a candidate key |

Lossless decomposition and dependency preservation are the two checks a decomposition question cares about. A decomposition can be in 3NF yet lose a dependency if you split carelessly.

## Transactions and warehousing

ACID: **Atomicity**, **Consistency**, **Isolation**, **Durability**. Isolation levels trade concurrency against anomalies such as dirty reads, non-repeatable reads, and phantoms.

| Warehouse idea | Meaning |
| --- | --- |
| OLTP | Day-to-day transactions, normalised, write-heavy |
| OLAP | Analytical queries, denormalised, read-heavy |
| Star schema | Fact table surrounded by dimension tables |
| Snowflake schema | Dimension tables further normalised |
| ETL | Extract, transform, load |
| Data mart | A subject-specific slice of a warehouse |

```callout
**Exam cue:** if the question mentions "historical", "analytical", or "multidimensional", it is pointing at warehousing, not OLTP design.
```

## Common pitfalls

- Forgetting that SQL `NULL` is not equal to `NULL`; use `IS NULL`.
- Using `WHERE` with an aggregate instead of `HAVING`.
- Assuming `NATURAL JOIN` is always safe — it joins on every same-named column.
- Confusing 3NF with BCNF when a determinant is not a candidate key.
- Treating duplicate salaries as distinct values in a "second highest" query.

## Worked example

Find the name of the employee with the second-highest **distinct** salary.

**Input:** `Employee(id, name, salary)` with `(1, Ada, 90000)`, `(2, Bob, 75000)`, `(3, Cy, 90000)`, `(4, Di, 60000)`.
**Output:** `Bob`.

```sql
SELECT name
FROM Employee
WHERE salary = (
  SELECT MAX(salary)
  FROM Employee
  WHERE salary < (SELECT MAX(salary) FROM Employee)
);
```

The inner `MAX` finds 90000. The middle query finds 75000, the highest salary below it. The outer query returns Bob. If you had sorted with `LIMIT 1 OFFSET 1`, Cy's duplicate 90000 would have hidden the real second distinct salary.

## Glossary

- **Tuple** — a row in a relation.
- **Candidate key** — a minimal attribute set that uniquely identifies a tuple.
- **Foreign key** — an attribute set that references another relation's key.
- **Functional dependency** — `X → Y`, equal `X` implies equal `Y`.
- **Fact table** — the central numeric measurement table in a star schema.

## Wrapping up

Practise SQL before normalization; query shape is worth more marks than abstract design theory. Then drill the three NF definitions and one transaction anomaly question. Pair this with the [Programming, DSA & Complexity](../tutorials/gate-da-programming-dsa.md) note, since hashing and joins share the same underlying idea.

## Sources

- [GATE 2026 DA syllabus (official PDF)](https://gate2026.iitg.ac.in/doc/GATE2026_Syllabus/DA_2026_Syllabus.pdf)
- [Database System Concepts — Silberschatz, Korth, Sudarshan](https://db-book.com/)
- [PostgreSQL documentation — SQL SELECT](https://www.postgresql.org/docs/current/sql-select.html)
