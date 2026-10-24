# Nightly authoring notes

See **LESSONS.md** for the full pack rules, nightly loop, and Fog finds honesty.

## Every learner, every night (profiles)

Loop over the export's `learners`: for each id run `export-progress.mjs --learner <id>`, write **one quest per kid at
their own level**, and publish with `publish-lessons.mjs ... --learner <id>`. No `--learner` = the primary learner (the
original commands). A learner without `placementQuest` in the export gets the placement quest first. Details: LESSONS.md
"Several learners (profiles)" and "Placement quests".

## Finale (Campaign Trail)

If export shows `campaign.finalBoss.unlocked: true` (trail full + legendaries lit) and there is no Finale pack yet, you **may** author a one-shot **Finale** quest for the climax. Until then, leave the learner on the normal one-quest-at-a-time lineup — the app already says Jane is forging the finale. Never award free medals or skip teach → practice → graded → boss to force the unlock.

## Market choices (Points Market)

If the export has `market.openChoices` (the learner spent points on **Pick Your Path** or **Pick a Story Theme**), build the next **NEW QUEST** around the pick and add `"honors": {"path": "<topicId>", "theme": "<themeId>"}` to the pack. `quests.nextStep` says exactly what was picked. If no valid quest fits, use `"declined"` (refunds the pick) with a `"note"` and say why in the hook. Never on a refresh of locked stages. Full rules: LESSONS.md "Market choices".
