# Jane, standalone: the full app on Node with file-based storage in /data (a volume). No Cloudflare needed.
#   docker build -t jane .
#   docker run -d --name jane -p 127.0.0.1:8787:8787 -v jane-data:/data -e LEARNER_NAME=Sam jane
# or: docker compose up -d   (see docker-compose.yml and INSTALL.md)

# --- build: install pinned dev tools (esbuild + UI libs) and generate public/tax.json, glossary.json, vendor bundle, src/gen.js
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
# Household region filter (BOT-SETUP.md): e.g. docker compose build --build-arg HIDE_REGIONS=AU
ARG HIDE_REGIONS=""
RUN HIDE_REGIONS="$HIDE_REGIONS" node build.mjs

# --- runtime: plain Node, no npm dependencies, non-root, read-only app files
FROM node:22-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 DATA_DIR=/data STORAGE=file
WORKDIR /app
COPY --from=build /app/package.json /app/LICENSE /app/LICENSING.md /app/NOTICE /app/CHANGELOG.md /app/LESSONS.md ./
COPY --from=build /app/lib-cli.mjs /app/lib-regions.mjs /app/export-progress.mjs /app/publish-lessons.mjs /app/backup-progress.mjs /app/migrate-medals.mjs ./
COPY --from=build /app/server ./server
COPY --from=build /app/src ./src
COPY --from=build /app/public ./public
COPY --from=build /app/packs/examples ./packs/examples
COPY --from=build /app/data/marble/LICENSE /app/data/marble/LICENSE-CONTENT /app/data/marble/PROVENANCE.md ./data/marble/
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server/index.mjs"]
