# @kokecore/config rollback

## Certified integration

- Package: `@kokecore/config@0.2.0`
- Certified artifact SHA-256:
  `bc7d748217b7f9de70cb32280e7fa39e82a9e7a3a8040cb3280c2af9cb854f99`
- Artifact source commit (KOKE CORE):
  `cf1acdb6f6bfc3487a5af3b0d1b6f5b1da044c34`
- Kaklen integration commit: `0f9bebd49f49a8a1aa5633e09b19bad181760134`
- Previous Kaklen commit: `4e8e01f85207b1af377c5465229171492ad0e0ce`
- Previous KOKE CORE commit: `9d74f7f39bdf3bce027dd97ec7d0d203950b26fd`

## Trigger

Start rollback only when a production-equivalent validation demonstrates one of
these conditions and the Config adapter cannot be corrected safely within the
incident window:

- required, optional, default, or coerced values differ from the previous Kaklen contract;
- a safe configuration error exposes an input value;
- the packaged root export cannot resolve on the certified Node/pnpm matrix;
- the artifact checksum differs from the recorded value;
- Kaklen cannot build or start because of the packaged Config dependency.

## Owner and target time

- Owner: KOKE GROUP Platform
- Approval: Kaklen technical owner
- Estimated execution and validation time: 30 minutes with a warm pnpm store

## Procedure

1. Preserve the failing logs, package version, Kaklen SHA, KOKE CORE SHA, and artifact checksum.
2. Revert the Kaklen integration commit without reverting unrelated commits.
3. Restore `apps/api/package.json`, `packages/config/package.json`,
   `packages/config/src/index.ts`, and `pnpm-lock.yaml` from
   `4e8e01f85207b1af377c5465229171492ad0e0ce`.
4. Restore both previous `@kokecore/config` dependencies to
   `link:../../../kokecore/packages/config`.
5. In the sibling `kokecore` checkout, restore only `packages/config` and the
   corresponding lockfile from `9d74f7f39bdf3bce027dd97ec7d0d203950b26fd`.
   Keep later fixes in the other seven packages. Reverting the complete Core
   checkout is prohibited because it reintroduces known browser incompatibilities.
6. Remove the unreferenced `vendor/kokecore/config` artifact directory.
7. Run the validation commands below before releasing the rollback.

```bash
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm env:verify
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm architecture:check
pnpm security:scan
```

For a safe rehearsal that performs those steps in temporary clones and removes
them at the end:

```bash
KOKECORE_SOURCE_PATH=/path/to/kokecore pnpm config:rollback:verify
```

## Validation evidence

Successful rehearsal on 2026-07-20:

- Kaklen integration checkout: `0f9bebd49f49a8a1aa5633e09b19bad181760134`
- KOKE CORE checkout retained: `d689656766c7fa3c7e4a824a0db8ab562ddab84c`
- Config package restored from: `9d74f7f39bdf3bce027dd97ec7d0d203950b26fd`
- Script tests: `224/224`; Web: `105/105`; API: `513/513`
- Build: `4/4`; architecture: `373` source files; high-confidence secrets: `0`
- Final result: `KAKLEN_CONFIG_ROLLBACK_PASSED`

The rehearsal restores only the four Kaklen Config integration files and the old
Core Config package, keeps subsequent unrelated fixes in both repositories,
checks both local-link entries, builds all eight Core packages, installs both
repositories with frozen lockfiles, and runs the complete command set above.
Success is reported only as `KAKLEN_CONFIG_ROLLBACK_PASSED`; temporary checkouts
are deleted in `finally` on success or failure.

## Limitations

- This is an Alpha recovery path based on sibling local links, not an approved distribution model.
- It requires the two recorded baseline commits and the current Core checkout to remain reachable internally.
- It does not roll back database schema or product data because Config changed neither.
- It does not authorize public npm publication or migration of another KOKE CORE package.
