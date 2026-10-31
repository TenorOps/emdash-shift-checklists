#!/bin/sh
set -eu

plugin="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
root="$(git -C "$plugin" rev-parse --show-toplevel)"
site="$root/.cache/emdash-shift-checklists-e2e"

bun run --cwd "$plugin" build
if [ ! -f "$site/astro.config.mjs" ]; then
  mkdir -p "$root/.cache"
  (cd "$root/.cache" && bunx create-emdash@1.4.0 emdash-shift-checklists-e2e --platform node --template starter --pm bun --no-install --yes)
fi
if [ ! -f "$site/.fixture-ready" ]; then
  bun add --cwd "$site" @emdash-cms/sandbox-workerd@0.9.6 workerd@1.20261031.1 "tenorops-emdash-shift-checklists@file:$plugin"
  touch "$site/.fixture-ready"
fi

cat > "$site/astro.config.mjs" <<'EOF'
import node from "@astrojs/node";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";
import emdash, { local } from "emdash/astro";
import { sqlite } from "emdash/db";
import shiftChecklists from "tenorops-emdash-shift-checklists";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react(), emdash({
    database: sqlite({ url: "file:./data.db" }),
    storage: local({ directory: "./uploads", baseUrl: "/_emdash/api/media/file" }),
    sandboxed: [shiftChecklists],
    sandboxRunner: "@emdash-cms/sandbox-workerd/sandbox",
  })],
  devToolbar: { enabled: false },
});
EOF

rm -f "$site/data.db" "$site/data.db-shm" "$site/data.db-wal"
cd "$site"
exec bun run dev -- --host 127.0.0.1 --port 4329 --ignore-lock
