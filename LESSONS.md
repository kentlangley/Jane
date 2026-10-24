# Lesson packs (Quests)

A lesson pack is the day's hand-written (or nightly-generated) content for the learner. It lives in Workers KV
(namespace `JANE_KV`) under the key `lessons:YYYY-MM-DD`, where the date is the **Pacific Time** calendar day.

## How the app uses it
For every item, the engine picks a topic (inside a started quest: review gates between stages, then the quest's
stages; otherwise an occasional spaced review → today's pack topics, interleaved with placement diagnostics →
frontier topics), then chooses content in this order:

Topics the household hides (`HIDE_REGIONS`, e.g. Australia-specific topics; BOT-SETUP.md) are not in `public/tax.json`:
they never appear in the export's frontier, and `publish-lessons.mjs` rejects a pack that names one. Never plan around them.


1. **Today's pack**: the next unanswered question for that topic (the intro card is shown before the topic's first question).
2. **Procedural math generators** (fractions, decimals/percents, ×/÷, +/−, place value...) for Mathematics topics. A generator always wins over a kid MCQ for the topics it matches, so a math topic whose matching generator would ask the wrong kind of question stays pending.
3. **Kid MCQ**: a precomputed 3-option question for the topic (`kq`/`ka`/`kw` in `public/tax.json`, sourced
   from `data/kid-prompts/b*.txt`, one line per topic: `mt_id|question|right|wrong1|wrong2`, joined by topic id). Every playable non-generator topic has one; topics listed in `data/kid-prompts/PENDING.txt` (each with the reason it is held back) are not playable yet (not in `public/tax.json`, so not in the export's frontier and not accepted by `publish-lessons.mjs`).
4. **Self-check** (last resort): the topic's short `self` prompt, answered "Got it! / Sort of / Not yet".
   The raw Marble `assessmentPrompt` and `evidence` are never shown to the learner.

Pack topics are served even if the map shows them as locked. Engine spaced reviews use generators or kid MCQs; in a
started quest they come through **review gates** between stages (below). On the map, tapping a green (ready) or blue stone opens
its card with **Explore now!** (a 2-3 question mini-session on that topic, then back to the map); orange (review due)
stones get **Practice now**.

## Every pack is a Quest
A pack is one **quest**: a title, a short story hook, a path of **stages** (one per topic or activity, in order),
a **boss finale** (the last stage, `"format":"boss"`) and a special **quest medal**. When the learner opens the app and
today's quest hasn't been started, they get the animated treasure-chest/scroll "New quest!" reveal with a Start button;
the Quests tab (red dot = new quest) lists today's and past quests with progress. While a started quest is running,
the app serves its stages in order (no placement diagnostics in between), with **review gates** before some stages. Finishing every item of
every stage awards the quest medal (shown in Trophies). Old packs without `quest` still work as plain adventures.

## Review gates (spaced review built into quests)
*"You have to do something from the past to make it to the future."* In a started quest, a 🗝️ **gate** sits before
stage 2, before the middle stage and before the boss (at most 3 per quest). To open it, the learner answers 1-2
review items that the app picks **at runtime** from the due Leitner queue (most overdue first, topics shown directly
before inferred ones; if nothing is due, a recently mastered topic that is due within 2 days; otherwise the gate is
open for free). Gate answers move Leitner boxes like any review (a first-try right moves the topic up a box, a miss
demotes it), and a gate opens once its items are answered, right or wrong, so it never strands the learner. Gates
don't count toward quest progress. The nightly author doesn't pick gate items.

**Warm-up and daily budget.** The first time the learner continues a started quest each day, a 🔥 **warm-up** of 1-2
due reviews comes first (after any question already on screen, never in the middle of one). Warm-up and gates
together serve **at most 4 review items per quest per day**; a gate reached after that opens for free. So reviews
reach the learner every day they play, even when a session stops between gates or a quest runs over several days.

**Spot-checks.** About 1 gate item in 3 (and every gate item when nothing is due) is a quick check of a skill the app
only *inferred* and never saw: the one with the most dependent skills, then the lowest confidence. Right: the skill
counts as shown directly (`verified`). Miss: it goes back to learning and the guesses built on it are withdrawn. A
spot-check never awards a medal. The export's `unverifiedInferred` counts the inferred skills not checked yet.

## Coverage (explore new areas)
An **area** is a Marble domain (12 in Mathematics, 20 in Science, 2 in Geography, and so on). An area is **seen** when it has at least
1 graded answer (not a self-check) in the exported days, or a topic shown directly with at least 1 correct answer.
Inferred-only topics don't count. The export's `coverage` lists, per subject, how many areas are seen, and for every
untouched area (`coverage.untouched`, math and science first) up to 3 ready **starter** topics closest to the target
age (never more than 2 years below it). Each nightly quest adds one of them (rule 7 below).
In free Play the app also wanders: ready topics in unseen areas get a small boost (+10, below the +40 for today's
pack), and "Something different" tries an unseen area first.

## Teach → guided practice → graded → boss (required)
Jane teaches first and tests second. Every quest follows this order, and `publish-lessons.mjs` fails a pack that doesn't:
1. **Teach.** A stage for a skill that is new or shaky (not mastered, not a `review` stage) starts with a **`learn`
   card**: one short idea plus one worked example (`example: {prompt, steps}`; the app reveals the steps one tap at a
   time). A `why` card also counts, but a `learn` card with an example is better.
2. **Guided practice.** The first graded question of that stage is **guided**: `"guided": true` with `steps` (1-4
   short lines shown *before* answering, e.g. `["1/8 = 0.125", "Half of 0.125 = ?"]`). Use 1-2 of them.
3. **Graded.** Then the normal graded questions, climbing back to the target level.
4. **Boss.** The boss may only test skills that were **taught or practised in an earlier stage of the same quest**
   (list them in that stage's `"teaches": ["mt_..."]`) or are **already mastered**. Questions can name the skill they
   test with `"skill": "mt_..."` (default: the stage topic). Add `"powerup"` (≤ 30 words) to the boss stage: the app
   shows it as a **"Boss ahead! Here's your power-up"** recap card right before the first boss question (without it,
   the app builds one from the earlier learn card).
5. **Real bosses.** A boss stage has **at least 3 graded questions** (the publisher fails fewer). A **legendary**
   medal needs 3 first-try right boss answers in one fight; one-question "bosses" don't exist anymore (non-math Play
   items are never bosses).
6. **Fair bosses.** No boss answer past thousandths or with a decimal percent (3/16 = 0.1875, 18.75%): the publisher
   fails it. Put such items in a guided stage instead, scaffolded (1/16 = half of 1/8 = 0.0625, so 3/16 = 3 × 0.0625).

Stages the learner already finished, and mastered topics, are exempt (the publisher reads progress read-only;
`--offline` skips that and treats everything as new). Play mode does the same on its own: a new or shaky math skill
gets a generated Learn-it card and 2 guided items before it is graded, and a Play boss only appears after the skill
has 2 right answers, never above level 4 and never with 4-decimal answers.

## When the kid gets stuck
Every graded question has an **"I'm stuck 🤔"** button next to Check. Typing *idk, I don't know, dunno, no idea,
help, skip, don't show this…* into a fill-in does the same instead of being graded wrong. Each tap goes one step:
1. a **hint** (the question's `hint`), 2. a **worked example** of a similar, easier problem plus **how to start this
one** (the question's `example` and `steps` if the pack has them; otherwise built in code for common shapes:
fraction → decimal/percent, fraction of a number, adding/multiplying/dividing fractions, simplifying, whole-number
facts; and a fair nudge for mc/order/match/true-false/number line), 3. **"Skip for now"**: no heart, no points and no
streak lost, and in a boss a skip is neither a hit nor a miss. There is no live AI anywhere in this.

A skipped item comes back **a day later, guided** (steps visible, never as a boss), the topic's level drops one notch,
and the topic is flagged. Two boss misses on the same skill pause that boss until tomorrow and re-teach it first.
`export-progress.mjs` shows `stuck`/`skipped` counts in `weakSpots`, a `needsSupport` list and the `requeued` items.
**For tomorrow:** a `needsSupport` topic gets a *gentle* deep dive: scaffold DOWN a level first (sixteenths via
eighths, halving or money; smaller numbers; one idea per step), a learn card, 2 guided items, then graded questions
that climb back up. **No boss on that skill tomorrow**, and add its own `example`/`steps` so the stuck help is
specific.

## One quest at a time
A quest is **current** once started and until finished, and there is only **one** at a time (since v0.5).
- The app plays the current quest. The Quests tab shows it big, a secret **"Next up: ???"** card when another quest
  pack is waiting, and finished quests below. No counter, no switching.
- A quest pack published while the current quest is unfinished is **queued**: no "New quest!" reveal, it isn't listed,
  and the app refuses to start it. When the current quest is finished, the **newest** waiting pack becomes the new
  quest (older unstarted packs are skipped; they were never started, so nothing is lost).
- `export-progress.mjs` reports `quests`: `current` (progress, `reachedStages`, `lockedStages`, `refreshableStages`,
  `remainingStages`), `queued`, and `nextStep`: **`REFRESH: …`** while a quest is in progress, **`NEW QUEST: …`** when
  none is.
- `publish-lessons.mjs` **refuses a new quest while one is in progress** (exit code **3**, nothing written). `--force`
  overrides, but the pack would only wait queued: don't.
- Catch-up boosts (`boostFor`) are **retired**: the publisher refuses them (exit 1). A `boost:<date>` key published
  before v0.5 still applies in the app until that quest is finished.

## Refreshing the current quest
While a quest is in progress, the nightly job **refreshes its unreached stages** with tonight's learning (weak
spots, coverage, stretch) instead of writing a new quest.
- **Reached stages are locked.** A stage is reached when the learner answered any of its questions (or saw its boss
  power-up card), or its item is on screen right now, and every stage before a reached one counts as reached too.
  The export lists them in `quests.current.lockedStages` (`reachedStages` = how many).
- **The quest block is locked** (`quest`: title, hook, medal, emoji): same story, same medal.
- **Everything after the reached stages may change**: rewrite, add, drop or reorder those stages, keep a boss last.
  `terms` may change too.
- **The budget applies to the remaining stages**: at most 16 graded questions and 7 stages after the reached ones
  (the size warnings count only those). The 4 review-gate items a day come on top, as always.
- Steps:
```bash
node export-progress.mjs              # nextStep "REFRESH: …"; also writes the stored pack to exports/quest-<quest date>.json
cp exports/quest-<quest date>.json packs/quest-<quest date>.json
#   edit packs/quest-<quest date>.json: keep "date", "quest" and topics[0 .. reachedStages-1] unchanged;
#   rewrite, add or drop only the topics after them (boss last)
node publish-lessons.mjs packs/quest-<quest date>.json --refresh --date <quest date> --dry-run   # validate
node publish-lessons.mjs packs/quest-<quest date>.json --refresh --date <quest date>             # write lessons:<quest date>
```
- The publisher compares against the stored pack and the learner's progress (read-only). If a reached stage or the
  quest block differs, it exits **6** and writes nothing, naming the stages; copy them unchanged and try again.
  `--refresh` on a quest that isn't in progress exits 1 (unstarted: publish normally) or 4 (finished: locked).
  Republishing the quest in progress without `--refresh` gets the same checks.
- Node server / Docker: add `--local` (or set `STORAGE=file`) to both scripts, like every other command; the export
  then writes `quest-<quest date>.json` under `$DATA_DIR/exports/`.

## Finished quests are locked
Once the learner finishes a quest, it is done for good: it shows 100% and its medal in the app, the Quests tab, the
parent report and the export, from a snapshot taken when it finished. Its pack serves no more items.
`publish-lessons.mjs` **refuses** (exit code **4**, nothing written) to overwrite `lessons:<date>` or write
`boost:<date>` for a finished quest, even with `--force`. **Put new material in the next quest.** A started, unfinished
quest can only be refreshed after its reached stages (see "Refreshing the current quest"; exit 6 otherwise).

## How to plan tomorrow's quest (rules)
0. Check `quests.nextStep` first: `REFRESH: …` means rewrite the current quest's unreached stages (above) with the
   rules below, not a new quest. `NEW QUEST: …` means write tomorrow's quest.
Run `node export-progress.mjs` and read `weakSpots` first. Then:
1. **Go deeper where the learner struggles.** Every topic in `weakSpots.goDeeper` (misses, hints, slow answers, failed
   reviews, "not yet / sort of" self-checks, "I'm stuck" taps and skips) gets a **deep dive** stage (`"deepDive": true`): a `learn`
   (or "Why it works") card first, then 1-2 guided items, then **3-4 graded questions** in all that start one notch easier and climb back to the level they missed, using at
   least 3 different formats. Easier-to-target steps = smaller numbers, one idea per step, the same trick in a new
   setting, then the original hard question last. Use `easierSteps` (hard prerequisites) for ideas. Topics marked
   `needsSupport` (the kid tapped "I'm stuck" or skipped) get the gentle version: start a full level down, and no boss on them
   tomorrow (see "When the kid gets stuck").
2. **Keep stretching strengths.** For each `weakSpots.strengths` domain, add a **new** topic from `stretchTo` (or the
   frontier), short (2-3 questions), with a picture/template.
3. **Never below the learner's level.** The target age and grade are settings (`LEARNER_AGE`, `LEARNER_GRADE` in `wrangler.toml`; the app is designed around ages ~8-12, upper elementary). No topics starting more than 2 years below the target age (the publisher warns), no
   baby wording. "Easier" means smaller steps, not younger content.
4. **Spaced review runs through the gates.** Don't spend quest budget on review stages: the app's review gates
   (see "Review gates") pull due reviews and spot-checks from the Leitner queue at runtime. `"review": true` stages
   still publish (for old packs) but get a warning. Watch the export's `reviewHealth` (`due`, `overdue`,
   `oldestOverdueDays`, `gateItems7d`, `spotChecks7d`, `unverifiedInferred`, `reviewsServed7d`, `gatesOpened7d`,
   `gatesAhead`, `lastPlayed`, `daysSinceLastPlay`, `note`) for review that isn't keeping up. `note` says whether the
   learner just hasn't played (`not played since …`) or played without getting reviews (`played but no reviews served`).
