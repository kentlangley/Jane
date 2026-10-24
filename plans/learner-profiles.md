# Learner profiles: one household, several kids

Status: in progress. Tracking issue: #87. Slice issues: #82 #83 #84 #85 #86. Owner: self (the bot), approved by Kent ("option 2: profiles in one app").

## Problem
Jane serves exactly one learner per deployment: progress, quests, wallet, campaign trail, fog Map, medals, streaks,
skins and settings all live under global KV keys (`progress`, `lessons:<date>`, `log:<date>`, …) and the learner's name,
age and grade come from `wrangler.toml` `[vars]`. A sibling wants to play in the same household app. A second deployment
per kid would double the nightly work and the infrastructure; one app with **profiles** keeps one deployment per family
(the Agent-Orchestrated Software model) and adds a "Who's playing?" picker.

## Design (approved)
- **Picker.** "Who's playing?" with each kid's avatar. Skipped when there is one profile or the device remembers a profile
  (cookie). Existing URLs/bookmarks keep working.
- **Optional 4-digit PIN per profile.** A kid-level guard, not real security. Stored as a salted SHA-256 hash; the parent
  can set, change or clear it from the parent view.
- **Everything per learner:** progress, quests/packs, wallet + ledger (Points Market), campaign trail, fog Map + finds,
  medals, streaks, skins, settings, answer logs, sandbox.
- **Migration of the existing learner** into the primary profile, byte-for-byte: same points, medals, mastery, quests.
  Backed up first, idempotent, reversible (backup kept, rollback documented).
- **Per-learner nightly.** `export-progress.mjs` and `publish-lessons.mjs` (and `backup-progress.mjs`) take
  `--learner <id>`; default = the primary learner, so existing commands behave exactly as before. LESSONS.md / NIGHTLY.md
  loop over learners: one quest per kid at their own level.
- **New-learner onboarding** from the parent view: name, grade, interests, avatar. A short **placement quest** (a
  diagnostic across subjects at/around grade level with an adaptive start point) so Jane finds the level instead of
  starting from zero. Onboarding is generic; no specific child's profile or content is created by this plan.
- **Parent view:** a per-kid switcher showing each kid's stats; add-a-learner form; PIN reset.
- **Later, not now:** a shared family trail / seeing siblings' Maps; multi-household or classroom (each family keeps its
  own deployment).
- **Privacy:** public docs, PRs and issues carry no kids' personal details beyond what is already public, and no balances.

### Data model (decided in planning: safest for existing data)
- `profiles` KV key = the registry: `{v:1, primary:"<id>", learners:[{id, name, grade, age, interests[], avatar,
  pin:{salt,hash}|null, prefix, created}]}`.
- **The primary learner keeps the existing unprefixed keys** (`prefix: ""`). The migration therefore only *adds* the
  registry; it never rewrites, copies or moves the primary learner's records. This is byte-for-byte by construction, has
  no copy-then-switch race while the learner may be playing live, and rollback is "delete `profiles`".
- Other learners use the prefix `L:<id>:` for every per-learner key: `L:<id>:progress`, `L:<id>:lessons:<date>`,
  `L:<id>:log:<date>`, `L:<id>:boost:<date>`, `L:<id>:debug:clockOffsetDays`; sandbox keys are `sandbox:` + that.
- With no registry (fresh installs, or before the migration) the app synthesises a one-learner registry from `[vars]`
  (id = slug of `LEARNER_NAME`, prefix ""), so a single-kid install behaves exactly as today and needs no migration.
- The primary learner's name/age/grade still come from `[vars]` (unchanged behaviour); other learners' come from their
  profile (age defaults to grade + 5.5, e.g. 5th grade → 10.5).
- Learner selection per request: `?learner=<id>` (API/parent), else the `jl` cookie (remembered device), else the only
  profile, else the primary. APIs with no selection keep serving the primary learner (old clients keep working); the
  kid app shows the picker before it loads state when there are 2+ profiles and nothing is remembered.
- PIN: a profile with a PIN needs a `jlp_<id>` cookie (a token derived from the PIN hash, set by
  `POST /api/profiles/select` with the right PIN); otherwise learner APIs answer 401 `{needPin:true}`.
- Engine settings are module-global (`E.configure`); the Worker re-applies the request's learner settings after every
  await so concurrent requests for two kids in one isolate cannot mix names/ages, and responses fill `{name}` from a
  per-request value.

