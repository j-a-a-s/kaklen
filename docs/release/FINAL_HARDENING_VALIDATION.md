# Final Hardening Validation

## Scope

This report certifies the local, reproducible hardening controls for Kaklen and
the Kokecore packages consumed by Kaklen. It adds no business behavior and does
not claim completion of external staging, real WhatsApp delivery, or a
production payment gateway.

The machine-readable result is
[`artifacts/final-hardening-validation.json`](../../artifacts/final-hardening-validation.json).

## Immutable References

| Repository or dependency | Validated commit |
| --- | --- |
| Kaklen technical changes | `bf17b37eb534ee4e48621df52368fb78ec03ae28` |
| Kaklen baseline | `75be865718c1302bfde0beb499a29914679ce84e` |
| Kokecore independent repository | `96b7632e3affb4138773cc95b9f7b42a9d5365a7` |
| `vendor/kokecore` pinned by Kaklen | `b0025e737d94a1dae4be2f8f71dcdcfea72c695f` |

The JSON records the Kaklen technical commit that was validated locally. The
following evidence-only commit cannot contain its own SHA; GitHub Actions must
therefore validate the final PR head before this closure is accepted.

## Clean Clone Evidence

Kaklen was cloned into an isolated temporary directory with
`git clone --recurse-submodules`. The submodule checkout matched the pinned SHA
above. Kokecore was cloned independently into a second temporary directory.
Both started from clean `main` worktrees and used Node 22-compatible tooling and
pnpm `9.15.4`.

No package manifest declares an external `link:`, `file:`, or absolute path.
The `link:` resolutions in the Kaklen lockfile are only pnpm's internal
workspace links to `packages/*` and the repository-owned
`vendor/kokecore/packages/*`; none escapes the clone.

## Kaklen Results

| Control | Result | Evidence |
| --- | --- | --- |
| Frozen install | PASS | `pnpm install --frozen-lockfile` |
| Prisma Client | PASS | Prisma `6.19.3` generated from the versioned schema |
| Clean migrations | PASS | 18 migrations replayed into an isolated PostgreSQL schema |
| Database contract | PASS | 32 tables and 131 critical indexes verified |
| Lint and typecheck | PASS | 22 workspace lint tasks; typecheck alias passed |
| Unit/workspace tests | PASS | 513 API tests and 105 Angular tests |
| Coverage | PASS | statements 96.64%, branches 85.67%, functions 94.70%, lines 97.02% |
| Localized web | PASS | builds and server checks for `es`, `en`, and `pt-BR` |
| E2E and accessibility | PASS | 37 Playwright tests; accessibility evidence included |
| Security controls | PASS | secret scan, SAST, dependency audit, and SBOM |
| API image | PASS | `linux/amd64`, `apps/api/Dockerfile` |
| Web image | PASS | `linux/amd64`, localized non-root runtime |
| Canonical gate | PASS | 35 executed tasks, zero failed, 201911 ms |

The successful committed run started at `2026-07-22T05:02:45.945Z`, finished at
`2026-07-22T05:06:07.856Z`, and ended with `QUALITY GATE PASSED`.

## Kokecore Results

The independent clone passed frozen install, lint, typecheck, tests, coverage,
build, public API snapshots, package content validation, secret scan, focused
Config SAST, dependency audit, and SBOM generation.

All eight package tarballs installed in isolated consumers with pnpm `8.15.0`
and `9.15.4`. The consumer contract rejected 24 attempted deep imports: `src`,
`src/public`, and `dist/internal` for each package. No `.tgz` remained in the
repository. The Config compatibility certification against Kaklen passed all
513 API tests, build checks, installation, and rollback.

## Commands Executed

