# Sprint 4A AUD-001 Remediation

## Finding

`AUD-001` is the P1 finding reported in `DEVIN_POST_MERGE_AUDIT.md` for the
original merge commit `4dffa9251a929b491b8e2cdd257666e75d73ed88`. The audit
observed that these commands did not return an exit code after exceeding the
duration recorded by the merged evidence:

- `pnpm infra:plan:staging`
- `pnpm quality:gate`

The machine-readable remediation result is
[`artifacts/sprint-4a-aud-001-remediation.json`](../../artifacts/sprint-4a-aud-001-remediation.json).

## Reproduction

The pre-fix commit was checked out in a new recursive clone and installed with
`pnpm install --frozen-lockfile`. An external harness sampled the main PID,
descendants, CPU, memory, visible output, Docker containers, listening ports,
exit code, and termination signal while each command ran.

| Command | Started UTC | PID | Duration | Exit | Peak CPU | Peak RSS | Result in this machine |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `pnpm infra:plan:staging` | `2026-07-23T01:15:29.588Z` | 50685 | 431966 ms | 0 | 153.4% | 612288 KiB | Eventually completed |
| `pnpm quality:gate` | `2026-07-23T01:23:11.707Z` | 52012 | 399434 ms | 0 | 212.0% | 2466512 KiB | Eventually completed |

The local reproduction does not replace or rewrite the Devin result. The
canonical `before` result remains `terminated=false` and `exitCode=null`, as
reported by the independent post-merge audit. On this machine the vulnerable
paths happened to finish, but inspection still demonstrated that neither path
could guarantee termination.

For the infrastructure run, 83 of 87 process samples remained in `terraform
init -reconfigure -input=false`; the last visible provider output was
`Installing hashicorp/aws v6.55.0...`. Docker and listening ports were
unchanged, no temporary plan remained, and no child remained after the command
eventually exited. The Quality Gate spent most of its time in E2E and image
builds. Its Docker and port snapshots also remained unchanged after completion.

## Root Cause

Two independent lifecycle defects produced the same externally visible
symptom:

1. The infrastructure runner used synchronous child execution without a
   timeout or a cancellable process tree. A provider download or another
   non-interactive Terraform child could therefore wait forever, and the
   parent had no opportunity to terminate descendants or emit cleanup data.
2. The Quality Gate timeout sent `SIGTERM` only to the immediate child. It had
   no process-group termination, descendant discovery, `SIGKILL` escalation,
   or hard settlement path. The promise waited exclusively for `exit`, so an
   ignored signal or detached grandchild could keep the gate pending forever.

The defects were not caused by a single slow threshold. The correction changes
process ownership and termination semantics; timeouts are secondary guards.

## Correction

- `scripts/process-supervisor.mjs` now starts non-interactive process groups,
  captures bounded diagnostics, applies an explicit timeout, terminates the
  complete descendant tree, escalates from `SIGTERM` to `SIGKILL`, and always
  settles with a deterministic exit code.
- The infrastructure runner now uses the shared supervisor, disables the
  Terraform backend for offline plans, supplies `-input=false`, disables plan
  refresh and locking, propagates Terraform's first real failure, and removes
  `staging.tfplan` in `finally`.
- The Quality Gate now supervises every task, aborts active trees on signals,
  preserves the first real failure, and executes final cleanup regardless of
  success, failure, timeout, or interruption.
- Docker cleanup records container IDs started by the current Quality Gate and
  removes only those owned services. Existing developer containers are not
  removed.
- Every supervised phase emits `[START]`, `[PASS]`, `[FAIL]`, `[TIMEOUT]`, and
  `[CLEANUP]` records with durations where applicable.
- CI jobs have bounded `timeout-minutes`, execute the process-termination
  regression tests, and upload command diagnostics and remediation evidence.

The Terraform initialization guard is 600000 ms because the observed cold
provider initialization required 271976 ms after the fix. Other infrastructure
steps use 300000 ms. Quality tasks retain their existing workload-specific
limits. These values leave measured headroom without treating timeout changes
as the primary fix.

## Behavioral Tests