5. **Make it interactive and illustrated.** Mix formats (the publisher warns if fewer than 3 interactive ones), add a
   `scene` or `template` to most stages, and drop in a **fun-fact** card or two.
6. **Keep it short (enforced):** a quest is about **8 minutes**: **at most 16 graded questions** over **4-6 stages
   (7 at most)**, boss last. The app adds up to 4 review-gate items on top (see "Review gates"), so the learner
   answers about 20 questions. The publisher **fails** a quest above 16 graded questions or 7 stages, prints a time
   estimate (graded × 25 s + cards × 10 s) and warns above 8 minutes. Spread them out: deep dives 3-4, stretch
   stages 1-3, boss 3-4.
7. **Visit a new area.** Include at least one stretch stage from `coverage.untouched` in the export (see
   "Coverage"), rotating subjects with math and science first, using one of the listed `starters`. The publisher
   prints "new areas: N" and **warns** (never fails) when a quest adds no untouched area while some are left.

## Research briefs (optional tool)
Marble's teaching research (`data/marble/teaching-research.json`, Science and Mathematics only) can help when you plan
a stage. It stays offline: never in the app, `public/` or the Docker image.
```bash
npm run research -- mt_ML5t7n2-U8          # or: node research.mjs <topicId> [<topicId> …] [--json] [--all]
```
This prints a short brief, under 6,000 characters. It starts with the **learn constraints** (follow them), then the
learn summary, the top misconceptions, the error patterns (how each shows up, the next move and a prerequisite to
re-teach, with its title), the diagnostic and response levels, the key activities and pedagogy's best practices.
Where pedagogy or assess say something a learn constraint forbids, the brief drops it and lists it under
"⚠ learn vs pedagogy/assess". Other topics, English for example, print "no research". Pending or hidden-region topics
print a notice and no brief, because they can't go in a pack. The nightly export carries the same briefs in compact
form under `research` (see "Nightly loop"). The research is agent-authored and has not been tested with learners, so
adapt it in the kid's voice and never paste it. For a stage on a researched topic, follow "Researched stages" below.

