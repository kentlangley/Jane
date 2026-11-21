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


## History › Your Place (2026-11-21)

Local and national history, so learners study the whole world and their part of it. The first
implementation is the United States. Topic text is general. Do not put "your family," family
names, or a household's private origin story in these files or in any committed pack or template.
Family-specific framing belongs only in a learner's private packs (`packs/` is gitignored).

Hard prerequisites stay inside Jane or on existing Marble topics. Marble topics never depend on
a `jane_` topic. `data/marble/` is unchanged.

| Id | Topic | Ages | Prerequisites (hard / soft) |
|---|---|---|---|
| `jane_place_nations_before_contact` | Nations already here | 9–11 | (none) |
| `jane_place_california_nations` | People of this place: California nations | 9–11 | hard: Nations already here |
| `jane_place_contact_and_claims` | Contact, claims, and disease | 9–11 | hard: Nations already here; soft: California nations |
| `jane_place_alliance_and_war` | Trade, alliance, and war | 10–11 | hard: Contact, claims, and disease |
| `jane_place_thirteen_colonies` | Thirteen colonies on Native land | 10–11 | hard: Contact, claims, and disease; soft: Trade, alliance, and war |
| `jane_place_slavery_in_colonies` | Enslavement in colonial America | 10–11 | hard: Thirteen colonies on Native land |
| `jane_place_break_with_britain` | Why the break with Britain | 10–11 | hard: Thirteen colonies; soft: Enslavement in colonial America |
| `jane_place_revolutionary_war` | The war for independence, many sides | 10–12 | hard: Why the break with Britain |
| `jane_place_constitution` | Promises and compromises | 10–12 | hard: The war for independence |
| `jane_place_early_republic` | A nation still being made | 10–12 | hard: Promises and compromises |
| `jane_place_kentucky_nations` | Land and nations of Kentucky | 9–11 | soft: Nations already here |
| `jane_place_kentucky_frontier` | Kentucky frontier and statehood | 9–11 | hard: Land and nations of Kentucky |
| `jane_place_kentucky_border_state` | Kentucky as a Civil War border state | 10–12 | hard: Kentucky frontier and statehood; soft: Enslavement in colonial America |
| `jane_place_kentucky_appalachia` | Appalachia and moving on | 10–12 | hard: Kentucky frontier and statehood |
| `jane_place_california_migration` | Moving to California | 9–12 | hard: California nations; soft: Appalachia and moving on, Independent Peru and its people, A nation still being made |

## History › Andes & Peru (2026-11-21)

A world-history path for the Americas (usable in the world rotation). It can also support a
Your Place thread when a learner has ties to Peru, but the topics themselves stay general.

| Id | Topic | Ages | Prerequisites (hard / soft) |
|---|---|---|---|
| `jane_world_andes_geography` | Andes geography | 9–11 | (none) |
| `jane_world_andes_early_cultures` | Early Andes cultures | 9–11 | hard: Andes geography |
| `jane_world_inca` | The Inca | 9–12 | hard: Early Andes cultures |
| `jane_world_peru_spanish_conquest` | Spanish conquest in the Andes | 10–12 | hard: The Inca |
| `jane_world_peru_republic` | Independent Peru and its people | 10–12 | hard: Spanish conquest in the Andes |

## Standards

`standards` codes on the Money Math and Money Models topics (2026-11-01) and on the Your Place
and Andes & Peru topics (2026-11-21). Each one was checked against the official text; a topic
only gets a code whose text actually covers what the topic teaches. A topic with no fitting
code has an empty list.

| Source prefix | Standard set | Code form | Official text |
|---|---|---|---|
| `ccss-math` | Common Core State Standards for Mathematics (same prefix as Marble) | Grades K–8 in Marble's short form without the cluster letter (`6.RP.3c` = CCSS.Math.Content.6.RP.A.3.c); high school with the cluster letter (`HSF-LE.A.1c` = CCSS.Math.Content.HSF.LE.A.1.c) | https://www.thecorestandards.org/Math/ |
| `jumpstart-2021` | Jump$tart National Standards for Personal Financial Education (2021) | `<Area>-<grade>-<standard><outcome>`, area without spaces: `Saving-8-4c` = Saving, grade 8, standard 8-4, learning outcome 8-4c; `EarningIncome-4-4c` = Earning Income 4-4c | https://www.jumpstart.org/wp-content/uploads/2023/04/2021_Natl_Standards_Downloadable_final.pdf |
| `cde-hss` | California History-Social Science Content Standards (1998), same official identifiers as HSS-5.1 | `grade.standard` or `grade.standard.sub` (`5.4.6` = HSS-5.4.6; `7.7.1` = HSS-7.7.1) | https://www.cde.ca.gov/BE/st/ss/documents/histsocscistnd.pdf |

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

| Topic | Codes |
|---|---|
| `jane_place_nations_before_contact` | `cde-hss:5.1`, `5.1.1` (pre-Columbian settlements; geography and climate) |
| `jane_place_california_nations` | `cde-hss:4.2.1` (major nations of California Indians) |
| `jane_place_contact_and_claims` | `cde-hss:5.2`, `5.2.2`, `5.2.4` (explorations; aims of expeditions; land claimed by European powers) |
| `jane_place_alliance_and_war` | `cde-hss:5.3`, `5.3.2`, `5.3.3` (cooperation and conflict; alliances; wars before the Revolution) |
| `jane_place_thirteen_colonies` | `cde-hss:5.4`, `5.4.1`, `5.4.2` (colonial institutions; location and Native nations; reasons for founding) |
| `jane_place_slavery_in_colonies` | `cde-hss:5.4.6` (introduction of slavery; responses of enslaved families) |
| `jane_place_break_with_britain` | `cde-hss:5.5` (causes of the American Revolution) |
| `jane_place_revolutionary_war` | `cde-hss:5.6` (course and consequences of the American Revolution) |
| `jane_place_constitution` | `cde-hss:5.7` (development and significance of the Constitution) |
| `jane_place_early_republic` | `cde-hss:5.8`, `5.3.4` (settlement 1789 to the mid-1800s; broken treaties and the Trail of Tears) |
| `jane_place_kentucky_nations` | `cde-hss:5.1` (pre-Columbian settlements, including woodland peoples east of the Mississippi) |
| `jane_place_kentucky_frontier` | `cde-hss:5.8` (settlement patterns from 1789 to the mid-1800s; Kentucky statehood is 1792) |
| `jane_place_kentucky_border_state` | `cde-hss:8.10`, `8.10.2` (causes, events, and consequences of the Civil War; North and South boundaries) |
| `jane_place_kentucky_appalachia` | (none: no official California standard whose text covers Appalachian life and out-migration) |
| `jane_place_california_migration` | `cde-hss:4.4.3`, `4.4.4` (immigration and migration to California; internal migration and the growth of towns) |
| `jane_world_andes_geography` | `cde-hss:7.7.1` (landforms and climates of South America and Andean urban societies) |
| `jane_world_andes_early_cultures` | `cde-hss:7.7.1`, `7.7.4` (Andean urban societies; artistic traditions and architecture) |
| `jane_world_inca` | `cde-hss:7.7`, `7.7.1`, `7.7.2`, `7.7.3` (Andean civilizations; geography and urban society; social structure; rise of the empire) |
| `jane_world_peru_spanish_conquest` | `cde-hss:7.7.3` (how the Incan empire was defeated by the Spanish) |
| `jane_world_peru_republic` | (none: HSS-10.4.4 covers later imperial-era independence struggles, not Peru in the 1820s) |