### Placement quest (decided in planning)
- A placement pack is a quest pack with `"placement": true`. Each stage carries `"ladder"` (a short key such as `math`,
  `science`, `english`) and `"band"` (the topic's level, Marble `ageRangeStart`). Within a ladder, stages run from the
  grade-level band down to fallbacks.
- A stage is **passed** when ≥ 2/3 of its graded questions are right on the first try. Passing skips the rest of that
  ladder (the lower fallbacks are marked skipped, not answered); a miss serves the next lower stage. Mastery and
  inference use the normal engine rules, so a pass at band B gives the adaptive start point.
- On completion the engine records `S.placementQuest = {date, ladders:{key:{level, passed, topicId}}, beyondMap:[…]}`.
  `beyondMap` lists subjects where the learner passed the top stage and that stage sits at the taxonomy's ceiling for
  the subject: Jane should stretch with the highest topics there and flag the gap (see "Taxonomy ceiling").
- Validator rules for placement packs: 4-7 stages, ≥ 3 subjects, each stage 2-4 graded questions, no learn card or
  guided practice required (it is a diagnostic), no boss finale required, bands non-increasing within a ladder.
- The engine's built-in diagnostic placement uses a window around the learner's age (it was fixed at ages 9-11, the
  same window for an age-10.5 learner), clamped to the subject's taxonomy ceiling.

### Taxonomy ceiling (found in planning)
Marble topics start at ages 4-13 (`ageRangeEnd` ≤ 15). Topics starting at age 12+: Mathematics 36 (algebra, linear
graphs, simultaneous equations, Pythagoras, trigonometry basics, scatter graphs, similarity, volume, powers of ten,
probability), Science 77, Personal & Social Development 10, History 4, English 2; Computing, Life Skills, Learning to
Learn top out at age 10, Geography at 11. So the taxonomy serves a grade 7-8 learner in math and science (thin at the
top), only partly in English, and not above upper elementary in Computing / Life Skills / Learning to Learn. The
placement mechanism handles a learner above the ceiling with `beyondMap`; content beyond the map is a gap to raise with
the Marble team, not something this plan builds.

## Open questions (defaults used, so nothing stalls)
1. Parent-view writes (create profile, PIN reset) have no auth, like today's read-only `/parent`. Default: optional
   `PARENT_PIN` secret; when set, parent writes need it. Unset on this deployment until Kent decides.
2. Wrong-PIN rate limiting. Default: none (kid-level guard); a 1 s delay per wrong attempt.
3. Should the primary learner move to `L:<id>:` keys later for symmetry? Default: no; legacy keys are the primary's keys.
4. Avatars. Default: a fixed emoji set; the parent can change it; neutral default ⭐.
5. Can a sibling see the other's Map/trail? Default: no (deferred: shared family trail).
6. Picker on the parent view? Default: the parent view has its own switcher (`?learner=`), independent of the kid cookie.

## Slices

### Slice 1: Every learner has their own record (data model + migration) (#82)
- Ships: the Worker and storage resolve a learner per request; all per-learner keys are prefixed for non-primary
  learners; `profiles` registry; `migrate-profiles.mjs` (backup → add registry → verify; `--rollback`); `/api/state`
  gains `profile`. The existing learner's state is unchanged.
- Touches: `src/profiles.js` (new), `src/worker.js`, `lib-cli.mjs`, `migrate-profiles.mjs`, `test/profiles.test.mjs`
- Done test: `node --test test/profiles.test.mjs && npm test`; on live: pre/post `/api/state` comparison (sandbox copy) and
  KV sha of `progress` unchanged by the migration.
- Owner: self

#### Execute (Slice 1)
- Add `src/profiles.js` (registry normalise/synthesise, ids, key prefixes, PIN hash/token, selection) per "Data model".
- Worker: resolve learner, prefix every per-learner key, re-apply learner settings after awaits, `profile` in `pub()`.
- `migrate-profiles.mjs`: full KV snapshot to `backups/<date>/pre-profiles-<time>/` with sha manifest; write registry
  (idempotent); `--verify` compares state before/after; `--rollback` deletes `profiles`.
- Tests: two learners isolated (progress, logs, lessons, wallet); legacy keys untouched; migration idempotent; rollback.
- Done test: `node --test test/profiles.test.mjs && npm test`
- Decisions frozen: design sections and resolved open questions apply as written.

### Slice 2: Kids pick who's playing (picker + PIN + remembered device) (#83)
- Ships: "Who's playing?" picker with avatars, optional PIN pad, remembered device, "Switch player" link.
- Touches: `public/picker.js` (new), `public/index.html`, `public/app.js` (gate first load), `public/app.css`,
  `src/worker.js` (`/api/profiles`, `/api/profiles/select`, `/api/profiles/forget`), tests
- Done test: `node --test test/profiles.test.mjs && npm test`; headless screenshot of the picker against a LOCAL server
  with a test profile.
- Owner: self

#### Execute (Slice 2)
- Profile endpoints per "Data model" (select sets `jl` + `jlp_<id>`; wrong PIN 403; PIN-locked learner 401 needPin).
- `picker.js`: fetch `/api/profiles`; show picker when 2+ and none remembered; PIN pad for PIN profiles; then load app.
- Done test: `node --test test/profiles.test.mjs && npm test`
- Decisions frozen: design sections and resolved open questions apply as written.

### Slice 3: The parent sees each kid and adds a learner (#84)
- Ships: parent view switcher with each kid's stats (points, medals, mastered, streak, last played); add-a-learner form
  (name, grade, interests, avatar); set/clear PIN; change avatar.
- Touches: `src/worker.js` (`/api/parent/profiles*`, `/parent?learner=`), `src/parent.js`, `public/parent.js`,
  `public/parent.css`, tests
- Done test: `node --test test/profiles.test.mjs && npm test`
- Owner: self

#### Execute (Slice 3)
- Parent endpoints (optional `PARENT_PIN`); create = unique slug id, prefix `L:<id>:`; update avatar/PIN/interests.
- Parent view: `profiles` block with stats per kid + switcher links; forms post to the endpoints.
- Done test: `node --test test/profiles.test.mjs && npm test`
- Decisions frozen: design sections and resolved open questions apply as written.

### Slice 4: Jane plans each kid's night (per-learner export/publish + docs) (#85)
- Ships: `--learner <id>` on export/publish/backup (default primary); export carries `learner` (id, grade, age,
  interests) and `learners` list; docs loop over learners.
- Touches: `lib-cli.mjs`, `export-progress.mjs`, `publish-lessons.mjs`, `backup-progress.mjs`, `LESSONS.md`,
  `NIGHTLY.md`, `docs/NIGHTLY.md`, tests
- Done test: `node --test test/profiles.test.mjs && npm test`
- Owner: self

#### Execute (Slice 4)
- `lib-cli`: resolve learner (arg/env/registry/primary), `lk(key)` prefixing, `learnerConfig()` per learner.
- Scripts use `lk()` for every per-learner key; export adds `learner` + `learners`.
- Docs: nightly loop over `learners`, one quest per kid at their own level; privacy note.
- Done test: `node --test test/profiles.test.mjs && npm test`
- Decisions frozen: design sections and resolved open questions apply as written.

### Slice 5: A new learner starts at their level (placement quest) (#86)
- Ships: engine + validator support for `"placement": true` packs (ladders, bands, skip-on-pass, `placementQuest`
  result, `beyondMap`); age-relative built-in diagnostic; LESSONS.md "Placement quests" authoring rules.
- Touches: `src/engine.js`, `publish-lessons.mjs`, `export-progress.mjs`, `LESSONS.md`, `packs/examples/`, tests
- Done test: `node --test test/placement.test.mjs && npm test`
- Owner: self

#### Execute (Slice 5)
- Engine per "Placement quest"; validator rules; example placement pack in `packs/examples/` (generic, no child data).
- Export: `placementQuest` + `taxonomyCeiling` per subject.
- Done test: `node --test test/placement.test.mjs && npm test`
- Decisions frozen: design sections and resolved open questions apply as written.

## Progress
(one entry per slice: what shipped, done test + outcome, deferred/discovered)

### Slice 1 — done
- Shipped: `src/profiles.js` (registry, selection, PIN hash/token helpers), Worker resolves the learner per request
  (`?learner=` / `jl` cookie / only / primary) and prefixes every per-learner key via `LK`/`K`; `cfg()` re-applies learner
  settings after each await; `profile` on `/api/state`; `migrate-profiles.mjs` (snapshot + registry, `--rollback`,
  `--restore <dir> <key>`); `kvList('')` lists all keys.
- Done test: `node --test test/profiles.test.mjs` (7 pass) && `npm test` (all pass). Local before/after with a copy of the
  live snapshot: `/api/state`, `/api/trophies`, `/api/quests`, `/api/market`, `/api/map` and the parent head are identical
  between old `main` and this branch after the migration (only `profile` added).
- Discovered: the engine's built-in diagnostic placement window is fixed at ages 9-11 (handled in Slice 5).
- Live (PR #89, deployed version 59883f8a): `./deploy.sh` backup `backups/2026-10-23/progress-174510.json` (sha256 ae4b2642…);
  `node migrate-profiles.mjs` snapshot `backups/2026-10-23/pre-profiles-174531/` (19 keys) + registry, progress sha
  unchanged. Live sandbox-copy `/api/state` before deploy vs after migration: identical except `profile`.
  Rollback: `node migrate-profiles.mjs --rollback` (deletes `profiles` only).

### Slice 2 — done
- Shipped: `/api/profiles`, `/api/profiles/select`, `/api/profiles/forget`; PIN gate (401 `needPin`) on kid APIs;
  `public/picker.js` (picker, PIN pad, Switch player) loaded before `app.js`, which waits for it.
- Decision: the picker also shows for a single learner who has a PIN and no PIN cookie (otherwise the app would 401).
- Done test: `node --test test/profiles.test.mjs` (10 pass) && `npm test`. Headless Chrome against a LOCAL dev server
  with test profiles: picker shown with 2 buttons, no `/api/state` before the pick, PIN pad, wrong PIN refused, right PIN
  loads the app as that profile, Switch player link present.

### Slice 3 — done
- Shipped: parent switcher cards with per-kid stats (`PR.kidStats`), `/parent?learner=`, "👪 Players" (add a learner,
  avatar/interests/PIN set + clear), `POST /api/parent/profiles` and `/update`, optional `PARENT_PIN`.
- Decisions: ids are the name slug (`-2`, `-3` when taken); 8 learners max; the primary learner's name/grade stay in
  `[vars]` (only avatar, interests and PIN are editable for it); HTML-ish characters stripped from names/interests.
- Done test: `node --test test/profiles.test.mjs` (12 pass) && `npm test`; parent view rendered headlessly against a LOCAL
  dev server with test profiles.