## Researched stages (Math and Science topics with research)
When a stage's topic has a research brief, use the brief to plan the stage (the publisher prints "N researched stages"):
1. **Learn card and worked example follow an activity's intended insight.** Build the idea the research's activity is
   for, rather than only stating a rule. For example, show triangle area as half of a parallelogram, so the ÷2 means
   something. Follow every learn constraint.
2. **The hint targets the top misconception.** If the brief says learners grab the slant side, the hint points at the
   right angle.
3. **"I'm stuck" help follows best practice.** The question's `example` and `steps` use the approach the brief recommends
   (its best practices and next moves): a similar solved problem, done the recommended way.
4. **At least one wrong choice per mc comes from a listed misconception.** This applies to `mc`, `picture` and `blank`
   with choices. Tag that choice with `"misconception": "<that wrong choice>"`, and write the `explanation` from the
   misconception's next move. The publisher warns when a researched stage has choice questions and none is tagged. It's
   a warning, not an error.
5. **Optional per-wrong-choice feedback.** Add `"feedback": {"<wrong choice>": "short reply"}` (≤ 20 words, "you"). The
   app shows that reply in place of the generic hint when the kid picks that choice, and again with the answer if they
   miss twice. Give the misconception's choice a reply that says what went wrong, kindly. Keys must be wrong choices.
   Like the answer, the feedback never reaches the browser before the kid answers.
