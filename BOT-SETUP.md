# Bot setup guide

**For an AI assistant bot** (for example Grok Bot: a desktop assistant with its own Linux machine, a shell,
scheduled routines and memory) that a parent pointed at this repo. Follow it to host Jane for their child and write a
fresh quest every night. People: see [README](README.md) and [INSTALL.md](INSTALL.md).

## What you are setting up
Jane is an adaptive learning web app for grade-school kids (grades 3-6, ages about 8-12), built on the open
[Marble Skill Taxonomy](https://github.com/withmarbleapp/os-taxonomy) (1,590 topics). The app runs placement, spaced
review, review gates and medals by itself. **Your job:** host it, and each night act as the lesson author: read the
day's progress export and write (or refresh) one quest, offline.

**The design rule: never add runtime AI.** Don't add a chatbot, model calls, or text generated while the kid plays,
and never wire a model into the app. Everything you write is content, written at night, validated by
`publish-lessons.mjs`, and readable by the parent. See [README → Philosophy](README.md#philosophy).

## 1. Ask the parent (one question at a time)
1. **The child's first name or nickname.** It is shown in the app (`LEARNER_NAME`). A nickname is fine.
2. **Age.** Sets `LEARNER_AGE`, the target for placement and topic choice.
3. **Grade.** A label like `4th grade` (`LEARNER_GRADE`).
4. **Hosting:**
   - **A/B. On your own machine:** standalone Node (`npm start`) or Docker (`docker compose up -d`). No accounts, data
     stays on your machine. Prefer Docker if it is available (restarts on boot, isolated).
   - **C. Cloudflare Workers + KV** with the parent's Cloudflare account (free plan is fine). Reachable from anywhere.
     Needs the parent to create an API token for you.
5. **How the kid will reach it** (A/B only): your machine is usually not on the family's network, so you need a
   private tunnel or VPN the parent is comfortable with. **The parent page (`/parent`) has no passcode yet**, so don't
   expose the app on the open internet without access control. With C, the `workers.dev` URL is public: tell the
   parent that, as above.
6. **The parent's time zone**, for the nightly routine. (The app's day boundaries are always Pacific Time.)

Keep the answers in your memory, not in the repo.

## 2. Install and first run
Clone `https://github.com/kentlangley/Jane.git`, then follow the matching section of [INSTALL.md](INSTALL.md). Needs
Node 22+. In short:

**A. Standalone Node** ([INSTALL → A](INSTALL.md#a-standalone-node-server))
```bash
npm install
LEARNER_NAME=<name> LEARNER_AGE=<age> LEARNER_GRADE="<grade>" DATA_DIR=<data dir> npm start
```
Keep it running as a long-lived background service (it serves `http://127.0.0.1:8787`; `PORT` and `HOST` change that).
Use the **same `DATA_DIR` and `LEARNER_*` values** for every script, and add `--local` to each.

**B. Docker** ([INSTALL → B](INSTALL.md#b-docker))
Set `LEARNER_NAME` / `LEARNER_AGE` / `LEARNER_GRADE` in `docker-compose.yml` (and `TZ`), then `docker compose up -d`.
Run scripts inside the container (`docker compose exec jane node …`); packs go in on stdin, exports come out with
`cat`, exactly as INSTALL shows. Copy exports into the gitignored `exports/` folder, never the repo root.
Don't commit your edited `docker-compose.yml` with the child's name.

**C. Cloudflare Workers + KV** ([INSTALL → C](INSTALL.md#c-cloudflare-workers--kv))
1. `npm install && npm run build`.
2. Ask the parent for an API token (*Edit Cloudflare Workers* template plus *Workers KV Storage: Edit*). Keep it as
   `CLOUDFLARE_API_TOKEN` in your secret store or environment, never in a file inside the repo.
3. `npx wrangler kv namespace create JANE_KV`, then `cp wrangler.toml.example wrangler.toml` and fill in
   `account_id`, the KV `id` (keep `binding = "JANE_KV"`) and the `[vars]` learner settings.
4. `./deploy.sh --dry-run --outdir /tmp/jane-dist`, then `./deploy.sh` (it backs up live progress first).

**Check it:** `npm test` (Node), `GET /healthz` returns `{"ok":true}` (A/B), and the kid app (`/`) and parent report
(`/parent`) load. Then send the parent the kid's URL and the parent URL.

## 3. Placement and the first quest
On the first visit the app runs placement by itself: short diagnostic questions across the subjects, walking the
prerequisite graph around `LEARNER_AGE`. Ask the parent to have the kid play a first session (10-15 minutes). The
first nightly run then writes the first quest from real answers. If the parent wants a quest ready on day one, write
it from a fresh export's `frontier` and `coverage.untouched` starters, following the rules below.
To try things without touching the real record, use the sandbox (`/api/sandbox?on=1`, see
[LESSONS.md → Testing](LESSONS.md#testing-without-touching-the-learners-progress)).
[`migrate-medals.mjs`](migrate-medals.mjs) is a one-time tool for old records; a new install doesn't need it.

## 4. The nightly routine (about 1:00 AM, parent's local time)
Create one scheduled routine in your own scheduler. The full cycle is in [docs/NIGHTLY.md](docs/NIGHTLY.md); each night:

1. **Back up:** `node backup-progress.mjs` (prints a sha256 of the progress record; note it).
2. **Export:** `node export-progress.mjs` → `exports/progress-<date>.json` (A/B: `--local` or inside the container,
   files under `DATA_DIR/exports/`). `--date YYYY-MM-DD` exports a given PT day; `weakSpots` covers the last 7 days.
3. **Review how the kid did:** `todayLog`, `weakSpots` (`goDeeper`, `needsSupport`, `strengths`), `termsLookedUp`,
   `coverage`, `reviewHealth.note`.
4. **Read `quests.nextStep`:**
   - `REFRESH: …` (a quest is in progress): copy `quests.current.packFile` to `packs/quest-<quest date>.json`, keep
     `date`, `quest` and the reached stages byte-for-byte, rewrite only the stages after them (boss last), then
     `node publish-lessons.mjs packs/quest-<quest date>.json --refresh --date <quest date> --dry-run`, and again
     without `--dry-run`. Details: [LESSONS.md → Refreshing](LESSONS.md#refreshing-the-current-quest).
   - `NEW QUEST: …`: write `packs/<date>.json` per [LESSONS.md](LESSONS.md), starting from
     [`packs/examples/example-quest.json`](packs/examples/example-quest.json). Date it for the PT day the kid will play
     it. `node publish-lessons.mjs packs/<date>.json --dry-run`, fix every error and warning, then publish without
     `--dry-run`.
5. **Verify progress is unchanged:** run the backup again and compare the sha256 with step 1. Publishing only writes
   `lessons:<date>`; a mismatch means the kid played meanwhile or something wrote the record: look before going on.
6. **Report** only if needed (section 7).

Exit codes to respect (never work around them): **1** invalid pack, **3** a quest is in progress (refresh instead),
**4** the quest is finished and locked, **6** a refresh changed a reached stage. Never use `--force` to get past 3 or 4.

## 5. Teaching rules (enforced or checked by `publish-lessons.mjs`; full text in [LESSONS.md](LESSONS.md))
- **Teach → guided practice → graded → boss.** New or shaky skills start with a `learn` card (idea + worked example),
  then 1-2 `guided` questions with `steps`, then graded ones.
- **The boss only tests skills taught in that quest** (`teaches`) or already mastered: at least 3 graded questions, a
  `powerup` recap, no answers past thousandths.
- **Stuck help is built in:** "I'm stuck 🤔" gives a hint → a worked example → a free skip. Give hard questions their
  own `hint`, `example` and `steps`. `needsSupport` topics get a gentle deep dive a level down and no boss tomorrow.
- **Size:** about 8 minutes, at most **16 graded** questions over **4-6 stages** (7 max), boss last. The app adds up
  to 4 review items through the gates.
- **Spaced review runs through the review gates.** Don't write review stages; watch `reviewHealth`.
- **Medals are earned:** 3 first-try right graded answers. Never design packs to hand them out.
- **Answer format:** if a prompt asks for a percent, decimal or fraction, write the answer in that form (`form`).
- **One active quest.** Never publish a new quest while one is in progress; refresh it.
- **Finished quests are locked.** New material goes in the next quest.
- **Rotate coverage:** each quest visits one new area from `coverage.untouched`, math and science first.
- **Voice:** talk to the kid as "you", ≤ 15 words per prompt, grade-level words, `{name}` instead of the real name.

## 6. Privacy and safety
- **Never commit** the child's data to any repo: progress, answer logs, exports, backups, real packs (`packs/*.json`),
  `local-data/`, screenshots. The `.gitignore` covers these; don't override it.
- **Never commit secrets or IDs:** `CLOUDFLARE_API_TOKEN`, `.env`, `wrangler.toml`, the Cloudflare account ID, KV
  namespace IDs or the `workers.dev` subdomain. Don't put the child's name in committed files (use `{name}`).
- **Back up before every deploy and every live write** (`./deploy.sh` does it for you; otherwise `backup-progress.mjs`).
  Keep backups outside git.
- If you contribute changes back to this repo, follow [CONTRIBUTING.md](CONTRIBUTING.md) and scan your diff for
  secrets first.

## 7. Reporting to the parent
Brief, and only what matters ([NIGHTLY.md → When the routine messages the parent](docs/NIGHTLY.md#when-the-routine-messages-the-parent)).
- **Normal night:** say nothing, or one line if the parent asked for it ("New quest: *Captain Comet's Lost
  Treasure*"). The parent report (`/parent`) is the everyday view.
- **Reach out when:** a script fails or you can't make a pack valid; `reviewHealth.note` says `played but no reviews
  served`; the same quest is refreshed night after night with no progress; a struggle spot keeps coming back; or a
  real milestone.
- **Never** send the raw export, answer logs or other personal data in a message. Summarize.

---
This guide is project documentation under **CC BY-SA 4.0** (see [LICENSING.md](LICENSING.md)); the code is MIT.
