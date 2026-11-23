# Andes & Peru: pre-Inca periods

Status: in progress (2026-11-23). Slice 1 done (issue #126). Slice 2 implementing.
Issue: https://github.com/kentlangley/Jane/issues/126

Kent (11-23, 12:01 PM PT): expand the time before the Incas, the pre-Inca periods, as Peruvian schools teach them, so every Jane student can have that too (public template, not only Landon).

## Audit (current main, f4f06ac, v0.9.0)

Jane `data/jane/` Andes & Peru topics (5), all `History` / `Andes & Peru`, centrality 0.01:

| Id | Name | Ages | Hard prereq | Notes |
|---|---|---|---|---|
| `jane_world_andes_geography` | Andes geography | 9-11 | (none) | Coast, highlands, Amazon. Ready starter. |
| `jane_world_andes_early_cultures` | Early Andes cultures | 9-11 | geography | One survey of Caral, Chavin, Moche, and Nazca. |
| `jane_world_inca` | The Inca | 9-12 | early cultures | Tawantinsuyu, roads, quipu. |
| `jane_world_peru_spanish_conquest` | Spanish conquest in the Andes | 10-12 | the Inca | 1532, disease and civil war. |
| `jane_world_peru_republic` | Independent Peru and its people | 10-12 | conquest | 1821-1824, languages, migration. |

Pre-Inca coverage today is only that one survey topic. It names Caral, Chavin, Moche, and Nazca, and says the Andes story does not start with the Inca. It does not teach the Lithic or Archaic periods (Lauricocha, Guitarrero, early farming), does not treat Caral as its own city-origin chapter, skips Paracas and Julio C. Tello, skips Lima / Recuay / Vicus except as unnamed, and has no Middle Horizon (Wari, Tiwanaku / Tiahuanaco) or Late Intermediate kingdoms (Chimu / Chan Chan, Lambayeque / Sican, Chincha, Chachapoyas / Kuelap, Chanka).

Marble `data/marble/topics.json` (1,930 topics): no Inca, Andes, Peru, or pre-Inca history topics. The only South America hits are Science / Rainforests (Where Rainforests Are, The Amazon Rainforest). `data/marble/` stays untouched.

Landon's 2026-11-23 export: Andes & Peru is unseen (0 answered, 0 mastered). Geography is a ready starter on the frontier. Inserting a hard prereq chain will not lock a topic he has already started. Christopher has no record of these topics either (path shipped 11-21; he has been idle).

## Design

Periodization follows what Peruvian schools commonly teach (Lumbreras stages: Litico, Arcaico, Formativo, Desarrollos Regionales, Wari, Estados Regionales, Tawantinsuyu), with Rowe horizon names used lightly where they help (Early Horizon, Middle Horizon, Late Intermediate). Dates checked against UNESCO (Caral, Chan Chan), Met Heilbrunn, PLOS One (Lauricocha), Science (Guitarrero, Caral), and standard museum chronologies. Kid wording uses approximate ranges, not false precision.

Keep existing topic ids. Enrich `jane_world_andes_early_cultures` into the Formative + regional-development chapter (add Paracas, Tello, and a brief nod to Lima, Recuay, and Vicus) without dropping Caral / Chavin / Moche / Nazca from its evidence or kid prompt. Add four new topics and retarget the hard chain so the Inca are not treated as the start.

New and changed path (9 topics total):

1. `jane_world_andes_geography` (keep) 9-11. No prereq.
2. `jane_world_andes_first_peoples` (new) 9-11. Lithic and Archaic: hunters and early farmers, Lauricocha, Guitarrero Cave. Hard: geography.
3. `jane_world_andes_caral` (new) 9-11. Caral-Supe / first cities, about 3000-1800 BCE, desert coast. Hard: first peoples.
4. `jane_world_andes_early_cultures` (keep id, enrich) 9-11. Chavin, Paracas, Moche, Nazca; Tello; Formative and regional development. Hard: Caral (was geography).
5. `jane_world_andes_wari_tiwanaku` (new) 9-12. Middle Horizon: Wari (Ayacucho, roads and administration) and Tiwanaku at Lake Titicaca. Hard: early cultures.
6. `jane_world_andes_regional_kingdoms` (new) 9-12. Late Intermediate: Chimu / Chan Chan, Lambayeque / Sican, Chincha, Chachapoyas / Kuelap, Chanka. Hard: Wari and Tiwanaku.
7. `jane_world_inca` (keep, one linking sentence) 9-12. Hard: regional kingdoms (was early cultures).
8. `jane_world_peru_spanish_conquest` (keep).
9. `jane_world_peru_republic` (keep).

Standards: same `cde-hss:` practice as the existing Andes topics, only where the official 7.7 text reasonably covers the idea; otherwise empty. Topic text stays general (no family wording, no children's names). Ids start with `jane_`. Medals, mastery, and points are unchanged. `data/marble/` is unchanged.

### Slice 1: Issue and plan
- Ships: this plan, plus a GitHub issue describing the audit and design
- Touches: `plans/andes-pre-inca-path.md`, GitHub issue
- Done test: issue URL exists; plan file lists the topic chain
- Owner: self

### Slice 2: Topics, prompts, docs, and tests
- Ships: four new topics, enriched early cultures, new hard chain, kid prompts, README / LESSONS / NIGHTLY / CHANGELOG, tests, version 0.9.1
- Touches: `data/jane/topics.json`, `data/jane/dependencies.json`, `data/jane/README.md`, `data/kid-prompts/b12.txt`, `test/jane-topics.test.mjs`, `LESSONS.md`, `docs/NIGHTLY.md`, `README.md`, `CHANGELOG.md`, `package.json`, `src/version.js`
- Done test: `npm test` and `node build.mjs` pass
- Owner: self

### Slice 3: PR, merge, backup, and deploy
- Ships: PR merged to main, progress backed up, live app on the new topics, `/healthz` at 0.9.1
- Touches: GitHub PR, `backups/`, Cloudflare Worker
- Done test: PR merged; `npm test` still green on the merge commit; backups written for Landon and Christopher; `/healthz` reports 0.9.1
- Owner: self

## Nightly sequencing (two-night bursts, matching geography)

Follow the History rotation cap of 2, then switch, then return:

1. Andes geography, then First peoples of the Andes. Geography stage: three zones, high caves and the coast.
2. Caral and the first cities, then Early Andes cultures. Geography stage: desert coast and the Supe Valley, then Chavin in the highlands, the south-coast desert, and north-coast valleys.
3. Wari and Tiwanaku, then Kingdoms before the Inca. Geography stage: Ayacucho highlands and Lake Titicaca, then Chan Chan on the desert coast and Kuelap in the cloud forest toward the Amazon.
4. The Inca, then Spanish conquest. Geography stage: Cusco and the Andean roads.
5. Later: Independent Peru and its people.

## Frozen decisions

- Keep all existing Andes topic ids.
- Do not split early cultures into two topics; enrich it instead.
- Hard chain through the new topics into the Inca (safe: path is unseen for current learners).
- Public template only; no household wording in git.
- Version bump to 0.9.1 when this ships, so `/healthz` matches the live curriculum.

## Progress

### Slice 1
Done. Issue: https://github.com/kentlangley/Jane/issues/126. Plan saved here.

### Slice 2
Done. Four new topics, enriched early cultures, hard chain into the Inca, kid prompts, docs, tests, and version 0.9.1.
Done test: `npm test` (285 passed, 1 skipped) and `node build.mjs` (jane 34 topics) passed on 2026-11-23.

### Slice 3
In progress: PR, merge, backup, deploy.
