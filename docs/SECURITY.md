# Security

## Supported Baseline

Kaklen currently supports the foundation branch and its direct successors. Security fixes should be applied to the active development branch first.

## Secrets

Secrets must not be committed. Use local `.env` files for development and repository or deployment secrets for CI/CD.

Ignored local files include:

- `.env`
- `.env.local`
- `*.log`
- build outputs

The committed `.env.example` contains only development defaults.

## API Hardening

The NestJS API enables Helmet by default. CORS is limited to the local Angular development origin in the foundation setup.

Locale preferences are allow-listed to `es`, `en`, and `pt-BR` on the API. The frontend must translate user-facing errors from stable `code` values instead of relying on backend message text.

## Dependency Updates

Dependabot is configured for:

- npm workspace dependencies.
- GitHub Actions.
- Docker images.

Review dependency updates with the normal validation flow:

```bash
pnpm install
pnpm prisma:generate
pnpm lint
pnpm test
pnpm build
```

## Reporting

For now, report security issues privately to the repository owner. Do not open public issues with exploit details.
