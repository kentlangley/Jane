# Nightly authoring notes

See **LESSONS.md** for the full pack rules and nightly loop.

## Every learner, every night (profiles)

Loop over the export's `learners`: for each id run `export-progress.mjs --learner <id>`, write **one quest per kid at
their own level**, and publish with `publish-lessons.mjs ... --learner <id>`. No `--learner` = the primary learner (the
original commands). A learner without `placementQuest` in the export gets the placement quest first. Details: LESSONS.md
"Several learners (profiles)" and "Placement quests".

## Finale (Campaign Trail)

If export shows `campaign.finalBoss.unlocked: true` (trail full + legendaries lit) and there is no Finale pack yet, you **may** author a one-shot **Finale** quest for the climax. Until then, leave the learner on the normal one-quest-at-a-time lineup — the app already says Jane is forging the finale. Mark the Finale with `"finale": true` in its `quest` block and put the send-off (Jane's `message`, the grown-up's `parentMessage`) in `quest.graduation`, not in a fun-fact card; the trail then says "The Final Boss awaits!" and winning shows the graduation screen. The parent message stays in the gitignored pack only. Details: LESSONS.md "Finale quest". Never award free medals or skip teach → practice → graded → boss to force the unlock.

## Market choices (Points Market)

If the export has `market.openChoices` (the learner spent points on **Pick Your Path** or **Pick a Story Theme**), build the next **NEW QUEST** around the pick and add `"honors": {"path": "<topicId>", "theme": "<themeId>"}` to the pack. `quests.nextStep` says exactly what was picked. If no valid quest fits, use `"declined"` (refunds the pick) with a `"note"` and say why in the hook. Never on a refresh of locked stages. Full rules: LESSONS.md "Market choices".

## Feedback check-ins ("Help shape Jane")

The export's `feedback.new` holds the learner's check-in answers from the last `--days` days (all of them are in
`feedback.all`, newest first), and the console prints them under 💬. Read them before authoring: they say what was
fun, what felt too easy or too hard, and what the learner wants to learn next. Use them as direction for themes and
topics, never quote them back word for word in a pack, and pass anything notable to the grown-up in the nightly note.
`feedback.pending` only says whether the app will ask on the next open; the app handles the timing (first open, then
every 3 finished quests, "Not now" snoozes for the day). Answers live in the learner's `feedback` KV key, not in
progress, and never change medals, mastery or points.
