# Jane's own topics

Topics this project adds on top of the [Marble Skill Taxonomy](../marble/README.md). `data/marble/` stays byte-identical
to upstream (see `UPSTREAM`), so Jane's additions live here and a Marble data refresh never touches them.

| File | Shape |
|---|---|
| `topics.json` | Same as `data/marble/topics.json`: `{version, topicCount, topics: [...]}`, each topic with `id`, `type`, `subject`, `domain`, `name`, `description`, `ageRangeStart`, `ageRangeEnd`, `centrality`, `evidence[]`, `assessmentPrompt`, `standards[]` |
| `dependencies.json` | Same as `data/marble/dependencies.json`: `{version, edgeCount, dependencies: [{topicId, prerequisiteId, strength, reason}]}` |

Rules (`lib-jane-topics.mjs` checks them; `npm run build` fails otherwise):

- **Ids start with `jane_`** (Marble's start with `mt_`), so they never collide, and they never change once shipped:
  progress, medals and quest packs are keyed by id.
- **`subject` is an existing Marble subject**: each subject is an island on the map. **`domain` is the path** (trail)
  on that island; a new domain makes a new path.
- **Edges**: `topicId` is always a `jane_` topic; `prerequisiteId` may be a `jane_` or a Marble `mt_` topic. Marble topics
  never get a `jane_` prerequisite, so adding a Jane topic never locks, re-tiers or re-scores a Marble topic. `hard`
  prerequisites must be mastered before a topic is *ready*; `soft` ones only inform the graph.
- **`standards`**: real curriculum codes in Marble's `source:code` form, or empty. Never invent a code.
- `centrality` is hand-set (Marble computes its own; the app does not use it).
- Each topic needs a kid prompt (`data/kid-prompts/b*.txt`, `jane_id|question|right|wrong1|wrong2`), like Marble topics.
- Marble's teaching research covers Marble's Science and Math topics only, so `npm run research -- <jane_id>` prints
  "no research".

`build.mjs` appends these topics after all Marble topics in `public/tax.json` (map positions of existing topics stay
put) and computes medal tier cut-offs from the Marble topics only.

## Life Skills › Money Math (2026-11-01)

From Kent, after the X article "The Five Equations That Quietly Run Your Entire Financial Life" (@lumenxbt).

| Id | Topic | Ages | Prerequisites (hard / soft) |
|---|---|---|---|
| `jane_mm_compound_growth` | Compound growth: FV = PV × (1+r)^n | 11–14 | hard: Percentages (age 12+), Square and cube numbers (powers & roots); soft: Banks & Saving, Financial Planning |
| `jane_mm_rule_of_72` | The Rule of 72: doubling time ≈ 72 ÷ rate % | 11–14 | hard: Compound growth |
| `jane_mm_real_return` | Real return and inflation: (1+r)/(1+i) − 1 ≈ r − i | 12–14 | hard: Compound growth; soft: How the Economy Works |
| `jane_mm_present_value` | Present value: PV = FV ÷ (1+r)^n | 13–15 | hard: Compound growth |
| `jane_mm_true_average_return` | True average return (geometric mean) | 13–15 | hard: Compound growth, Calculating the Mean, Square and cube numbers (roots) |

## Life Skills › Money Models (2026-11-01)

Business math for a kid-sized business (a lemonade stand, a snack cart). Source: **FounderOS — designing-money-models**
(the FounderOS skill's SKILL.md, references/money-model-builder.md and templates/money-model-worksheet.md, which
themselves cite Alex Hormozi's *$100M Money Models* and *$100M Playbook: Pricing*). Ideas only, reworded for kids;
no text is copied. Topic ideas approved by Kent.

| Id | Topic | Ages | Prerequisites (hard / soft) |
|---|---|---|---|
| `jane_mmod_profit_per_customer` | Profit per customer: revenue − cost to get − cost to serve | 9–12 | hard: Costs & Revenue, Money word problems; soft: Marketing Basics |
| `jane_mmod_payback_period` | Payback period and the 30-day payback rule | 9–12 | hard: Profit per customer, Multiplication and Division Word Problems |
| `jane_mmod_offer_ladder` | The offer ladder: attract, upsell, downsell, continuity; take rates | 10–13 | hard: Profit per customer, Calculating Percentages |
| `jane_mmod_price_testing` | Price testing: raise in steps until total profit drops, step back one | 11–14 | hard: Profit per customer, The offer ladder |
| `jane_mmod_billing_math` | Billing math: smallest-unit price, longer cycles, 28-day billing = 13 payments | 11–14 | hard: Profit per customer, Multiplication and Division Word Problems, Calculating Percentages; soft: Time Units and Calendar Facts |

Price testing is the path's boss topic (the deepest end of the path), like boss topics on Marble paths.