6. **needsSupport topics drop to the re-teach prerequisite.** For a topic in `weakSpots.needsSupport`, start an earlier
   stage (or `teaches`, or a question `skill`) on the brief's "re-teach first" prerequisite. The publisher warns when a
   stuck topic's stage has research re-teach prerequisites and none of them is in the pack.
```json
{"type":"mc","prompt":"What is 1/3 of 1/2?","choices":["1/6","1/2","2/5"],"answer":"1/6","misconception":"1/2",
 "feedback":{"1/2":"Careful! Times is not like adding. Multiply the bottoms too: 3 × 2."},
 "hint":"Tops: 1 × 1. Bottoms: 3 × 2.","explanation":"Cut the half into 3 equal parts: each is 1/6 of the whole. No common denominator needed."}
```

## Check-understanding items (gates, spot-checks and the boss finale)
`data/checks/checks.txt` holds short kid-voice check items keyed by topic id. They were written offline from the
research's two-tier and interpret/translate assessments, and the wrong choices come from its misconceptions. Raw
assessment text is never shown to the kid.
- **The app uses them by itself.** Review gates and spot-checks serve a topic's check item instead of its kid prompt. On
  a generator topic (like fractions or decimals), only a spot-check of an inferred skill uses it. You don't schedule them.
- **Boss finale (optional).** A boss may end with a two-tier pair: an mc with `"twoTier": "answer"`, then an mc with
  `"twoTier": "why"` (the reason). `npm run research -- <topicId> --check` prints the pair, ready to paste, for a topic
  that has one. Use the boss topic's own item, or one for a skill taught earlier in the quest. The fair-boss rules
  still apply. The pair must be the last two questions of the boss stage, and the publisher fails it anywhere else.
  Performance-task checks (build, draw or explain) belong in guided stages, not the boss.
- **New items** go in `data/checks/checks.txt`: `mt_id|question|right|wrong1|wrong2[|why right|why wrong1|why wrong2]`.
  Keep the question at 15 words or fewer, choices at 12 or fewer, use "you", and never paste adult assessment text
  (`npm test` checks this). Pending and hidden-region topics are skipped by the build.