The tests execute real child processes instead of checking log text only. They
cover a successful child, non-zero exit propagation, a parent and grandchild
that ignore `SIGTERM`, a detached grandchild when operating-system process
inspection is available, timeout exit code 124, `SIGKILL` escalation, cleanup
on failure, temporary plan removal, and owned-container cleanup. The portable
fixture verifies liveness with signal 0 instead of interpreting a denied `ps`
call as proof that a process exited.

| Suite | Result |
| --- | --- |
| Focused AUD-001 tests | PASS, 33 of 33 |
| All repository script tests | PASS, 249 of 249 |
| Workspace tests | PASS, including API 513 of 513 and web 105 of 105 |

## Three Consecutive Clean-Clone Runs

The post-fix validation used a new recursive clone at commit `f9d6b2d` with the
pinned Kokecore submodule `b0025e737d94a1dae4be2f8f71dcdcfea72c695f`.

### Infrastructure Plan

| Run | Started UTC | Finished UTC | Duration | Exit | Timeout | Remaining processes | Docker and ports |
| ---: | --- | --- | ---: | ---: | --- | ---: | --- |
| 1 | `2026-07-23T02:00:55.928Z` | `2026-07-23T02:05:41.124Z` | 285196 ms | 0 | No | 0 | Unchanged |
| 2 | `2026-07-23T02:05:55.895Z` | `2026-07-23T02:06:04.870Z` | 8975 ms | 0 | No | 0 | Unchanged |
| 3 | `2026-07-23T02:06:33.967Z` | `2026-07-23T02:06:42.650Z` | 8683 ms | 0 | No | 0 | Unchanged |

### Quality Gate

| Run | Started UTC | Finished UTC | Duration | Exit | Timeout | Remaining processes | Docker and ports |
| ---: | --- | --- | ---: | ---: | --- | ---: | --- |
| 1 | `2026-07-23T02:07:02.844Z` | `2026-07-23T02:13:38.881Z` | 396037 ms | 0 | No | 0 | Unchanged |
| 2 | `2026-07-23T02:13:55.363Z` | `2026-07-23T02:19:29.949Z` | 334586 ms | 0 | No | 0 | Unchanged |
| 3 | `2026-07-23T02:19:51.827Z` | `2026-07-23T02:26:24.881Z` | 393054 ms | 0 | No | 0 | Unchanged |

All three gate runs printed `QUALITY GATE PASSED`. The conservative duration
reported in the JSON uses the slowest successful run for each command.

## Standalone Validation

| Command | Result |
| --- | --- |
| `pnpm infra:fmt` | PASS |
| `pnpm infra:validate` | PASS |
| `pnpm infra:lint` | PASS |
| `pnpm infra:security` | PASS |
| `pnpm lint` | PASS, no errors |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS |
| `pnpm build` | PASS |

The first standalone test attempt was made inside a restricted process sandbox
that denied local socket access. It was repeated unchanged in the normal local
execution context and passed. The three complete Quality Gate runs had already
validated the same test graph with PostgreSQL, Redis, Mailpit, E2E, localized
builds, and Docker images.

## Cleanup and Remaining Risk

After every post-fix run, process inspection found zero descendants and Docker
inspection found zero containers owned by the command. The three pre-existing
developer services remained unchanged. Port snapshots were identical before
and after all six runs. A final process-table inspection after both the focused
and complete script suites also found zero hung fixtures.

External provider registries, Docker registries, and cold builds can still be
slow or unavailable. They now fail with bounded duration, a non-zero code, and
diagnostic logs instead of waiting indefinitely. Platform process semantics are
covered for Unix process groups and Windows `taskkill`; remote CI remains the
acceptance condition for the final pull request head.

## Rollback

Revert the remediation commits as ordinary forward commits. Do not delete
Terraform state, remove developer containers, rewrite `main`, or use a
force-push. A rollback restores the original lifecycle behavior and therefore
reopens `AUD-001`; it is appropriate only if an independent regression is more
severe than non-termination.

## Re-audit Request

Please re-run the two affected commands from a recursive clean clone, exercise
the hung-child fixture, and inspect the uploaded diagnostics. This remediation
is `READY_FOR_DEVIN_REAUDIT`; it is not a declaration that the independent
audit has passed.
