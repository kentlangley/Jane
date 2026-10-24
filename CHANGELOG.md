# Changelog

All notable changes to Jane are listed here. Versions follow [Semantic Versioning](https://semver.org/).
Dates are Pacific Time.

## [Unreleased]

### Added
- **Points Market** ([#74](https://github.com/kentlangley/Jane/issues/74), idea credit: Christopher): points buy fun, choice and peeks, never mastery, medals or permanent fog clear.
  - **Wallet** ([#68](https://github.com/kentlangley/Jane/issues/68)): `S.wallet` spend ledger; balance = earned (`S.points`, never decremented) − spent, computed server-side. `GET /api/market`, idempotent `POST /api/market/buy {pid,item,meta}` (same purchase id → one charge; one-time items → `already`), `wallet` on `/api/state`, `purchase` log events, a per-PT-day earned snapshot (last 60 days) and a `market` block in the export (`spent7d`/`earned7d` for price tuning). The whole pre-Market earned total is spendable on day one.
  - **Skins + Market screen** ([#69](https://github.com/kentlangley/Jane/issues/69)): a 🛒 Market tab (balance, cards, buy → confirm → owned, wear / take off; keyboard and reduced-motion safe). 13 skins in 4 slots (ships 300–900, avatars 300–800, boss skins 600–1,000, map themes 800–1,500), bought once, owned forever, equip free (`POST /api/market/equip`). Equipped skins draw on the Map ships, a new avatar chip in the header, the boss emoji/frame and the Map sea/land/fog palette. The ⭐ chip now shows the spendable balance; the parent report shows both earned and spendable.
  - **Scout flare** ([#70](https://github.com/kentlangley/Jane/issues/70)): 200 ⭐ lights one fogged island for 24 hours (from the Market, or "🎆 Light it up!" on a zoomed Map island): thinned fog, names on the ready/learning stones there, ❓ markers for its unclaimed fog finds. The fog returns at expiry; `fogState` adds `flares` only, and mask, clear counts and find eligibility are unchanged.
  - **Prove-it ticket** ([#71](https://github.com/kentlangley/Jane/issues/71)): 150 ⭐ on a review that is due now (Market, or the "🎟️ Prove-It tickets" button on a review-gate card): one harder question, one try (a check item's "why" tier, or the generator one level up). Right first try = the normal review pass (Leitner box +1, new due date, normal points) + 20 bonus earned points; a miss = the review stays due (≤ 1 day, no demotion), no refund. Max 2 a Pacific day; `POST /api/market/prove {pid, topicId}`. Gates are unchanged: the gate on screen keeps its own item.
  - **Pick your path** ([#72](https://github.com/kentlangley/Jane/issues/72)): 100 ⭐ picks the next new quest's topic (from 2–3 ready frontier topics offered that Pacific day, one per subject), and another 100 ⭐ picks its story theme (8 themes). One open pick of each kind; Play shows "🧭 Next quest: your pick!". The export lists `market.choices` / `market.openChoices` and adds a MARKET CHOICE line to `quests.nextStep`. A quest pack marks a pick used with `"honors": {"path", "theme"}` (validated by `publish-lessons.mjs`); `"declined"` closes the pick and refunds it with a new ledger row. LESSONS.md "Market choices", NIGHTLY.md and docs/NIGHTLY.md tell the nightly author how.
  - **Hidden chests + cheap extras** ([#73](https://github.com/kentlangley/Jane/issues/73)): mystery chests appear in the Market only after nearby fog clears (20 topics world-wide, 15 % of a subject) and hold a cosmetic prize fixed by the purchase id (rare chest-only skins, stickers, titles). Extras: 🤫 Jane whisper hint token (40, also wires the existing Hint Token fog find), 🛡️ streak shield (60; keeps 🔥 on one missed question, never the ⭐ run or any mastery), 🧊 streak freeze (80; covers one missed day of the new 📅 days-played streak). Stock caps 5/3/2. `POST /api/whisper`; `stats.daysPlayed` in the export.
- **Campaign Trail + Fog Map** ([#54](https://github.com/kentlangley/Jane/issues/54)): always-on Play trail + taunt, Quest of Quests overlay, literal fog on the Map (direct mastery clears), fog finds (chests/secrets/power-ups, D11 garnish only), and Final Boss unlock persistence with a Finale authoring hook.


## [0.6.0] - 2026-10-22

Marble teaching research ([#44](https://github.com/kentlangley/Jane/issues/44)).

### Added
- **Check-understanding items** ([#42](https://github.com/kentlangley/Jane/issues/42)): `data/checks/checks.txt` has 106
  kid-voice items for Math and Science topics, written offline from the two-tier and interpret/translate assessments,
  with wrong choices taken from the misconceptions. They cover the topics closest to a learner's review
  queue, spot-checks and frontier first; the rest are a follow-up. `build.mjs` validates them and attaches them to
  playable topics (`ck`), skipping pending and hidden-region topics.
  - **In the app:** review gates and spot-checks prefer them over the kid prompt; on generator topics they're used only
    to spot-check inferred skills. The "why" tier becomes the explanation, and the log records `qtype: "check"`.
  - **Progress:** stored progress, medals, gate choice and quest stages are unchanged.
  - **Bosses:** a boss may end with a two-tier "answer + why" pair (`"twoTier"`); `npm run research -- <id> --check`
    prints one.
- **Research in nightly authoring** ([#41](https://github.com/kentlangley/Jane/issues/41)): LESSONS.md "Researched
  stages" rules for Math and Science stages whose topic has research. `publish-lessons.mjs` warns, but never fails, when
  a researched stage has no wrong choice tagged `"misconception"`, or when a topic the learner got stuck on has no
  research re-teach prerequisite in the pack. It prints how many stages were researched. The example quest follows the
  rules.
- **Per-wrong-choice feedback** (optional `"feedback": {"<wrong choice>": "reply"}` on mc, picture and blank-with-choices
  questions): the app shows that reply in place of the generic hint on a first miss, and with the answer on a second.
  It stays server-side like the answer.
- **Research briefs for the lesson author** ([#40](https://github.com/kentlangley/Jane/issues/40)):
  `npm run research -- <topicId>` (`research.mjs`) prints a short brief, at most 6,000 characters, from Marble's teaching
  research. It shows the learn constraints first, then the summary, misconceptions, error patterns with next moves and
  prerequisite re-teach ids (with titles), the diagnostic and response levels, activities and best practices. Learn wins:
  pedagogy or assess text that a learn constraint forbids is dropped and flagged. For example, assess's "Earth's shadow
  points away at full Moon" is gone from the Moon-phases brief. Topics without research, such as all of English, print
  "no research". Pending and hidden-region topics get a notice instead of a brief. `export-progress.mjs` adds a bounded
  `research` section (compact briefs for the needsSupport, goDeeper, quest-refresh, stretch and nearest frontier
  topics) and `research: true` on frontier entries. A test makes sure the research stays out of `public/`, the Worker
  bundle and the Docker image. It is offline tooling only, so the app doesn't change.
- **Household region filter** (`HIDE_REGIONS`): `data/regions/AU.txt` tags 26 topics whose content is specifically
  Australian (Australian Curriculum-only, and about Australian history, government, money, symbols, literature or
  First Nations Australians' Country). Every topic still plays by default. A household that sets `HIDE_REGIONS="AU"`
  (env, Docker build arg, or `[vars]` in `wrangler.toml`) gets a build without them: they are left out like pending
  topics, the prerequisite graph is reconnected around them, they leave the progress total, and medal tiers do not
  change. Progress and medals already earned on them are kept and still listed. `export-progress.mjs` and
  `publish-lessons.mjs` check that `public/tax.json` was built with the configured setting and reject hidden topics.
- **Kid prompts for the new Marble topics** ([#39](https://github.com/kentlangley/Jane/issues/39)): 316 new
  `mt_id|question|right|wrong1|wrong2` lines in `data/kid-prompts/b11.txt`, and 11 math topics made playable through the
  existing generators (they fit: adding and subtracting within 20, sharing and grouping, halves/quarters/eighths, place
  value to 1000). The app now plays 1,916 of the 1,930 upstream topics, linked by 4,081 prerequisite edges.
  - **Still pending (14), each with its reason in `PENDING.txt`:** 6 math topics whose matching generator would ask the
    wrong kind of question (fractions of time, volume with fraction edges, odd/even rules, calculator use, factor
    algorithms, estimating decimal products); 6 body-safety, consent and puberty topics that belong in a conversation with
    a parent rather than a 3-choice quiz; 2 topics that need local knowledge (the First Nations Country of the
    learner's own school and area).
  - **New areas:** Geography (Maps & Spatial Skills, Places & Environments) and new domains in Computing, History, Life
    Skills and Science (Design & Technology) get icons; coverage for a blank learner now counts 66 areas (Science 20).
  - **Medal tiers:** the ancestor-count percentiles move from gold ≥ 31 / silver ≥ 9 to gold ≥ 34 / silver ≥ 10.
    Medals already earned keep their stored tier.

### Changed
- **Marble Skill Taxonomy updated to os-taxonomy `a871973`** ([#38](https://github.com/kentlangley/Jane/issues/38)):
  `data/marble/` is the pinned upstream commit (`data/marble/UPSTREAM`), byte-identical, now including Marble's
  teaching research (`teaching-research.json`, `archived-teaching-research.json`) as offline input for the lesson
  author; it is never copied into `public/` or the Docker image. 1,590 → 1,930 topics, 3,221 → 4,102 prerequisites.
  - **Pending topics:** the 341 new topics are listed in `data/kid-prompts/PENDING.txt` and left out of the app until
    slice 3 ([#39](https://github.com/kentlangley/Jane/issues/39)) writes their kid prompts or reviews a generator.
    `build.mjs` bridges the prerequisite graph across them, so no upstream prerequisite path is lost. The app plays
    1,589 topics (the 1.0.0 topics minus one merged away), linked by 3,320 prerequisite edges.
  - **Aliases:** `data/topic-aliases.json` maps removed ids to their replacement (`mt_3XJkeIn6J6` →
    `mt_UNzojLkNdm`, an upstream merge). `E.migrate` folds topic state, medals, help state, the current item, focus
    and requeued items forward (stronger record wins; one medal per topic, higher tier kept), idempotently.
  - **Scope changes:** records on `mt_bESTSBB0wK` (now pie charts only) and `mt_NSC3LT_-ch` (now capacity) are kept as
    they are; no credit is invented for the split-off line-graph topic. Kid prompts rewritten for those two, for
    `mt_H6LlpWgEYS` (now line-graph problems) and for `mt_QhLAeAlHI0` (food groups vs nutrients, matching upstream's
    correction). Icons added for the three Computing domains that moved out of Artificial Intelligence.
  - **Credits** ([#43](https://github.com/kentlangley/Jane/issues/43)): `NOTICE`, `LICENSING.md` and `/about.html`
    credit the teaching research, name the upstream commit, extend the NGSS notice to the research and add the ACARA
    notice for Australian Curriculum codes.
- **Kid prompts are keyed by topic id** ([#37](https://github.com/kentlangley/Jane/issues/37)): `data/kid-prompts/b*.txt`
  lines are now `mt_id|question|right|wrong1|wrong2` instead of `index|…` (the topic's position in
  `data/marble/topics.json`), so a reordered or extended taxonomy keeps every question on its own topic. `build.mjs`
  joins by id and fails on index-style, unknown or duplicate lines. The one-time converter
  `migrate-kid-prompts.mjs` refuses to run on any `topics.json` other than the release the indexes were written for.
  Build output is unchanged: `public/tax.json` is byte-identical (sha256 `317c4a30…e45e3d1`).

### Docs
- **[BOT-SETUP.md](BOT-SETUP.md):** a setup guide addressed to an AI assistant bot that a parent points at this repo:
  what to ask the parent, install and first run for each hosting option, placement and the first quest, the nightly
  routine (back up, export, refresh or write a quest, validate, verify progress unchanged), the teaching rules,
  privacy rules and how to report to the parent. The README has a new "Set up with an AI bot" section linking to it.
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md):** "How Jane works", a friendly diagram (`docs/architecture.svg`,
  generated by `docs/architecture.mjs`) of the daytime learning loop (no AI) and the nighttime teaching loop (the bot
  writes quests offline), the deploy options and template sharing, with a Mermaid text version and a FAQ. Linked
  from the README and BOT-SETUP.md.
- **Agent-Orchestrated Software (AOS):** ARCHITECTURE.md introduces the term, with Jane as an example and a short
  comparison with SaaS and traditional installed software; the README mentions it. The docs now say the agent may
  host the app but doesn't have to.
- **Friendly guide website** (`site/`, published with GitHub Pages by `.github/workflows/pages.yml`): six hand-written
  pages for parents and curious readers (home, how it works, a day for your kid, get started, privacy & safety, FAQ &
  credits), with the diagram, self-hosted Kalam headings and no trackers or outside scripts. Linked from the top of
  the README.
- **Diagram updated for AOS:** the subtitle names Agent-Orchestrated Software, the bot card says it may host Jane or
  not, and the deploy strip reads "on the bot's computer or anywhere you choose". The Mermaid version matches.

## [0.5.0] - 2026-10-20

### Fixed
- **Due reviews reach the learner in every quest session.** Reviews in a quest came only from the stage gates, and
  Play inside a quest serves no reviews of its own, so a session that stopped between gates (or a quest that ran
  over several days) could pass with no review at all. Now the first time the learner continues a quest each day,
  a 🔥 **warm-up** gate serves 1-2 due reviews (spot-check rules apply) at the next item boundary, never in the middle
  of a question (#25).
- **The gate budget matches the frozen "at most 4 gate items".** Gates could serve 3 × 2 = 6 items in one quest; warm-up
  and stage gates together now serve at most 4 per quest per day, and a gate reached after that opens for free (#25).

### Added
- **`reviewHealth` tells "not reached yet" from "broken":** `reviewsServed7d`, `gatesOpened7d`, `gatesAhead`,
  `lastPlayed`, `daysSinceLastPlay` and a `note` (`ok` / `not played since <date>: gates not reached yet` /
  `played but no reviews served: check the gates`). Answer logs record the gate key (#26).
- **`publish-lessons.mjs --refresh --date <quest date>`:** the nightly refreshes the quest in progress instead of
  starting another. Reached stages and the quest block must stay unchanged (exit **6**, nothing written); the size
  budget counts the remaining stages. `export-progress.mjs` says `REFRESH: …` with the exact commands, lists
  `lockedStages` / `refreshableStages` and writes the stored pack to `exports/quest-<date>.json` to start from (#28).

### Changed
- **One active quest at a time** (replaces the cap of 3). A quest pack published while the current quest is
  unfinished waits hidden: no "New quest!" reveal, not listed, can't be started (409). When the current quest is
  finished, the newest waiting pack becomes the new quest. The Quests tab shows the current quest big, a secret
  "Next up: ???" card and the finished quests; the `x/3` counter is gone. The parent report marks queued quests (#27).
- `publish-lessons.mjs` refuses a new quest while one is in progress (exit **3**, prints the refresh command), also in
  dry runs. Republishing a started quest gets the refresh checks (the v0.4 warning is now an error) (#28).

### Removed
- **Catch-up boosts** and the quest cap (`QUEST_CAP`): the publisher refuses `boostFor` files (exit 1). A `boost:<date>`
  key published earlier still applies in the app (#28).

## [0.4.2] - 2026-10-19

### Added
- **Trophy Case filters.** The medal-type chips at the top (All, Quest, Legendary, Gold, Silver, Bronze) are now
  buttons. Tap one and only those medals show. Tap it again, or tap All, to see everything. The chosen chip glows
  with a ✓ and the others dim, and the grid animates with AutoAnimate (no motion with reduced motion). A type with
  no medals yet shows a friendly message. The buttons are keyboard and screen-reader friendly (`aria-pressed`, a
  polite live region) and have 44 px touch targets. Helpers live in `public/trophies.js`, tested by
  `test/trophy-filter.test.mjs` (#23).

## [0.4.1] - 2026-10-19

### Changed
- **`migrate-medals.mjs` legendary policy:** legendary medals that were already awarded are always kept as legendary,
  and their topics keep their mastery (default). Everything else is re-scored as before. `--no-keep-legendary` gives
  the strict re-score.

### Fixed
- **Review gates behind the learner:** in a quest started before gates existed, a gate before a stage the learner
  already reached showed as a locked 🗝️ behind them. It now shows as passed (the parent report says "not needed").

## [0.4.0] - 2026-10-19

The learning loop: shorter quests, review built into quests, honest medals and wider coverage
(plan: [plans/archive/learning-loop-v0.4.md](plans/archive/learning-loop-v0.4.md)).

### Added
- **🗝️ Review gates.** In a started quest, a gate sits before stage 2, the middle stage and the boss (max 3). The
  learner answers 1-2 due reviews, picked at runtime from the Leitner queue, to open it. Gates never count toward
  quest progress and always open, right or wrong. The quest path shows locked and open keys; the parent report lists
  gate results.
- **Spot-checks.** About 1 gate item in 3 (all of them when nothing is due) checks a skill that was only inferred.
  Right: it counts as shown directly. Miss: back to learning, and the guesses built on it are withdrawn. No medals.
- **Answer-form nudges.** When a question asks for a percent, decimal, fraction or whole number, the right value in
  another form gets a friendly "write it as a percent (like 50%)" nudge instead of a miss. The third nudge shows the
  answer. Packs can set `form`; the validator checks prompts and answers agree.
- **Coverage by area** (`src/coverage.js`): the export's `coverage` (areas seen per subject, untouched areas with
  starter topics), a "new areas: N" line and warning in the validator, a small Play boost for unseen areas
  ("Something different" tries one first), and a "Coverage by area" section in the parent report.
- **`reviewHealth`** in the export (due, overdue, oldest overdue, gate items and spot-checks in 7 days, unverified
  inferred skills) and `unverifiedInferred` in the parent report.
- **`migrate-medals.mjs`**: re-scores existing medals and mastery under the new rules, with `--dry-run` (before/after
  counts), a required verified backup, Cloudflare and `--local` storage. Demoted topics go back into the review queue.
  Not run automatically.
- **`/healthz` on the Worker** (the Node server already had it), reporting the version.
- **Tests:** quest size, quest lock, answer form, medals, trophies, re-score, review gates (+ spot-checks), an
  end-to-end gate run on the Node server, coverage and version (77 tests in all).

### Changed
- **Shorter quests (enforced):** at most 16 graded questions and 7 stages (4-6 recommended), about 8 minutes with the
  gate items. The publisher fails a bigger quest and prints a time estimate. Deep dives are 3-4 questions.
- **Honest medals and mastery:** mastery needs 2 first-try right graded answers (on separate items, once per day per
  question); a medal needs 3; a self-check "yes" never masters a topic; placement doesn't award medals; legendary
  needs 3 first-try right boss answers in one day; quiz/self items are never bosses. Duplicate trophies are merged.
- **Finished quests are locked:** their medal, percentage and stages are snapshotted when finished; the publisher
  refuses to overwrite or boost a finished quest (exit 4, even with `--force`) and warns when a started quest's
  answered stages change. Older finished quests are grandfathered at 100%.
- **Spaced review moved from pack stages to the gates:** the 15-20% review-share rule is retired; a `review: true`
  stage still publishes with a warning. LESSONS.md and docs/NIGHTLY.md are updated for the nightly author (size
  budget, gates, coverage, locked quests).

### Fixed
- Numeric answers like "27%" are accepted where 0.27 is expected (and vice versa when a percent is asked).
- The parent report and export matched quest stages by index after filtering; they now match by topic.

## [0.3.0] - 2026-10-18

A way out when the kid gets stuck, teaching before testing, and bosses that are fair.

### Added
- **"I'm stuck 🤔" button** next to Check on every graded question, boss battles included. Each tap goes one step
  further: a hint, then a worked example of a similar problem plus how to start this one, then **"Skip for now"**.
  Skipping costs no heart, points or streak; in a boss it's neither a hit nor a miss. New `POST /api/stuck` and
  `POST /api/skip` (Worker and Node server).
- **Typing "idk", "I don't know", "dunno", "no idea", "help", "skip", "don't show this"…** in a fill-in opens the
  same help instead of being graded wrong.
- **Deterministic scaffolds** (`src/stuck.js`, no live AI): worked steps for fraction → decimal/percent (halving,
  money, ×10/100/1000), fraction of a number, adding/multiplying/dividing fractions, simplifying and whole-number
  facts, plus fair nudges for mc/order/match/true-false/number line/fraction bar. Packs can supply their own
  `steps` and `example`.
- **Teach before test.** New `learn` card type (idea + worked example, revealed one step per tap) and **guided
  practice** (`"guided": true` + `steps`, shown before answering). In Play, a new or shaky math skill now gets a
  generated Learn-it card and 2 guided items before it's graded.
- **"Boss ahead! Here's your power-up"** recap card before every boss (quest bosses: the stage's `powerup`, or the
  earlier learn card; Play bosses: the skill's idea + a worked example).
- **Support tracking:** `stuck` / `skipped` events in the day log; per-topic `support` in progress; skipped items are
  re-queued for a day later, guided and never as a boss. `export-progress.mjs` adds `stuck`/`skipped` to
  `weakSpots`, plus `needsSupport` and `requeued`; the parent report counts them.
- **Validator rules** (`publish-lessons.mjs`): a new skill's stage must start with a learn/why card and a guided
  question; a boss may only test skills taught/practised earlier in the quest (`teaches`) or mastered; no boss answers
  past thousandths or with decimal percents. `--offline` skips the progress lookup.
- **Tests:** `test/stuck.test.mjs` (stuck → hint → example → skip on the 3/16 boss, fair bosses, retry cap,
  validator rules, and an end-to-end run on the Node server).

### Changed
- **Play bosses are fair and can't trap the kid:** a boss only appears after the skill has 2 right answers, its level is
  capped at 4, generated boss questions never need more than 3 decimal places (no more 3/16 = 0.1875 in a boss), a
  question the kid missed or skipped isn't generated again for a day, and two boss misses pause that boss until tomorrow
  and re-teach the skill first.
- The example quest follows teach → guided → graded → boss (new "Fraction Training Cove" stage before the Kraken).
- LESSONS.md and docs/NIGHTLY.md: the teach → guided practice → graded → boss rule and the gentle "stuck" deep dive.
- Dependencies: `wrangler` 4.149.0 → 4.151.1 (devDependency; brings workerd/miniflare 1.20261006.1 → 1.20261012.1).
  The UI libs (Motion 14.3.0, Floating UI 1.8.0, canvas-confetti 1.9.4, AutoAnimate 0.10.0) and esbuild 0.28.2 were
  already the latest; the vendor bundle was rebuilt. `npm audit`: 0 vulnerabilities.

## [0.2.0] - 2026-10-17

Run the full app anywhere Node 22 runs, or in Docker. No Cloudflare account needed.

### Added
- **Standalone Node server** (`npm start`): runs the same Worker code (`src/worker.js`, `src/engine.js`) with static
  files from `public/` and **file-based storage** (one JSON file per key in `DATA_DIR`, atomic writes, one storage
  request at a time). No runtime dependencies. Configured by env: `LEARNER_NAME`, `LEARNER_AGE`, `LEARNER_GRADE`,
  `PORT` (8787), `HOST` (127.0.0.1), `DATA_DIR` (`./local-data`). `GET /healthz` for monitoring.
- **Local storage for the scripts:** `export-progress.mjs`, `publish-lessons.mjs`, `backup-progress.mjs` and
  `reset.sh` take `--local` (or `STORAGE=file`) to work against `DATA_DIR`; exports and backups go to
  `DATA_DIR/exports/` and `DATA_DIR/backups/`.
- **Docker:** multi-stage `Dockerfile` (build on Node 22, run on Node 22 Alpine with no npm packages), non-root `node`
  user, `/data` volume, health check; `docker-compose.yml` with a named volume, read-only root filesystem, dropped
  capabilities and a localhost-only port by default; `.dockerignore` keeps secrets and the learner's data out of the image.
- **`npm test`:** end-to-end smoke test of the Node server (kid app, `/about`, `/parent`, the first pizza question,
  publishing a quest locally and seeing it as a new quest, a local export).
- **INSTALL.md** now covers three options: Node, Docker and Cloudflare.

### Changed
- README: hosting, architecture, getting started and roadmap updated for the Node server and Docker.
- Cloudflare deployments are unchanged (no app code changed).

### Known limitations
- No passcode on the parent page (the Node server and Docker bind to localhost by default).
- Single learner per deployment.
- Nightly authoring happens outside the app, by a person or an assistant through the scripts.

## [0.1.0] - 2026-10-17

First public release.

### Added
- **Knowledge graph backbone:** the Marble Skill Taxonomy v1 (1,590 micro-topics, 8 subjects, 3,221 prerequisite
  edges), unchanged in `data/marble/`, plus a kid-friendly layer (3-choice questions and a glossary).
- **Adaptive placement with inference:** short placement checks per subject; prerequisites of what you show you know
  are inferred and checked later.
- **Spaced review:** Leitner boxes (1, 3, 7, 21, 60 days); inferred topics come back for a check.
- **Island map** of subjects and topics, with medals (tiers) per topic.
- **Lesson packs and quests:** nightly-authored quests with a boss finale and quest medal, at most 3 active at a time,
  and catch-up boosts when one falls behind.
- **Interactive formats:** multiple choice, pictures, fill-in-the-blank, ordering, matching, true/false speed rounds,
  number lines, fraction bars, numeric and text answers, "why it works" and fun-fact cards; **creative answers** graded
  generously; **glossary popups** for new words; kind hints after a first miss.
- **Parent report** (`/parent`): a calm, read-only report (overall progress, time today and this week, wins and
  struggle spots, what's due, quest status), in Pacific Time.
- **Learner settings:** `LEARNER_NAME`, `LEARNER_AGE`, `LEARNER_GRADE`, with a `{name}` placeholder in kid-facing text.
- **Sandbox mode** for testing against a live deployment without touching the real record.
- **Ops scripts:** `deploy.sh` (backs up progress first), `export-progress.mjs`, `publish-lessons.mjs` (validates
  packs; `--dry-run`), `backup-progress.mjs`, `reset.sh`.
- **UI polish:** a small pinned, vendored bundle (Motion, Floating UI, canvas-confetti, AutoAnimate), View Transitions,
  haptics, optional sound, keyboard and reduced-motion support.
- **Docs:** README (philosophy: no live AI, on purpose), INSTALL, LESSONS.md, docs/NIGHTLY.md, licensing map, NOTICE,
  CITATION.cff, CONTRIBUTING.

### Known limitations
- No passcode on the parent page.
- Single learner per deployment.
- Workers KV free-tier write limits apply.
- Nightly authoring happens outside the app (by a person or an assistant, through the scripts).
- Runs on Cloudflare Workers (or `npm run dev` locally) only; the standalone Node server is planned for v0.2.
  `prototype/` is the early math-only version, not the full app.

[Unreleased]: https://github.com/kentlangley/Jane/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/kentlangley/Jane/releases/tag/v0.6.0
[0.5.0]: https://github.com/kentlangley/Jane/releases/tag/v0.5.0
[0.4.2]: https://github.com/kentlangley/Jane/releases/tag/v0.4.2
[0.4.1]: https://github.com/kentlangley/Jane/releases/tag/v0.4.1
[0.4.0]: https://github.com/kentlangley/Jane/releases/tag/v0.4.0
[0.3.0]: https://github.com/kentlangley/Jane/releases/tag/v0.3.0
[0.2.0]: https://github.com/kentlangley/Jane/releases/tag/v0.2.0
[0.1.0]: https://github.com/kentlangley/Jane/releases/tag/v0.1.0