## Writing style (required for every pack)
Jane talks **to** the learner, never about them. Every prompt must be:
- **Second person**: "you / your" ("Your $40 game is 50% off…"), never "Can Sam…", "{name} is…" or "he/she".
- **Short**: 15 words or fewer, one idea per question. Intros and the quest hook: 1-2 sentences (≤ 25 / ≤ 30 words).
  Cards: ≤ 30 words. Speed-round statements: ≤ 12 words.
- **Grade-level words** (the configured `LEARNER_GRADE`); no jargon unless the question teaches it.
- **Fun Jane voice**: "Hey {name}!", "Quick one!", pirates, dragons, treasure. Keep it inside the word limit.
- **3 options** for multiple choice (1 right, 2 clearly wrong but plausible).
- Hints nudge, don't give away; explanations are 1-2 short sentences.

**The learner's name:** write `{name}` (e.g. `"Hey {name}!"`); the app fills in `LEARNER_NAME` when it shows the item,
so packs never contain a real name. Use it sparingly (hooks, intros, a greeting), never in third person.

Good: `"Hey {name}! Can you name one way people guess risk wrong?"`
Bad: `"Can Sam explain why taking a risk isn't always irrational — and describe one cognitive bias…"`

## Fill-ins: never one right answer when many make sense
- **Rule:** never use a one-right-answer fill-in (`text`, typed `blank`) when many answers make sense. Use 3-choice
  `mc` (or `blank` with `choices`) with exactly one clearly correct option, or `creative`.
- If you really need one specific word, add a clear clue that points to it ("starts with L", "the king of the jungle")
  and list every sensible spelling in `acceptedAnswers`.
- Creative prompts (similes, metaphors, describing words, "give an example", "name a…") are always `creative`. Any
  sensible word counts: not empty, a real-looking word, not junk ("idk", "asdf"), and not the subject itself
  (`notAnswers`). Then celebrate it: `"celebrate": "Nice! A lion is a classic, but \"{given}\" works too! 🦁"`.
- Its `explanation` must say WHY the example works, kindly: "Lions are famous for being brave, so we say brave as a lion!"
- `publish-lessons.mjs` warns on fill-ins that look open-ended and on one-answer fill-ins.
- **After 2 misses** the app shows the answer as a **learning moment** with the explanation and +2 points. It is
  logged (`learningMoment: true`) but doesn't count as a wrong answer on their record or step them down.

## Key terms (glossary)
Key terms in questions, intros, cards, hints and explanations get a playful dotted underline. Hover (desktop) or tap
(phone, tap elsewhere to close) shows a short kid definition. Tapping a term never counts as an answer, and answer
buttons and inputs are never underlined. Only the first time a term shows up in an item is marked (whole word, any
case, plurals ok). The shared glossary is `data/glossary.txt` (`term/synonym|emoji|definition`, ~440 terms covering the
taxonomy prompts and packs), built into `public/glossary.json` by `build.mjs`. A pack (or boost) can add its own words:
```json
"terms": { "Kraken": {"d": "A giant sea monster from old sailor stories.", "e": "🐙"}, "mph": "Miles per hour." }
```
Definitions: ≤ 15 words, grade-level words, "you" where natural (the publisher warns). **Define every new word a quest
introduces.** Lookups are logged (`event: "term"`), and `export-progress.mjs` lists them in `termsLookedUp`. Reinforce
those words in the next quest (use them in a question, or add a fun-fact card).

## Formats
| type | what the learner does | fields (besides `prompt`, `hint`, `explanation`) |
|---|---|---|
| `mc` | taps one of 3 buttons | `choices`, `answer` (exactly one choice) |
| `numeric` | types a number (12, 0.75, 3/8, 27%, "$20", "6 weeks") | `answer`, `tolerance?`, `form?` (`percent`/`decimal`/`fraction`/`whole`, see below) |
| `text` | types a word (only when ONE word clearly fits) | `answer`, `acceptedAnswers?` (fuzzy: plural/singular, a/an/the, small typos) |
| `creative` | types their own idea, graded generously: any sensible word/phrase counts, and Jane celebrates it | `answer` (your example), `acceptedAnswers?`, `notAnswers?` (e.g. the subject word), `block?`, `minLength?`(2), `maxWords?`(5), `celebrate?` ("{given}", "{answer}"), `placeholder?` |
| `blank` | fill in the blank: prompt has `___`; tapped word flies into the gap (or typed if no choices; add `"creative": true` for any-sensible-answer) | `choices?`(2-4), `answer`, `acceptedAnswers?` |
| `picture` | taps the right picture | `choices: [{label, pic}]` (2-4; `pic` = emoji or `<svg>`), `answer` = a label |
| `order` | drags cards (or ▲▼) into order | `items` in the CORRECT order (3-6; the app shuffles); no `answer` |
| `match` | taps left, then its partner on the right | `pairs: [[left,right]...]` (3-5, unique, no `=` or `\|`) |
| `truefalse` | true/false speed round, one statement at a time, speed bonus | `statements: [[text,true/false]...]` (3-8, mix both), `seconds?` (default 30) |
| `numberline` | drags a 🚩 to a value | `min`, `max`, `step?`(1), `answer` (on a step), `labels?` [[value,label]] |
| `fracbar` | taps pieces of a bar to shade a fraction | `parts` (2-12), `answer` like "3/8" (equivalents accepted) |
| `why` | "💡 Why it works" card, tap Got it | `title`, `body`, `emoji?` (no prompt/hint/answer) |
| `fact` | "🤩 Fun fact!" card | `title`, `body`, `emoji?` |
| `learn` | "🧠 Learn it" card: an idea plus a worked example, revealed one step per tap | `title`, `body` (≤ 30 words), `example: {prompt, steps}`, `emoji?` |
Cards earn 2 points and never count for or against mastery.

