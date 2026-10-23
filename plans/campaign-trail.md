# Campaign Trail + Fog Map — always-on progress kids can see

**Status:** in progress — slices 1–3 done; slice 4 next.
**Tracking:** [#54](https://github.com/kentlangley/Jane/issues/54)
**Slices:** [#55](https://github.com/kentlangley/Jane/issues/55) API · [#56](https://github.com/kentlangley/Jane/issues/56) HUD · [#57](https://github.com/kentlangley/Jane/issues/57) Quest of Quests · [#58](https://github.com/kentlangley/Jane/issues/58) Fog Map · [#59](https://github.com/kentlangley/Jane/issues/59) Secrets · [#60](https://github.com/kentlangley/Jane/issues/60) Final Boss  
**Frozen:** quest medals advance the trail; legendary topic medals light the Final Boss (Kent).  
**New:** the Map uses **literal fog** that clears as skills are mastered; clearing can reveal secrets, treasures, and power-ups.

## Why
Kids who like Minecraft Dungeons want (1) a graphic campaign with bosses ahead and a Final Boss, and (2) a world that *looks* like it’s being cleared — fog lifts, secrets show up — not a tiny percent chip. Today Jane has Map islands and Quests, but nothing always-on that taunts completion, and fog isn’t a real progress fantasy.

## Kid-facing story (three layers)
1. **Tonight’s quest** — beat this adventure’s bosses (drives growth + quest medal → Campaign Trail).
2. **Campaign Trail** — quest-of-quests path to a **Final Boss** (Act One climax; not “the whole world done”).
3. **The Map** — his world under fog. Mastering skills **clears fog**. A clear world means *every stone is lit — he explored this place and left the lights on.* Bosses on the trail are special fights; fog-clear is exploration, not “all baddies dead.”

## Design

### Campaign Trail
- **D1 Always on Play.** Graphic trail strip on Play: past quest bosses lit, current boss glowing, future foggy, **Final Boss** at the end.
- **D2 Quest medals = trail.** Each quest medal fills the next node (order earned). Trail length **12** (tunable). Extras beyond 12 stay in history; trail reads full.
- **D3 Legendaries light the Final Boss.** Legendary = boss-fight win on a skill (≥3 first-try boss answers that day), **not** “section complete.” They brighten the Final Boss (need **4** for full light; tunable). Bronze/silver/gold stay depth-based topic medals.
- **D4 Unlock the finale.** Trail full **and** Final Boss fully lit → unlock reveal (persisted). No free medals. Nightly author may write a one-shot **Finale** quest; until then: “Jane is forging the finale…”
- **D5 Taunt copy.** Playful rivalry lines on the strip (“3 bosses till the Final Boss…”).
- **D6 Tap → Quest of Quests.** Full-screen campaign overlay from the strip (trail + legendary slots + history). One-quest-at-a-time unchanged.

### Fog Map (long game / true “world clear”)
- **D8 Literal fog.** Unmastered / unseen regions sit under fog on the Map. As the learner masters topics (direct mastery preferred for “clear”), fog **recedes** over that stone and nearby trail — visible progress, not a percent alone. `%` chip can stay as a quiet backup.
- **D9 Clear = lights on.** Child POV: clearing means he explored and lit the stones. Not “defeated every enemy.”
- **D10 Secrets in the fog.** Hidden under fog (and sometimes only after a patch clears): **chests** (cosmetic / celebration), **secret paths** (highlight a ready stretch topic), **power-ups** (next-quest flavored boosts the nightly pack or a short in-app buff — never skip mastery rules or invent medals). First find plays a small reveal.
- **D11 Power-up honesty.** Power-ups are fun garnish: e.g. one extra hint token, a fun-fact card, a story skin for the next quest — authored or table-driven, validated, no live AI. They must not bypass teach→practice→graded→boss or award unearned mastery/medals.
- **D12 Fog data.** Campaign/fog state derived from progress + a small `fog` / `finds` record on progress for claimed secrets (idempotent). Export surfaces finds for the nightly author (“he uncovered X — weave into tomorrow’s hook if you want”).

### Shared
- **D7 Privacy.** Public issues/PRs: “the learner,” no name/live %.

## Out of scope
- Changing one-quest-at-a-time, gate reviews, or how medals are earned.
- Auto-generating Finale packs in the Worker (agent/nightly).
- Replacing Trophy Case.
- Real loot that buys grades or skips hearts permanently.

## Slices

### Slice 1: Campaign + fog state API ✅
- Ships: `campaign` on `/api/state` (trail, legendaries→Final Boss light, taunt, unlock flags) **and** `fog` summary for the Map (per-topic / per-domain clear fraction, unclaimed finds available). No learner-facing UI yet.
- Touches: `src/engine.js`, `src/worker.js`, tests
- Done test: `node --test test/campaign.test.mjs` — **passed** 2026-10-22 (empty / N medals / >12 cap / legendary lit / unlocked only when both / fog direct-mastery counts)
- Owner: self

#### Execute (Slice 1) — done
- `campaignState(S,g)` + `fogState(S,g)` on `/api/state` pub payload.
- Done test: `node --test test/campaign.test.mjs` ✅
- Decisions frozen: D2–D4, D8–D9, D12, D7.

### Slice 2: Always-on Campaign Trail HUD ✅
- Ships: Play shows trail + taunt; updates on quest/legendary wins; reduced-motion safe.
- Touches: `public/index.html`, `public/app.js`, `public/app.css`
- Done test: sandbox / `#campaign-preview` shows strip without opening Map; `npm test` — **passed** 2026-10-22
- Owner: self

#### Execute (Slice 2) — done
- Render from `state.campaign` via `campaignHUD` on Play (`#campaign`); taunt + trail + Final Boss + legendary stars; `#campaign-preview` hash; reduced-motion kills node pulse.
- Done test: as above ✅
- Decisions frozen: D1, D5.

### Slice 3: Quest of Quests overlay ✅
- Ships: tap strip → full campaign map (trail, legendary slots, history); close back to Play.
- Touches: `public/app.js`, `public/app.css`, `src/engine.js` (history + legendary slots on campaign)
- Done test: open/close + focus; `/api/quest/start` still one-at-a-time — **passed** 2026-10-22
- Owner: self

#### Execute (Slice 3) — done
- Overlay only (`openCampaign` / `closeCampaign`); Escape + ✕ + Back restore focus to strip.
- `campaign.history` + `legendaries.slots` for the map; one-quest-at-a-time unchanged.
- Done test: as above ✅
- Decisions frozen: D6.

### Slice 4: Literal fog on the Map
- Ships: Map draws fog over unclear stones/domains; fog pulls back as mastery grows (sandbox-visible). Quiet `%` remains.
- Touches: `public/app.js` (`drawMap`), `public/app.css`, map API fields from slice 1
- Done test: sandbox Map shows fog on unknown areas and clear stones without fog; screenshot or deterministic SVG class checks in a small test if practical
- Owner: self

#### Execute (Slice 4)
- Fog layer from `state.fog` / map payload.
- Done test: as above.
- Decisions frozen: D8, D9.

### Slice 5: Secrets, treasures, power-ups
- Ships: clearing a fog patch can reveal a chest / secret / power-up; claim once; small reveal UI; finds stored on progress; export lists them for nightly flavor. Power-ups follow D11.
- Touches: `src/engine.js`, `src/worker.js`, `public/app.js`, `export-progress.mjs`, `LESSONS.md` (one short “Fog finds” note), tests
- Done test: unit tests for claim idempotency + no medal invention; sandbox can clear fog and see a chest once; export includes `fog.finds`
- Owner: self

#### Execute (Slice 5)
- Table of finds keyed by domain clear thresholds or topic ids; `claimFind`.
- Done test: as above.
- Decisions frozen: D10, D11, D12.

### Slice 6: Final Boss unlock + finale hook
- Ships: unlock when trail full + legendaries need met; one-time reveal; export flag; LESSONS.md / NIGHTLY.md Finale authoring note.
- Touches: engine, worker, export, docs, tests
- Done test: unlock persistence test; export `campaign.finalBoss.unlocked`; no fake medals
- Owner: self

#### Execute (Slice 6)
- Persist `campaign.finalBoss.revealedAt`.
- Done test: as above.
- Decisions frozen: D3, D4.

## Open questions
- Resolved: unlock currency = mix (Kent 2026-10-22).
- Resolved: Final Boss ≠ 100% Map clear; Map clear = lights on / fog gone (Kent POV 2026-10-22).
- Open: exact power-up list (hint token vs story skin vs fun-fact) — pick defaults in slice 5 unless Kent specifies earlier.
- Open: trail length 12 / legendary need 4 — knobs, confirm before slice 1 if desired.
