# Contributing

## Development Flow

1. Work from a feature branch.
2. Keep changes focused and small enough to review.
3. Run validation before opening a pull request:

```bash
pnpm install
pnpm prisma:generate
pnpm lint
pnpm test
pnpm build
```

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

## Pull Requests

Every pull request should include:

- What changed.
- How it was validated.
- Any migration or environment impact.
