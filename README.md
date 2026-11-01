# Restaurant Opening & Closing Checklists

Create reusable checklists for each restaurant location and shift. Start a shift, mark tasks as they are completed, and review past shifts. Checklist and shift records stay on the EmDash site; a TenorOps account is not required.

Install the plugin from the EmDash registry, then open **Shift checklists** in the admin navigation. The plugin's starter tasks are examples: adapt them to your operation and local requirements. Only users with EmDash's plugin-management permission can use its admin page.

The registry listing credits [TenorOps](https://tenorops.com). Report security issues to hello@tenorops.com.

See the [usage guide](docs/usage.md) for checklist workflows and permissions.

## Development

Install dependencies with `bun install`, then run `bun run validate`, `bun run typecheck`, `bun run test`, and `bun run bundle`. To run the browser journey, install Chromium with `bunx playwright install chromium` and run `bunx playwright test --config playwright.config.ts`. The browser test creates a disposable EmDash site under `.cache/` and resets its local test database. It requires Node.js 24 and Bun.

See [development and releases](docs/development.md) for test and publishing details.

## License

MIT License

Copyright (c) 2026 TenorOps

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
