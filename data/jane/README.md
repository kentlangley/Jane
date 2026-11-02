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
- **`standards`**: real curriculum codes in Marble's `source:code` form, or empty. Never invent a code: every code
  must be checked against the official text (see [Standards](#standards) below). Stored as data only; the app does not
  show them yet (Marble's own standards are not bundled into `tax.json` either).
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
| `jane_mm_rule_of_72` | The Rule of 72: doubling time ≈ 72 ÷ rate % | 10–14 | hard: Calculating Percentages (early unlock, see below) |
| `jane_mm_real_return` | Real return and inflation: (1+r)/(1+i) − 1 ≈ r − i | 12–14 | hard: Compound growth; soft: How the Economy Works |
| `jane_mm_present_value` | Present value: PV = FV ÷ (1+r)^n | 13–15 | hard: Compound growth |
| `jane_mm_true_average_return` | True average return (geometric mean) | 13–15 | hard: Compound growth, Calculating the Mean, Square and cube numbers (roots) |

**Early unlock for the Rule of 72 (2026-11-01, approved by Kent):** the Rule of 72 stands on its own as a simple
doubling intro and needs only **Calculating Percentages** (`mt_PNSyfH56eQ`, ages 10–12), so a 5th grader who has
percentages gets an early taste of Money Math. It has no edge to Compound growth in either direction (a soft edge would
still let inference credit Compound growth when the Rule of 72 is mastered), and Compound growth stays the later topic
with its own prerequisites. The other four Money Math topics are unchanged.

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

## Standards

`standards` codes on the Money Math and Money Models topics (2026-11-01). Each one was checked against the official
text; a topic only gets a code whose text actually covers what the topic teaches.

| Source prefix | Standard set | Code form | Official text |
|---|---|---|---|
| `ccss-math` | Common Core State Standards for Mathematics (same prefix as Marble) | Grades K–8 in Marble's short form without the cluster letter (`6.RP.3c` = CCSS.Math.Content.6.RP.A.3.c); high school with the cluster letter (`HSF-LE.A.1c` = CCSS.Math.Content.HSF.LE.A.1.c) | https://www.thecorestandards.org/Math/ |
| `jumpstart-2021` | Jump$tart National Standards for Personal Financial Education (2021) | `<Area>-<grade>-<standard><outcome>`, area without spaces: `Saving-8-4c` = Saving, grade 8, standard 8-4, learning outcome 8-4c; `EarningIncome-4-4c` = Earning Income 4-4c | https://www.jumpstart.org/wp-content/uploads/2023/04/2021_Natl_Standards_Downloadable_final.pdf |

| Topic | Codes |
|---|---|
| `jane_mm_compound_growth` | `ccss-math:7.RP.3`, `7.EE.2`, `HSA-SSE.A.1b`, `HSF-LE.A.1c`, `HSF-LE.A.2`; `jumpstart-2021:Saving-8-5a`, `Saving-8-5b`, `Investing-8-7a`, `Investing-8-7b` |
| `jane_mm_rule_of_72` | `jumpstart-2021:Saving-8-4c` ("Use the Rule of 72 to approximate how many years it will take for savings to double"); no CCSS standard covers it |
| `jane_mm_real_return` | `ccss-math:7.RP.3`, `7.EE.2`; `jumpstart-2021:Saving-12-4b`, `Investing-12-4a`, `Investing-12-4b` |
| `jane_mm_present_value` | `ccss-math:HSA-SSE.A.1b` (interpret P(1+r)^n); Jump$tart has no present-value outcome |
| `jane_mm_true_average_return` | `ccss-math:7.EE.2` (growth factors), `HSF-LE.A.1a` (equal factors over equal intervals); no standard covers the geometric mean itself |
| `jane_mmod_profit_per_customer` | `ccss-math:4.OA.3`; `jumpstart-2021:EarningIncome-4-4c` |
| `jane_mmod_payback_period` | `ccss-math:4.OA.3`, `6.RP.3b` |
| `jane_mmod_offer_ladder` | `ccss-math:6.RP.3c` |
| `jane_mmod_price_testing` | `ccss-math:7.EE.3`; `jumpstart-2021:EarningIncome-4-4c` |
| `jane_mmod_billing_math` | `ccss-math:6.RP.3b`, `6.RP.3d`, `7.RP.3` |
