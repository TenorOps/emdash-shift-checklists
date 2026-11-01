# Development and releases

Install dependencies with `bun install --frozen-lockfile`. Run `bun run validate`, `bun run typecheck`, `bun run test`, and `bun run bundle` to check the plugin and its sandbox behavior.

For the browser journey, install Chromium with `bunx playwright install chromium`, then run `bunx playwright test --config playwright.config.ts`. The test creates a disposable Node.js EmDash site in `.cache/emdash-shift-checklists-e2e`, installs its dependencies on first use, and resets that site's SQLite database each run. It uses EmDash's development-only admin bypass and listens on port 4329. GitHub Actions runs the sandbox and browser tests.

To release, authenticate with `bun run login <handle>` and verify that the authenticated account matches the publisher DID in `emdash-plugin.jsonc`. Publish with `bun run publish`. The manifest points to the public plugin repository. The CLI validates and uploads the bundle and prints a command to follow the registry's listing checks.
