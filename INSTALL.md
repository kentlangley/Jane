# Installing Jane

There are three ways to run the full app:

| Option | Storage | Best for |
|---|---|---|
| **A. Node** (`npm start`) | JSON files in `DATA_DIR` | A home computer or small server; no accounts needed |
| **B. Docker** (`docker compose up -d`) | JSON files in a Docker volume | Same as A, isolated, restarts on boot |
| **C. Cloudflare Workers + KV** (`./deploy.sh`) | Workers KV | Free hosting reachable from anywhere |

All three run the same code (`src/worker.js` + `src/engine.js`). The nightly scripts work with all three
(add `--local`, or set `STORAGE=file`, for A and B).

> **Adapting it?** You can hand this repo to your own AI coding assistant (Grok, Claude Code or similar) to install it
> or to set up the nightly cycle. See [README → Adapt it to your setup](README.md#adapt-it-to-your-setup).

## A. Standalone Node server

Needs **Node.js 22+** (`node -v`). No Cloudflare account, no API keys.
```bash
git clone https://github.com/kentlangley/Jane.git jane && cd jane
npm install                 # pinned dev tools for the build (esbuild, UI libraries, wrangler)
LEARNER_NAME=Sam npm start  # builds, then serves http://localhost:8787  (parent report: /parent)
```

| Env var | Default | What it does |
|---|---|---|
| `LEARNER_NAME` | `Explorer` | First name or nickname shown in the app |
| `LEARNER_AGE` | `10` | Target age for placement and topic choice (designed for ~8-12) |
| `LEARNER_GRADE` | `upper elementary` | Label for the parent report and pack warnings |
| `HIDE_REGIONS` | (empty) | Build-time: leave region-specific topics out, e.g. `AU` ([BOT-SETUP → 1](BOT-SETUP.md#1-ask-the-parent-one-question-at-a-time)). Rebuild after changing; Docker: `--build-arg HIDE_REGIONS=AU` |
| `PORT` | `8787` | Port to listen on |
| `HOST` | `127.0.0.1` | Interface to listen on. Use `0.0.0.0` to reach it from a tablet on your home network (the parent page has no passcode yet) |
| `DATA_DIR` | `./local-data` | Where progress, answer logs and lesson packs are stored (one JSON file per key; gitignored) |

After the first `npm start`, `npm run serve` starts the server without rebuilding. `npm test` runs an end-to-end smoke
test against a temporary data folder. `GET /healthz` returns `{"ok":true}` for monitoring.

Nightly scripts and backups against the local files (use the same `DATA_DIR` and `LEARNER_*` as the server):
```bash
node export-progress.mjs --local                                # → DATA_DIR/exports/progress-<date>.json
node publish-lessons.mjs packs/<date>.json --dry-run --local    # validate
node publish-lessons.mjs packs/<date>.json --local              # publish → shows as a new quest
node backup-progress.mjs --local                                # → DATA_DIR/backups/<date>/progress-<time>.json
./reset.sh --local                                              # back up, then start fresh
```
To back up everything, copy the `DATA_DIR` folder. To restore, stop the server and copy it back.

## B. Docker

```bash
git clone https://github.com/kentlangley/Jane.git jane && cd jane
# edit LEARNER_NAME / LEARNER_AGE / LEARNER_GRADE in docker-compose.yml, then:
docker compose up -d        # → http://localhost:8787  (parent report: /parent)
```
Or without Compose:
```bash
docker build -t jane .
docker run -d --name jane --restart unless-stopped -p 127.0.0.1:8787:8787 -v jane-data:/data \
  -e LEARNER_NAME=Sam -e LEARNER_AGE=10 -e LEARNER_GRADE="5th grade" -e TZ=America/Los_Angeles jane
```
- Data lives in the `jane-data` volume (`/data` in the container). The container runs as the non-root `node` user,
  with a read-only filesystem except `/data`, and has a health check on `/healthz`.
- The port is bound to `127.0.0.1` by default. To use it from other devices on your home network, publish
  `8787:8787` instead (the parent page has no passcode yet).
- Nightly scripts run inside the container, where `STORAGE=file` is already set:
  ```bash
  # the pack is piped in on stdin (the container's filesystem is read-only)
  docker compose exec -T jane node publish-lessons.mjs /dev/stdin --dry-run < packs/2026-10-18.json
  docker compose exec -T jane node publish-lessons.mjs /dev/stdin < packs/2026-10-18.json
  docker compose exec jane node export-progress.mjs                # → /data/exports/ in the volume
  docker compose exec jane node backup-progress.mjs                # → /data/backups/ in the volume
  docker compose exec jane cat /data/exports/progress-2026-10-18.json > export.json   # copy an export out
  ```
- Back up the volume: `docker run --rm -v jane-data:/data -v "$PWD":/out alpine tar czf /out/jane-data.tgz -C /data .`
  (with Compose the volume is named `<project>_jane-data`, e.g. `jane_jane-data`).
- If you bind-mount a host folder instead of a volume, make it writable by uid 1000.

## C. Cloudflare Workers + KV

### Prerequisites
- **Node.js 22+** (`node -v`). Any install works. The scripts also pick up a portable Node at
  `~/.local/node-v22.20.0-linux-x64` if it exists (or wherever `NODE22_BIN` points).
- **A Cloudflare account** (the free plan is fine) with Workers and Workers KV.
- **wrangler** (the Cloudflare CLI). It's a dev dependency, so `npm install` installs the pinned version.

### 1. Clone and install
```bash
git clone https://github.com/kentlangley/Jane.git jane && cd jane
npm install
npm run build        # → public/tax.json, public/glossary.json, src/gen.js
```

### 2. Authenticate wrangler
Interactive: `npx wrangler login`. Headless or CI: create an API token in the Cloudflare dashboard
(*My Profile → API Tokens*, template **Edit Cloudflare Workers**, plus **Workers KV Storage: Edit**) and export it:
```bash
export CLOUDFLARE_API_TOKEN=...      # keep it in your shell or a secret store, never in the repo
```

### 3. Create the KV namespace
```bash
npx wrangler kv namespace create JANE_KV
# → prints:  id = "<32-hex id>"
```
Your account id is shown by `npx wrangler whoami`.

### 4. Configure
```bash
cp wrangler.toml.example wrangler.toml
```
Edit `wrangler.toml`:
| Setting | Value |
|---|---|
| `name` | Worker name. The app is served at `https://<name>.<your-subdomain>.workers.dev` |
| `account_id` | Your Cloudflare account id. Or delete the line and `export CLOUDFLARE_ACCOUNT_ID=...` |
| `[[kv_namespaces]] id` | The id from step 3. Keep `binding = "JANE_KV"` (the code uses that name) |

`wrangler.toml` is gitignored, so your ids stay out of git. The scripts refuse to run while `<YOUR_...>` placeholders remain.

Learner settings go in the `[vars]` block: `LEARNER_NAME` (default `Explorer`), `LEARNER_AGE` (target age, default `10`;
the app is designed around ages ~8-12) and `LEARNER_GRADE` (default `upper elementary`). Changing them needs a redeploy.
The nightly scripts read the same block.

Optional tuning (code constants):
spaced-review boxes (`BOXES`) and the review-gate budget (`GATE_DAY_MAX`, `GATE_ITEMS` in `src/engine.js`).

### 5. Deploy
```bash
./deploy.sh                                   # build → back up live progress to backups/ → wrangler deploy
./deploy.sh --dry-run --outdir /tmp/jane-dist # build + bundle only; nothing is uploaded and KV isn't touched
```
Then open `https://<name>.<subdomain>.workers.dev/` (kid app) and `/parent` (parent report).

### 6. Local development (wrangler)
```bash
npm run dev          # build + wrangler dev → http://localhost:8787, with a local simulated KV (no live data)
```
To try things against the live deployment without changing the real record, use the sandbox:
`/api/sandbox?on=1` → test → `/api/sandbox?on=0` (see LESSONS.md, "Testing without touching…").

For a local run without wrangler, use option A (`npm start`).

`prototype/` is only the early **math-only** version (not the full app). It still runs on its own:
`cd prototype && npm install && node server.js` → http://localhost:8080 (state in `prototype/data/`, gitignored).

### Backups and reset (Cloudflare)
```bash
node backup-progress.mjs     # backups/<PT date>/progress-<time>.json (gitignored)
./reset.sh                   # asks you to type RESET, backs up, then deletes the live progress record
```
To restore a backup: `npx wrangler kv key put --binding JANE_KV --remote progress --path backups/<date>/progress-<time>.json`.

## Daily lesson packs (all options)
See [How the nightly cycle works](docs/NIGHTLY.md). It runs on any scheduler you choose; the export and publish scripts are the interface.