```bash
git clone --recurse-submodules git@github.com:j-a-a-s/kaklen.git
git submodule status vendor/kokecore
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm prisma:migrate
pnpm db:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm quality:gate

git clone git@github.com:j-a-a-s/kokecore.git
pnpm --dir ../kokecore install --frozen-lockfile
pnpm --dir ../kokecore lint
pnpm --dir ../kokecore typecheck
pnpm --dir ../kokecore test
pnpm --dir ../kokecore test:coverage
pnpm --dir ../kokecore build
pnpm --dir ../kokecore package:validate
pnpm --dir ../kokecore api:verify
pnpm --dir ../kokecore security:scan
pnpm --dir ../kokecore config:sast
pnpm --dir ../kokecore security:audit
KOKE_CONSUMER_PNPM_VERSION=8.15.0 pnpm --dir ../kokecore test:consumer
KOKE_CONSUMER_PNPM_VERSION=9.15.4 pnpm --dir ../kokecore test:consumer
pnpm --dir ../kokecore config:certify:kaklen
```

For Kaklen, PostgreSQL, Redis, and Mailpit ran in an isolated Compose project on
non-default host ports. `DATABASE_URL`, `REDIS_URL`, and mail ports were pointed
to that project for every database and integration command.

## Failures and Corrections

1. Kaklen had no production web Dockerfile and the canonical gate built only the
   API image. A minimal localized, non-root web image was added and is now a
   required CI control with contract tests.
2. API coverage could reuse a non-coverage Turbo test cache because
   `API_TEST_WITH_COVERAGE` was not part of the task hash. The API test task now
   hashes the flag and owns `coverage/**`; the generic workspace task remains
   output-free.
3. Adding the web image exposed undeclared Docker consumers in the environment
   manifest. The canonical manifest and generated documentation were aligned.
4. The technical scorecard became stale after adding the web image control. It
   was regenerated from successful gate evidence and now requires both images.
5. One local rerun could not access the Docker socket inside the execution
   sandbox and stopped at `local-services`. The identical command passed with
   daemon access; no product change was made for an environmental permission.
6. The first Kokecore consumer run timed out while network access was sandboxed.
   Both supported pnpm versions passed with registry access.
7. The first Config-to-Kaklen compatibility run found Redis unavailable. After
   the declared Redis service returned `PONG`, the same certification passed;
   no package behavior changed.

## Residual Risks

- Angular reports that `@kokecore/validation` is CommonJS and may reduce bundle
  optimization. All builds and runtime checks pass. Converting package format is
  a separate packaging change and is not a P0/P1 hardening finding.
- Web-image dependency installation can execute Prisma postinstall from root
  workspace tooling even though Prisma is not part of the web runtime. The final
  runtime contains only localized static output and the Node static server.
- AWS staging and real external providers remain separately tracked external
  validations; this report does not convert them into local PASS results.

GitHub issue searches on `2026-07-22` returned zero open P0 and zero open P1
issues for both repositories.

## Reproduction

1. Use a clean recursive Kaklen clone and an independent Kokecore clone.
2. Start PostgreSQL 16, Redis, and Mailpit using Kaklen's Compose definition.
3. Run the commands above without `--force`, `--no-verify`, or mutable local
   package paths.
4. Require `QUALITY GATE PASSED` and inspect the uploaded CI evidence.
5. Confirm the workflow `head_sha` equals the PR head before accepting PASS.

## Rollback

Revert the validation commits with ordinary forward commits. The changes add no
schema migration or business data transformation. The previous API-only gate is
restored by reverting the pipeline commit; deployed containers can roll back to
their previously immutable image digest. Re-run frozen install, tests, localized
builds, and the canonical quality gate after any rollback.

## Workflows

- [Kaklen Quality Gate](https://github.com/j-a-a-s/kaklen/actions/workflows/ci.yml)
- [KOKE CORE Quality Gate](https://github.com/j-a-a-s/kokecore/actions/workflows/ci.yml)
- [Kokecore Config Package Artifact](https://github.com/j-a-a-s/kokecore/actions/workflows/config-package.yml)
