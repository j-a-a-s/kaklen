# Contributing

## Development Flow

1. Prepare the repository with [Start Here](docs/START_HERE.md).
2. Work from a focused feature branch.
3. Run the fast local controls while iterating:

```bash
pnpm check
```

4. Run `pnpm quality:gate` before requesting review when the change is ready.
5. Use `pnpm release:check:strict` only when preparing release evidence.

The command contract and compatibility aliases are documented in
[Commands](docs/development/COMMANDS.md).

## Commit Style

Use Conventional Commits:

```text
feat(scope): add capability
fix(scope): correct behavior
chore(scope): maintain tooling
docs(scope): update documentation
```

## Code Expectations

- Prefer existing project patterns over new abstractions.
- Keep shared contracts in `packages/shared`.
- Keep environment parsing and defaults in `packages/config`.
- Do not commit secrets, local `.env` files, generated logs, or build artifacts.
- Document meaningful architecture decisions in `docs/DECISIONS.md`.
- Update the relevant canonical guide instead of copying instructions into
  multiple files.

## Pull Requests

Every pull request should include:

- What changed.
- How it was validated.
- Any migration or environment impact.