**Answer form.** When a question asks for a form ("as a percent", "as a decimal", "what fraction", or `"form"` on a
`numeric` question), only that form counts: write the answer in it (`"27%"`, `"0.52"`, `"3/8"`). The right value in
another form (0.27 for a percent, 52/100 for a decimal, 12/4 for a whole number) gets a gentle "Right value! Now
write it as a percent" nudge, not a miss. The publisher fails a question whose prompt asks for one form and whose
answer is written in another.

**On any graded question:** `guided: true` + `steps` (guided practice: steps shown before answering; a miss is a
learning moment), `steps` alone (used as "how to start" in the stuck help), `example: {prompt, steps}` (a similar
solved problem for the stuck help), `skill` (the topic a boss question tests).

**Illustrations** (optional on any question): `scene` = a few emoji (`"🚗💨 10 miles ⏱️ 2 hours"`) or an inline
`<svg viewBox=...>` (no scripts, event handlers, external images; < 12k chars), and/or `template`:
`{"type":"pizza","slices":8,"eaten":3}` · `{"type":"fracbar","parts":4,"shaded":1,"label":"..."}` ·
`{"type":"numberline","min":0,"max":10,"marks":[[3,"you"]]}` · `{"type":"timeline","events":[["3100 BC","Egypt united","👑"],...]}` ·
`{"type":"foodweb","chain":[["🌱","Grass"],["🐰","Rabbit"],["🦊","Fox"]],"note":"..."}` · `{"type":"orbit","planets":[["🌍","Earth"],["🔴","Mars"]],"highlight":"Earth"}`.

## Schema
```jsonc
{
  "date": "2026-10-17",                     // required, YYYY-MM-DD (PT). publish-lessons --date overrides it
  "title": "Captain Comet's Lost Treasure",  // shown on the parent page
  "quest": {                                 // makes the pack a Quest (strongly recommended)
    "title": "Captain Comet's Lost Treasure", "emoji": "🏴‍☠️",
    "hook": "Captain Comet hid her treasure across 10 islands. Solve each clue, then beat the Fraction Kraken!",
    "medal": { "name": "Comet Treasure Medal", "emoji": "💎" }
  },
  "terms": { "Kraken": {"d": "A giant sea monster from old sailor stories.", "e": "🐙"} },  // optional extra glossary words
  "honors": { "path": "mt_hJW7hVflm3", "theme": "pirates" }, // optional: the learner's Market picks this quest honors ("Market choices")
  "topics": [                                // the quest path, in order; topicIds unique
    {
      "topicId": "mt_hJW7hVflm3",            // a Marble topic id (public/tax.json or the export's frontier)
      "stage": { "name": "Simile Swamp", "emoji": "🐊" },   // required in quests: the stop on the path
      "format": "story",                     // quest | story | mystery | minigame | timed | boss | explore | guided
      "deepDive": true,                      // weak area: learn/why card + guided + 3-4 graded steps, mastery needs 3 in a row
      "teaches": ["mt_lvaSGHwvQ5"],          // optional: skills this stage teaches/practises for the boss
      "powerup": "...",                      // boss stage only: the "Boss ahead!" recap (≤ 30 words)
      "review": false,                       // true = review stage for an already-mastered topic
      "intro": { "emoji": "🐊", "title": "Simile Swamp", "story": "The swamp guard only talks in similes..." },
      "questions": [ /* any of the formats above, asked in order */ ]
    }
    // ... last stage: "format": "boss" (HP hearts, 3 in a row to win)
  ]
}
```
## Mastery and medals (honest)
A pack topic is mastered after 2 first-try correct answers in a row (3 for `boss` and `deepDive`), and never from a
single question: a stage with only 1 graded question can't master its topic. In a quest the stage still plays to the
end after mastery. A "👍 Got it!" self-check never masters anything on its own (a graded check follows). A repeated
identical question counts at most once per day, and guided practice doesn't count. A **medal** needs **3 first-try
correct graded answers** on a directly mastered topic (placement answers master for placement, without a medal).
Medals and mastery from before these rules are re-scored once with `node migrate-medals.mjs --dry-run` (shows
before/after counts), then `node migrate-medals.mjs --backup <file>` (needs a fresh `node backup-progress.mjs`; add
`--local` for the Node server). Topics that lose mastery become unverified and due now, so review gates re-check them.
**Legendary policy (default):** legendary medals that were already awarded are always kept as legendary, and their
topics keep their mastery; everything else is re-scored. `--no-keep-legendary` re-scores legendary medals strictly too.

