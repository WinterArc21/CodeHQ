# Code Observatory

Code Observatory is a local-first web app that renders your coding agent's understanding of
your codebase as an interactive workflow canvas. You run it inside your own repository; your
existing agent (Cursor, Claude Code, Codex, or similar) reads `.observatory/SKILL.md`,
inspects your real source code, and writes structured workflow JSON into `.observatory/`.
Code Observatory validates those files, watches them, and renders them in your browser as you
work. **It contains no LLM of its own and never uploads your code anywhere** — everything runs
on `localhost`.

## Privacy & security

- Runs entirely on your machine (`localhost`)
- Never uploads repository source to a remote service
- Contains no built-in LLM — your existing coding agent authors the `.observatory` files

See [SECURITY.md](./SECURITY.md) to report vulnerabilities privately.

## The core loop

```
you run `code-observatory open`
        |
        v
  browser opens at http://localhost:4310
        |
        v
  you ask your agent: "map the checkout workflow"
        |
        v
  agent reads the repo + .observatory/SKILL.md
        |
        v
  agent writes .observatory/workflows/checkout.json
        |
        v
  Code Observatory validates it, writes diagnostics.json
        |
        v
  the board updates live, in your browser, no refresh
```

If the agent writes something invalid, `.observatory/diagnostics.json` explains exactly what
is wrong and how to fix it, and the board keeps showing the last valid version of the workflow
in the meantime — it never blanks out.

## Quickstart

```sh
npx code-observatory init
npx code-observatory open
```

Then paste this into your coding agent:

> Read `.observatory/SKILL.md`, then document the checkout workflow. It starts at the
> `POST /api/checkout` route. Trace it through order creation, payment, and confirmation
> email, and write the result to `.observatory/workflows/checkout.json`. Then run
> `code-observatory validate` and fix anything it flags.

## Commands

### `code-observatory init [--force] [--no-example]`

Scaffolds `.observatory/` in the current repository: `project.json`, `SKILL.md`,
`workflows/`, and an initial `diagnostics.json`. Also appends `.observatory/.runtime/` to your
`.gitignore` (creating it if needed, never duplicating the line).

- `--force` — overwrite existing `.observatory` files. Without it, an existing file (for
  example a `SKILL.md` you have already edited) is left untouched and reported as unchanged.
- `--no-example` — skip copying the bundled example workflow into `workflows/`.

### `code-observatory open [--port <n>] [--no-open] [--root <path>]`

Starts the local server and opens the workflow canvas in your browser.

- `--port <n>` — port to listen on. Defaults to `4310`; if it is in use, the next free port is
  tried automatically and the fallback is reported.
- `--no-open` — start the server without opening a browser.
- `--root <path>` — repository root to serve. Defaults to walking up from the current
  directory looking for `.observatory/`, then `.git/`, then `package.json`.

Stop it with `Ctrl+C`.

### `code-observatory validate [--root <path>] [--json]`

Validates everything under `.observatory/`, writes the result to
`.observatory/diagnostics.json`, and prints it. Exits non-zero if there are any errors.

- `--root <path>` — repository root, same resolution rules as `open`.
- `--json` — print only the `DiagnosticsReport` as JSON, so an agent (or a script) can parse
  the result without scraping human-readable text.

Also available: `--help`, `--version`, `--debug` (or `OBSERVATORY_DEBUG=1`) for full stack
traces on error.

## The `.observatory` format

```
.observatory/
├── project.json          # project id/name and a few display settings
├── SKILL.md               # instructions for the agent authoring workflows
├── diagnostics.json        # written by Code Observatory, read by agents
├── workflows/
│   └── <id>.json           # one workflow per file
└── .runtime/                # gitignored scratch space, ignored by validation
```

A workflow is a directed graph of steps an agent has verified against the real code — no
coordinates, colors, or styling, ever; Code Observatory owns all of that. A short annotated
example:

```json
{
  "schemaVersion": "0.1",
  "id": "checkout",
  "name": "Checkout",
  "purpose": "Takes a cart to a confirmed, paid order.",
  "entryPoint": { "file": "app/api/checkout/route.ts", "symbol": "POST" },
  "steps": [
    {
      "id": "create-order",
      "name": "Create Order",
      "purpose": "Persists a pending order from the cart contents.",
      "category": "entry",
      "confidence": "verified",
      "sources": [{ "file": "app/api/checkout/route.ts", "symbol": "POST", "line": 12, "endLine": 30 }],
      "outputs": [{ "name": "Order", "type": "Order" }]
    },
    {
      "id": "charge-payment",
      "name": "Charge Payment",
      "purpose": "Charges the customer's saved payment method.",
      "category": "external",
      "externalServices": [{ "name": "Stripe", "operation": "POST /charges" }],
      "edgeCases": [{ "name": "Card declined", "handling": "Order is marked failed; customer is notified." }]
    }
  ],
  "connections": [
    { "from": "create-order", "to": "charge-payment", "type": "success" }
  ]
}
```

Every object is validated strictly — an unrecognized key (especially a visual one like `x`,
`color`, or `style`) is a hard error, not a warning. Every `file` path must be
repository-relative. The full field-by-field reference lives in `.observatory/SKILL.md` after
you run `init`.

## Local development

```sh
pnpm install
pnpm dev            # web (Vite) + API server, in parallel
pnpm build          # dist/node (CLI + server) and dist/web
pnpm test           # vitest
```

Other useful scripts: `pnpm typecheck`, `pnpm lint`, `pnpm test:e2e` (Playwright).

## Contributing

PRs are welcome — please target `dev`. See [CONTRIBUTING.md](./CONTRIBUTING.md). Direct
pushes to `main` and `dev` are blocked; changes land through pull requests.

## License

[MIT](./LICENSE)
