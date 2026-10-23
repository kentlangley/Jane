# Points Market — spend points on fun, choice and peeks

**Status:** planned (prep only, no code yet) — 2026-10-23.
**Tracking:** TBD (filled in after issues are opened)
**Idea credit:** Christopher (Kent's son), who proposed the Points Market items: hidden items, temporary fog push-back, skins, influencing the next question, buying out known reviews.
**Frozen (Kent):** points buy **fun, choice and peeks — never mastery, medals, or permanent fog clearing.**

## Problem
The learner earns points on almost every answer (+2 cards / honesty, +5 self-checks, per-correct points with speed bonus,
+15 bonus) and has a balance in the thousands, but points do nothing. Earning is a few hundred points per play day, so
the number keeps climbing and stops meaning anything. Kent's name for the fix is "the market place": a Market where
points buy things a 5th grader wants (skins, secrets, choices) without breaking the learning loop
(teach → guided practice → graded → boss, honest medals, spaced review gates, literal fog = direct mastery).

## What exists today (inspected 2026-10-23, `main` @ fff5ef1)
- **No Market / shop / wallet code anywhere** (`rg -i "market|shop|spend|wallet|purchase"` over `src/`, `public/`,
  export: no hits outside taxonomy content). This plan builds it new; nothing to merge with.
- **Points** are a single running total `S.points`, only ever incremented in `src/engine.js` (`submit0`, cards,
  self-checks, learning moments, bonus). Shown as the `⭐ N pts` chip (`public/app.js chips()`), parent view, and
  `export-progress.mjs stats.points`.
- **Streak** `S.streak` is an **answer streak** (correct in a row; `S.streak=0` on a wrong answer, engine.js ~L463). There
  is **no play-day streak** today.
- **"I'm stuck 🤔"** (`E.stuck`, `src/stuck.js`) is already free: hint → worked example → "Skip for now"; never costs a
  heart, point, streak or boss hit. **Skip** (`E.skip`) also keeps the streak.
- **Fog** (`E.fogState` / `E.claimFind`, `FOG_FINDS` table, `/api/fog/claim`, `S.fog.finds`): fog clear = direct mastery;
  finds are claimed once, idempotent, and `claimFind` throws if medals change. `S.fog.buffs.hintToken` is **granted by the
  Hint Token find but never consumed** anywhere.
- **Map** (`drawMap` in `public/app.js`) draws decorative `ship()`s, island landmarks and fog; bosses are emoji from
  `BOSSES` (`public/app.js`). These are the natural hooks for ship / boss / map-theme skins.
- **Server**: `src/worker.js` does one read-modify-write of `progress` per request (Cloudflare KV, or `server/` Node
  with file KV, one request at a time). Events go to `log:<PT date>`. Sandbox uses `sandbox:*` keys.
- **Nightly**: `export-progress.mjs` → `exports/progress-<date>.json`; author follows `LESSONS.md` + `docs/NIGHTLY.md`
  (root `NIGHTLY.md` is a short notes file). Export already carries `fog` and `campaign`.

## Design

### Core rule (frozen)
- **M0** Points buy **fun, choice and peeks**. Never mastery, medals (bronze/silver/gold/legendary/quest), boss hearts,
  quest-stage skipping, review-gate opening without answering, or permanent fog clearing. Every purchase handler asserts
  medals/mastery unchanged (same pattern as `claimFind`'s throw).

### Wallet + spend ledger
- **M1 Earned is history; never mutate it.** `S.points` stays the lifetime **earned** total and is never decremented.
- **M2 Ledger.** New `S.wallet = {spent, ledger:[{id, item, kind, price, at, meta}], owned:{...}, equipped:{...}}`.
  **balance = S.points − S.wallet.spent**, computed server-side only. A purchase is accepted only if `price ≤ balance`.
- **M3 Idempotent purchases.** Client sends a purchase id (`pid`, random per tap). Same `pid` again → returns the original
  result, no second charge. One-time items (skins, chests) are also idempotent by item id (`already: true`).
- **M4 Prices are server-side knobs** in one table (`MARKET` in `src/engine.js`, like `FOG_FINDS`). The client never sends
  a price. Ledger rows record the price paid, so retuning never rewrites history.
- **M5 API.** `/api/state` gains `wallet:{balance, earned, spent, owned, equipped, active}`; `GET /api/market` lists the
  catalog (visible items only, with price, owned/affordable flags); `POST /api/market/buy {pid,item,meta}`;
  `POST /api/market/equip {slot,item}` (free). Every buy logs a `purchase` event to `log:<date>`.
- **M6 Tuning.** Export adds `market:{balance, earned, spent, spent7d, earned7d, ledger(last 30), owned, equipped,
  active, choices}` so prices can be tuned by spend rate (`earned7d` from a tiny per-PT-day snapshot of `S.points`,
  `S.wallet.days`, capped at 60 entries).
- **M7 Sandbox + privacy.** Works under `sandbox:*` like everything else; public issues/PRs say "the learner", no name or
  live balances.

### Catalog (defaults; all prices are knobs)
- **Skins (main sink, 300–1,500).** Slots: **ship** (Map ships), **avatar** (learner badge on Play/HUD), **boss skin**
  (replaces the `BOSSES` emoji set / boss frame), **map theme** (sea/land palette + fog tint). Bought once, owned forever,
  equip/unequip free. Purely cosmetic (CSS/SVG/emoji); authored table, no generated art at runtime.
- **Hidden items / mystery chests.** Some catalog rows carry a `when` like `FOG_FINDS` (e.g. `{subject:'Science',pct:30}`)
  and only **appear in the Market after fog clears nearby**. Contents are cosmetic (a rare skin, sticker, title). Mystery
  chests roll from a fixed table, seeded by `pid` so a retry gives the same result.
- **Scout flare (~200).** Pick a fogged region (subject island / domain); for **24 h** the Map shows that region's fog thinned
  with topic names and "something's hidden here" markers for unclaimed finds. Fog returns at expiry. `fogState.mask`,
  clear counts and `claimFind` eligibility are **unchanged** — permanent clear still only via direct mastery.
- **Pick your path (~100).** Choose which of **2–3 ready topics** (prereqs met, from the frontier) the **next new quest** is
  built around, or pick a **theme flavor** (pirates / space / dungeon / jungle …) for the next quest's story. Choice, never
  skipping: the chosen topic still runs teach → practice → graded → boss. Stored in `S.wallet.choices`; the nightly
  author honors it on the next `NEW QUEST` (not on a refresh of locked stages), then marks it used via the export.
- **Prove-it ticket (~150).** Instead of buying out a review: on a **due** review topic, pay to answer **one harder
  question now** (check-understanding "why" tier or generator level +1). **Right first try** → that review is cleared
  exactly like a passed review (Leitner box +1, new due) **plus a bonus** (earned points, e.g. +20). **Wrong** → review stays
  due (same as a normal review miss: due ≤ now + 1 day), **no refund**. Spaced-repetition integrity preserved; never
  available for topics that aren't due.
- **Cheap extras (25–100).**
  - **Hint token** — wire up the existing unconsumed `S.fog.buffs.hintToken` and let the Market sell more. Because
    "I'm stuck" hints are already free, the token must give *something extra* (default: a "Jane whisper" naming the top
    misconception for this question). Ungraded; see open questions.
  - **Streak shield** — Kent's "I'm stuck that doesn't break streak" already exists for free (stuck/skip never break the
    🔥 streak). The paid version that *adds* something: one wrong answer doesn't reset the 🔥 answer streak. Streak is a
    cosmetic counter (stars-per-3 aside), so this touches no hearts, mastery or boss HP. See open questions.
  - **Streak freeze (travel days)** — needs a **play-day streak**, which doesn't exist yet. Slice 6 adds a "days played"
    counter; a freeze covers one missed PT day. See open questions.

## Out of scope
- Real money, trading, or anything leaving the device/household.
- Buying medals, mastery, boss hearts, gate opening, quest-stage skips, or permanent fog clear (M0).
- Live AI at play time; skins/chests are authored tables.
- Changing how points are earned (only how they're spent).

## Open questions (Kent)
1. **Day-one balance:** does the whole pre-Market earned total become spendable on launch (default: yes, he earned it), or
   start at a smaller "opening grant"?
2. **HUD chip:** show **balance** (spendable) or **earned** (lifetime)? Default: chip shows balance, parent view shows both.
3. **Hint token** value-add, given hints are already free: "Jane whisper" (misconception hint) as default; alternative is
   dropping it from the Market and only keeping the find.
4. **"I'm stuck" that doesn't break streak** is already free. OK to ship the paid **streak shield** (wrong answer keeps 🔥)
   instead? Does the shield also protect the stars-every-3 bonus (default: no; stars keep counting from the current streak)?
5. **Streak freeze** requires a new play-day streak. Add it (default: yes, in slice 6), or drop freeze?
6. **Prove-it bonus** size (default +20 earned points) and cap (default: max 2 prove-it tickets per PT day so it can't
   replace the gates).
7. **Prices / sinks**: opening prices above; tune after ~1 week by `market.spent7d / earned7d` (target roughly 50–70% of
   earned points spent).
8. **Pick your path** scope: topic choice only from the 2–3 the app offers (default), and does the nightly author have to
   honor it (default: yes, unless no valid quest fits; then say so in tomorrow's hook)?

## Slices

### Slice 1: The learner has a wallet he can spend from
- Ships: server-side wallet — balance = earned − spent, idempotent `POST /api/market/buy`, `GET /api/market`, `wallet` on
  `/api/state`, `purchase` log events, `market` block in the export. A placeholder catalog row (`test-sticker`) so it can be
  exercised; no learner-facing UI yet.
- Touches: `src/engine.js` (`MARKET`, `walletState`, `buy`), `src/worker.js` (routes, pub), `export-progress.mjs`,
  `test/market.test.mjs`
- Done test: `node --test test/market.test.mjs && npm test` — covers: balance = earned − spent; insufficient balance
  refused; same `pid` twice charges once; one-time item twice → `already`; `S.points` never decreases; medals/mastery
  unchanged after any buy; export contains `market`.
- Owner: self

#### Execute (Slice 1)
- Add `MARKET` table + `walletState(S)` + `buy(S,g,{pid,item,meta},now)` per M1–M5; guard with medals/mastery-unchanged throw (M0).
- Worker: `GET /api/market`, `POST /api/market/buy`, `wallet` in `pub()`; log `purchase` events; per-day `S.wallet.days` snapshot (M6).
- Export: `market` block (M6).
- Done test: `node --test test/market.test.mjs && npm test`
- Decisions frozen: M0–M7 apply as written.

### Slice 2: The learner can buy and wear skins
- Ships: a **Market** screen (tab/button from Play) showing balance and the skin catalog (ship, avatar, boss skin, map theme);
  buy with a confirm step; equip/unequip; equipped skins render on the Map ships, avatar badge, boss emoji/frame, Map palette.
  HUD chip shows balance (per open question 2 answer).
- Touches: `src/engine.js` (skin rows, `equip`), `src/worker.js` (`/api/market/equip`), `public/index.html`, `public/app.js`,
  `public/app.css`, `test/market.test.mjs`
- Done test: `node --test test/market.test.mjs && npm test`; live sandbox check: `/api/sandbox?on=1`, reset, open Market, buy a
  ship skin, equip it, Map shows the new ship; real progress untouched (sandbox keys only).
- Owner: self

#### Execute (Slice 2)
- Add skin rows (4 slots, 300–1,500) to `MARKET`; `equip(S,slot,item)` free, owned-only.
- Market UI: balance, cards, buy→confirm→owned, equip; reduced-motion safe; keyboard/focus like the campaign overlay.
- Apply equipped skins in `drawMap` (ships, theme), boss render (`BOSSES`), avatar badge.
- Done test: as above.
- Decisions frozen: Design "Skins", M3, M4.

### Slice 3: The learner can fire a scout flare into the fog
- Ships: buy a **scout flare** (~200), pick a fogged region on the Map, see it thinned for 24 h with topic names and
  "hidden here" markers; fog returns after expiry. Clear counts, mask and find eligibility unchanged.
- Touches: `src/engine.js` (`fogState` adds `flares`, flare item), `src/worker.js`, `public/app.js` (`drawMap` flare layer),
  `public/app.css`, `test/market.test.mjs`
- Done test: `node --test test/market.test.mjs && npm test` — flare active < 24 h, gone after (clock offset); `fog.mask`,
  `clear`, `available` identical with/without flare; `claimFind` still refuses uncleared finds. Live sandbox: fire a flare,
  Map shows lit region; `POST /api/sandbox/reset {"offsetDays":2}` → fog back.
- Owner: self

#### Execute (Slice 3)
- Flare = consumable purchase with `meta.region`; store `{region, until: now+24h}` in `S.wallet.active.flares`.
- `fogState` returns `flares` (active only); never touches mask/counts.
- Map: thinned-fog layer + labels for flared region.
- Done test: as above.
- Decisions frozen: Design "Scout flare", M0.

### Slice 4: The learner can prove it on a due review
- Ships: on a **due** review topic, buy a **prove-it ticket** (~150) → one harder question now. Right first try = review
  passed (box +1, new due) + bonus earned points; wrong = review stays due, no refund. Offered from the Market and on the
  review gate card.
- Touches: `src/engine.js` (`proveIt` item builder, `submit0` handling for `it.proveIt`), `src/worker.js`
  (`POST /api/market/prove`), `public/app.js`, `public/app.css`, `test/market.test.mjs` (or `test/prove-it.test.mjs`)
- Done test: `node --test test/market.test.mjs && npm test` — not-due topic refused; right → box+1 & due moves & bonus;
  wrong → due ≤ now+1 day, spent stays spent; daily cap; no medal/mastery-tier change beyond a normal review pass.
- Owner: self

#### Execute (Slice 4)
- Harder item: check-understanding "why" tier when present, else generator level +1; `mode:'review'`, `proveIt:true`, no gate.
- Reuse normal review-pass/miss code paths so Leitner math is identical; bonus credited to `S.points` (earned).
- Enforce daily cap (open question 6 default).
- Done test: as above.
- Decisions frozen: Design "Prove-it ticket", M0, gates unchanged.

### Slice 5: The learner picks his path (and the nightly author honors it)
- Ships: buy **pick your path** — choose 1 of 2–3 ready frontier topics for the next new quest, or a **theme flavor**;
  choice shows on Play ("Next quest: your pick!"); export carries `market.choices`; LESSONS.md + NIGHTLY.md tell the author
  to honor it on the next NEW QUEST and how it's marked used.
- Touches: `src/engine.js` (path offers from frontier, `choices`), `src/worker.js`, `public/app.js`, `export-progress.mjs`,
  `LESSONS.md`, `NIGHTLY.md`, `docs/NIGHTLY.md`, `test/market.test.mjs`
- Done test: `node --test test/market.test.mjs && npm test`; `node export-progress.mjs --local` shows `market.choices`
  with the pick; offers only include ready (prereqs met) topics; one open choice at a time; `npm run publish:dry` still passes.
- Owner: self

#### Execute (Slice 5)
- Offers: 2–3 ready frontier topics near target age (reuse export/engine frontier logic); theme list is a fixed table.
- `S.wallet.choices = {path:{topicId,at}, theme:{id,at}}`; marked used when a newer quest pack's date > choice time and
  pack declares `honors` (or the author notes it); keep it simple and documented.
- Docs: LESSONS.md "Market choices" section; NIGHTLY.md note.
- Done test: as above.
- Decisions frozen: Design "Pick your path", open question 8 answer.

### Slice 6: Hidden chests and cheap extras
- Ships: Market rows that **appear only after nearby fog clears** (mystery chests with cosmetic contents, deterministic by
  `pid`); **hint token** consumption (existing find + purchasable); **streak shield**; **play-day streak + streak freeze**
  (per open questions 3–5).
- Touches: `src/engine.js` (`when` on `MARKET` rows reusing `findEligible`, buffs consumption in `stuck`/`submit0`, day streak),
  `src/worker.js`, `public/app.js`, `public/app.css`, `export-progress.mjs`, `test/market.test.mjs`
- Done test: `node --test test/market.test.mjs && npm test` — hidden row absent until fog threshold, present after; chest
  same `pid` → same contents; hint token decrements once per use and never changes grading; shield keeps 🔥 on one miss but
  hearts/boss HP/mastery identical to an unshielded miss; freeze covers exactly one missed PT day.
- Owner: self

#### Execute (Slice 6)
- Hidden/chest rows: `when` like `FOG_FINDS`; filter in `GET /api/market`.
- Wire `S.fog.buffs.hintToken` (+ purchased tokens) into the stuck flow per open question 3.
- Streak shield + day streak + freeze per open questions 4–5 (skip any Kent drops).
- Done test: as above. After this slice passes, move this plan to `plans/archive/`.
- Decisions frozen: Design "Hidden items", "Cheap extras", M0.