## Market choices (the learner picks the next quest)

In the app's 🛒 Market (plans/archive/points-market.md) the learner can spend points to pick the **next new quest**: one topic from
the 2-3 ready frontier topics the app offered (`pick-path`), and/or a **story theme** (`pick-theme`: pirates, space,
dungeon, jungle, ocean, dinosaurs, detective, sports). Open picks are in the export as `market.openChoices`
(`market.choices` keeps used ones too), and `quests.nextStep` (or `quests.marketChoice` while a quest is still running)
spells out what to do.
- **Honor it on the next NEW QUEST**, not on a refresh of the current quest's stages. A picked topic becomes a real stage
  (learn card → guided → graded, and the boss may test it). The pick is a choice, never a skip: every rule above still applies.
  A theme sets the quest's story world (title, hook, stage names, intro stories).
- **Mark it used:** add `"honors": {"path": "<the picked topicId>", "theme": "<the picked theme id>"}` to the quest pack
  (only the keys that were picked). The app marks the pick used when it loads a quest pack dated after the pick that
  honors it. `publish-lessons.mjs` checks that the topic is a stage of the pack and the theme is from the table.
- **No valid quest fits?** (e.g. the topic was mastered by inference since): use `"declined"` for that key and add
  `"note": "<why, in kid voice>"`. The app closes the pick and refunds its points (a new ledger row; history is never
  rewritten). Say why in the quest's hook too.
- Points never buy medals, mastery, skipped stages or open gates; nothing in the pack should hint otherwise.

## Fog finds (secrets under the Map)

Clearing fog (direct mastery only) can uncover a **chest**, **secret path**, or **power-up** from a fixed table — never live AI. Finds are claimed once (`/api/fog/claim`); `export-progress.mjs` lists them under `fog.finds` / `fog.available` so the nightly author can weave a hook if they want.

**Honesty (D11):** power-ups are garnish only (hint token, fun-fact card, story skin). They must not invent medals, skip teach → guided practice → graded → boss, or bypass hearts/mastery rules.


## Example deep dive (Similes & Metaphors, for a topic that showed up in `weakSpots.goDeeper`)
```json
{"topicId":"mt_hJW7hVflm3","deepDive":true,"format":"story","stage":{"name":"Simile Swamp (deep dive)","emoji":"🐊"},
 "intro":{"emoji":"🐊","title":"Simile Swamp","story":"The swamp guard only talks in similes and metaphors. Learn the trick to pass!"},
 "questions":[
  {"type":"why","emoji":"🔍","title":"The 'like or as' trick","body":"A simile compares with LIKE or AS. A metaphor says one thing IS another. Look for like or as!"},
  {"type":"blank","prompt":"A simile uses the word like or ___.","choices":["as","is","and"],"answer":"as","hint":"\"As brave as a lion.\"","explanation":"Similes use like or as."},
  {"type":"mc","prompt":"\"You run like a cheetah.\" Simile or metaphor?","choices":["Simile","Metaphor","Neither"],"answer":"Simile","hint":"Spot the word like.","explanation":"It uses like, so it's a simile."},
  {"type":"mc","prompt":"\"The swamp is a giant soup.\" Simile or metaphor?","choices":["Metaphor","Simile","Neither"],"answer":"Metaphor","hint":"Is there a like or as?","explanation":"No like or as. It says the swamp IS soup: a metaphor."},
  {"type":"match","prompt":"Match each sentence to its type!","pairs":[["Quiet as a mouse","Uses AS: simile"],["Sleeps like a log","Uses LIKE: simile"],["Time is money","Says IS: metaphor"]],"hint":"Look for like or as first.","explanation":"..."},
  {"type":"truefalse","seconds":30,"prompt":"Speed round! Is it a SIMILE?","statements":[["Her eyes were stars.",false],["Cold as ice.",true],["He swims like a fish.",true],["My room is a pigsty.",false]],"hint":"Simile = like or as.","explanation":"..."},
  {"type":"text","prompt":"Finish the simile: The pirate was as brave as a ___.","answer":"lion","accept":["tiger","bear","knight","hero","dragon"],"hint":"Pick a brave animal!","explanation":"Anything brave works, like a lion!"},
  {"type":"fact","emoji":"🎵","title":"Songs love similes","body":"Tons of songs use similes, like \"shine bright like a diamond.\" Listen for them today!"}]}
```
Why it's a good deep dive: it names the trick first, starts with the easiest step (just the word "as"), repeats the
idea in 5 different formats, and ends with the learner making their own simile.

