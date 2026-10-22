# Marble teaching research: a review from the Jane project

*For the Marble team, with thanks.* Jane is a small open-source adaptive learning app for grade-schoolers, built on the
[Marble Skill Taxonomy](https://github.com/withmarbleapp/os-taxonomy). The app has no AI inside: an agent writes each
day's quest offline, following [LESSONS.md](../LESSONS.md), and a validator checks it before a child sees it. The
taxonomy's topic IDs and prerequisite graph are the backbone of everything Jane does (mastery, inference, review,
medals), so we read the new release closely. This is what we found and how we plan to use it.

**Compared:** our vendored copy, release 1.0.0 (2026-07-08, 1,590 topics), against `main` at
[`a871973`](https://github.com/withmarbleapp/os-taxonomy/tree/a8719737ff86ef7940ba5feca11940de1204103e)
(merged 2026-10-22). The upstream validator passes on that commit (`1930 topics, 4102 dependencies, 3881 standards,
176 clusters, 1049 research records`). All numbers below come from diffing the two copies' JSON files.

## What we found

Thank you. The teaching research is the piece we were most hoping for. For every covered topic it gives a teacher's
view of the idea: approaches that work, the misconceptions children actually bring, a diagnostic with response levels,
and error patterns that say what reveals each mistake, what to do next, and often which prerequisite to re-teach. That
is exactly the material an offline lesson author needs.

New files on `main`:

- **`data/teaching-research.json`** (~24 MB, `schemaVersion: 1`, taxonomy `v1`), joined to topics by `topicId`.
  Each record has `pedagogy` (summary, best practices, representations, common misconceptions), `learn` (rewritten
  portable guidance: activities with learner actions, intended insight, feedback, rationale and source claims, plus
  constraints and review notes), `assess` (method, diagnostic prompt, task, correct answer, response levels, error
  patterns), `sources`, `confidence`, `provenance` and `publicationNotes`. A file-level `coverage` block lists every
  topic without research, which we really appreciate.
- **`data/archived-teaching-research.json`**: 2 records kept for a merged topic and a refocused one.
- `schema/teaching-research.schema.json`, research checks and tests, `reports/` (Australian curriculum coverage) and
  the `marble-builder` agent skill.

The topic record fields are unchanged, and the licences are the same as 1.0.0: database ODbL 1.0, Marble-authored
text (now including the teaching-research prose) CC BY-SA 4.0. `LICENSE`, `LICENSE-CONTENT` and `CITATION.cff` are
byte-identical to 1.0.0.

## Coverage

| | Topics | With research |
|---|---:|---:|
| Science | 595 | 547 |
| Mathematics | 587 | 502 |
| All other subjects (English, History, Geography, Computing, PSD, Life Skills, Learning to Learn) | 748 | 0 |
| **Total** | **1,930** | **1,049** |

Across the 1,049 records: 5,081 listed misconceptions, 4,295 activities and 3,345 error patterns (1,001 with a
ready-made distractor, 1,349 naming a prerequisite to re-teach). Assessment methods: `two_tier` 566,
`performance_task` 317, `open_epistemic_probe` 77, `interpret_translate` 48, `use_in_context` 41.

**A small discrepancy:** the CHANGELOG's Unreleased section says *"Add 1,051 teaching-research records for Science
(547) and Mathematics (504)"*, while the data, the manifest and the README say 1,049 (547 + 502). We assume 1,051 was
the count before the two archived records were moved out; the data looks right to us.

## Topic changes compared with 1.0.0

- **1,590 → 1,930 topics:** 1,589 kept, **341 added**, **1 removed**. Added by subject: Mathematics 85, English 82,
  Science 48, Computing 38, Personal & Social Development 36, Geography 25 (new subject), History 22, Life Skills 5.
  Only one new topic has research (`mt_HlNSurPVDp`, line graphs).
- **Removed by merge:** `mt_3XJkeIn6J6` (titled "Estimating answers (age 7+)", really "read time to the nearest
  minute") was merged into `mt_UNzojLkNdm` "Time to the nearest minute". The archive file records this, which made
  it easy to map existing progress forward.
- **Wrong titles fixed, IDs kept:** 37 topics were renamed. 24 of them are title-only fixes whose description was
  already right, e.g. `mt_eiB3-6pu6a` "Estimating answers (age 9+)" → "Area and perimeter of rectangles",
  `mt_3tz3Otap5j` "Halves and quarters (age 7+)" → "Money word problems", `mt_GzcJEVkNRn` "Understanding angles
  (age 8+)" → "Area of rectangles by multiplication". Duplicate titles across topics dropped from 54 to 48. These are
  great fixes.
- **Scope changes on a kept ID:** `mt_bESTSBB0wK` narrowed from "pie charts and line graphs" to pie charts only (line
  graphs moved to the new `mt_HlNSurPVDp`), and `mt_NSC3LT_-ch` refocused from estimating volume to estimating
  capacity. 13 of the 37 renames also changed the description.
- **Other field changes on kept topics:** `standards` 786, `ageRangeEnd` 444, `ageRangeStart` 70, `evidence` 20,
  `description` 18, `assessmentPrompt` 14, `type` 3, `domain` 3 (three Computing topics moved out of Artificial
  Intelligence), plus centrality on nearly all.
- **`topics.json` is completely reordered.** Only 1 of the 1,589 kept topics is at the same array index as in 1.0.0.
  IDs are stable, so this is fine for anyone joining by ID, but it caught us: Jane's kid-friendly questions were
  joined to topics by position. We are fixing that on our side ([#37](https://github.com/kentlangley/Jane/issues/37)).

## Prerequisite links

3,221 → 4,102 edges: **899 added** (873 touch a new topic, 26 link two existing topics) and **18 removed** (3 of them
on the merged topic). 7 of the removed edges come back reversed, e.g. "Nets of 3-D Shapes" now depends on
"2-D shapes (age 7+)" instead of the other way round, and "Drawing Force Diagrams" now builds on "Pushes & Pulls".
On kept edges, 13 strengths and 14 reasons changed. All of these read as corrections to us.

## Places where guidance disagrees with itself

The README is upfront that the research was agent-authored, sources were not re-fetched, and the original
`pedagogy`/`assess` fields were kept and "may contain claims that the updated guidance qualifies". We found a clear
example. In **Phases of the Moon** (`mt_4V-vYhFUcm`):

- `assess.errorPatterns[0].nextMove` says: *"park at full Moon: the Earth's shadow points AWAY into space"*.
- `learn.constraints` says: *"At full Moon, do not teach that Earth's shadow 'points away' from the Moon: the full
  Moon sits near the anti-solar point where Earth's umbra points, and it is usually not eclipsed only…"* because of
  the tilted orbit.

The `learn` version is the correct one. Our rule for now: **when `learn` and `pedagogy`/`assess` disagree, follow
`learn` and its constraints.** A machine-readable flag would help (see questions below).

## Three examples we looked at

- **Decimals and fractions, `mt_SBkTGjiZjZ`.** Read a decimal by its last place value (0.375 = 375/1000 = 3/8); convert
  by dividing and by scaling to a power of ten; a fraction terminates only when its lowest-terms denominator has
  prime factors 2 and 5. Misconceptions: 0.375 = 375/100, computing 8 ÷ 3 for 3/8, treating 1/3 = 0.3 as exact.
- **Area of triangles and parallelograms, `mt_ML5t7n2-U8`.** Derive the formulas by dissection (two identical
  triangles make a parallelogram, so a triangle is half); insist on the perpendicular height; vary orientation.
  The diagnostic includes a decoy slant side, so "used every number given" and "forgot to halve" show up clearly.
- **Phases of the Moon, `mt_4V-vYhFUcm`.** Ball-and-lamp model with the head as Earth; orbit view and sky view side by
  side; phases before eclipses. The two-tier check comes with a ready distractor: "The dark part is the Earth's
  shadow cast onto the Moon."

## How Jane plans to use it

Tracking issue: [#44 Adopt Marble teaching research (os-taxonomy a871973)](https://github.com/kentlangley/Jane/issues/44).
The research stays offline: it is read by the nightly author and never shipped to the app or shown raw to a child.

1. [#37](https://github.com/kentlangley/Jane/issues/37) Key our kid prompts by topic ID instead of array position.
2. [#38](https://github.com/kentlangley/Jane/issues/38) Vendor `a871973`, pinned by SHA, with an alias map for the
   merged topic so existing progress and medals carry over.
3. [#39](https://github.com/kentlangley/Jane/issues/39) Kid prompts for the new topics; review medal tiers and
   coverage areas.
4. [#40](https://github.com/kentlangley/Jane/issues/40) A compact per-topic research brief for the nightly author.
5. [#41](https://github.com/kentlangley/Jane/issues/41) Misconceptions and approaches in authoring: hints,
   worked examples for the "I'm stuck" path, distractors and wrong-answer feedback.
6. [#42](https://github.com/kentlangley/Jane/issues/42) Kid-friendly check-understanding items, built offline from the
   two-tier assessments, for review gates and boss fights.
7. [#43](https://github.com/kentlangley/Jane/issues/43) Credits and licensing for the new material.

## Feedback and questions for Marble

All of these are suggestions from one small downstream user; please take what's useful.

1. **A tagged release.** The research lives under "Unreleased" on a fast-moving `main` (several merges on Oct 21–22).
   A tag (e.g. `v1.1.0`) would let downstream projects pin and cite a version without a commit SHA.
2. **Stable ordering.** Sorting `topics.json` (and `teaching-research.json`) by `id`, or keeping existing topics in
   their old order and appending new ones, would make diffs readable and protect anyone who joined by position.
3. **A machine-readable ID changelog.** For each release: added, removed/merged (with the target ID), renamed, and
   scope-changed IDs. The archive file already does this for two research records; the same for topics would let
   apps migrate progress automatically. A "scope changed" flag matters most, because a kept ID with a new meaning
   (like `mt_bESTSBB0wK`) can't be detected from IDs alone.
4. **Reconcile `learn` with `pedagogy`/`assess`.** Either repair the older fields where `learn` qualifies them (the
   Moon-phase shadow example), or add a per-field `supersededBy: "learn"` / `reviewStatus` marker so tools know which
   to trust.
5. **The changelog count.** 1,051 vs 1,049, as above.
6. **The "three map topics moved from Mathematics to Geography" entry.** Relative to 1.0.0 we see no subject changes
   on 1.0.0 topics (only three Computing domain moves), so we assume those map topics were added after 1.0.0. A
   note would help readers who diff against 1.0.0.
7. **Research for English and the humanities.** Writing, reading comprehension and history would benefit a lot from
   the same misconception and check-understanding treatment, and they're where offline authors have the least to go on.
8. **Research for the 340 new topics.** Even a short `assess` block (diagnostic plus error patterns) would be valuable.
9. **A slim build.** A research file without `provenance`, `sources` text and `publicationNotes`, or one file per
   subject, would be easier to vendor than one 24 MB file.

Thanks again for publishing all of this openly. We'll share anything we learn from using it.

---
*Data credit:* Marble Skill Taxonomy (v1) · © Generative Spark, Inc. (Marble) · https://withmarble.com · licensed under
ODbL 1.0 (database) and CC BY-SA 4.0 (content). This review is CC BY-SA 4.0, like Jane's other docs
([LICENSING.md](../LICENSING.md)).
