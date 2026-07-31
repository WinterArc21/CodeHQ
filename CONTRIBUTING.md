# Contributing to Code Observatory

Thanks for wanting to help. This project stays small and local-first on purpose.

## How to propose a change

1. Open an issue first for anything larger than a typo or tiny bugfix (layout engine, schema, CLI behavior).
2. Fork the repo and create a branch off `dev`.
3. Keep the change focused — one concern per PR.
4. Run what you can locally before opening the PR:

```sh
pnpm install
pnpm typecheck
pnpm lint
pnpm test
```

5. Open a pull request **into `dev`** (not `main`). Describe what changed and how you verified it.

Direct pushes to `main` and `dev` are blocked. Maintainers merge via pull request.

## Project conventions

- **No LLM inside the product.** Observatory renders agent-authored `.observatory` files; it never uploads repository code.
- **Workflow JSON never carries visuals.** No coordinates, colors, fonts, or layout hints in schema files — the renderer owns that.
- **Prefer altitude over encyclopedias.** Maps should stay at Story height by default; proof (files, types, symbols) belongs in Code map / expand / drawer.
- Match existing TypeScript, CSS Modules, and test patterns. Avoid drive-by refactors.

## Reporting security issues

See [SECURITY.md](./SECURITY.md).