## Publishing
```bash
cd jane   # the repo checkout
node publish-lessons.mjs packs/2026-10-17.json --dry-run      # validate only
node publish-lessons.mjs packs/2026-10-17.json                # validate + write lessons:2026-10-17
node publish-lessons.mjs my-pack.json --date 2026-10-18       # override the date
node publish-lessons.mjs refresh.json --refresh --date 2026-10-17   # refresh the quest in progress (unreached stages only)
node publish-lessons.mjs packs/<id>/2026-10-18.json --learner <id>   # another learner's quest (see "Several learners")
```
A finished quest is locked: the script exits with code 4 and writes nothing (see "Finished quests are locked").
A new quest while one is in progress exits 3; a refresh that touches a reached stage exits 6 (see "Refreshing the current quest").
The script exits with code 1 and lists every problem if the pack is invalid, for example an unknown topic id, an
mc answer that isn't one of the choices, or a missing hint or explanation. Nothing is written in that case.


## Finale quest (Campaign Trail climax)

When the learner's Campaign Trail is full (**12** quest medals) **and** the Final Boss is fully lit (**4** legendary topic medals), the app persists `campaign.finalBoss.revealedAt` and shows a one-time unlock reveal. Export surfaces `campaign.finalBoss.unlocked` / `revealedAt`.

The nightly author **may** write a one-shot **Finale** quest (still one-quest-at-a-time; no free medals). Until that pack exists, the app taunts: "Jane is forging the finale…". Do not invent medals or skip mastery to rush the unlock.

## Nightly loop
```bash
node export-progress.mjs                    # → exports/progress-<today PT>.json
node export-progress.mjs --out /tmp/p.json --date 2026-10-16
```
The export contains `weakSpots` (per topic and per domain over the last 7 days, `--days N`: first-try misses that
needed a `hints`, final `misses`, `slow` answers > 30 s, `failedReviews`, `unsure` self-checks, a `weakScore`, plus
`goDeeper` suggestions with easier prerequisite steps and `strengths` with `stretchTo` topics), `summary` (counts per state and subject), `stats`, `todayLog` (every answer plus `mastered`,
`inferred` and `demoted` events), `learnedToday`, `frontier` (ready and learning topics, closest to the target age (`LEARNER_AGE`) first,
with full topic details, prerequisites and unlocks; `research: true` when a research brief exists), `research` (compact briefs for
the needsSupport, goDeeper, quest-refresh, stretch and top frontier topics; see "Research briefs"), `reviewDue`, `reviewHealth` (see rule 4), and the raw `progress` record.
Write tomorrow's quest from `weakSpots` and `frontier` (the gates handle `reviewDue`) using the rules above, dry-run, fix every warning, then publish it.

Both scripts call the repo's `wrangler` (Node 22; a portable Node in `~/.local/node-v22.20.0-linux-x64` is used if present), read the account and KV ids from `wrangler.toml`, and need `CLOUDFLARE_API_TOKEN` set in the environment (never commit it).

## Several learners (profiles)
One household app can serve several kids (plans/archive/learner-profiles.md). Each learner has their own progress,
quests, wallet, trail, fog, medals and logs. The **primary** learner keeps the original keys, so every command above
without `--learner` works on the primary learner exactly as before. For every other learner pass `--learner <id>`:
```bash
node export-progress.mjs --learner <id>                     # → exports/<id>/progress-<today PT>.json
node publish-lessons.mjs packs/<id>/<date>.json --learner <id> --dry-run
node publish-lessons.mjs packs/<id>/<date>.json --learner <id>        # → L:<id>:lessons:<date>
node backup-progress.mjs --learner <id>                     # → backups/<PT date>/<id>/progress-*.json
```
**Nightly loop over learners.** The export's `learners` lists every profile (`id`, `name`, `grade`); `profile` describes
the learner it was run for (`id`, `primary`, `name`, `age`, `grade`, `interests`). Each night:
1. `node export-progress.mjs` (primary) and read `learners`.
2. For **each** learner: export with `--learner <id>`, plan **one quest for that kid at their own level** (their
   `profile.age`/`grade`, their `frontier`, their `weakSpots`, their `interests` for themes), dry-run and publish with the
   same `--learner <id>`. Never copy one kid's quest to another; never mix their exports.
3. A learner with no placement result yet (`placementQuest` missing in the export) gets the **placement quest** first
   (see "Placement quests").
Packs for added learners live in `packs/<id>/` (gitignored like `packs/*.json`). The voice rules apply to everyone: talk to
the learner as "you"; for an older learner keep the tone grown-up (no baby talk), same rules otherwise.
**Privacy:** kids' names beyond the primary's, grades, interests and balances never go into public issues, PRs or docs.

## Testing without touching the learner's progress
Open `https://<your-worker>.<your-subdomain>.workers.dev/api/sandbox?on=1` (sets a 24 h cookie, redirects to the app), then
`fetch('/api/sandbox/reset',{method:'POST',body:JSON.stringify({offsetDays:1})})` copies the real progress into
`sandbox:*` keys and shifts the sandbox clock (1 = see tomorrow's quest). `/api/sandbox?on=0` returns to the real app.
`/#quest-preview` replays the quest reveal without changing anything.
