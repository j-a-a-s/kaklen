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

The original lifecycle remediation solved deterministic termination, but the
audited PR still had four related ownership defects:

1. The infrastructure runner used synchronous child execution without a
   timeout or a cancellable process tree. A provider download or another
   non-interactive Terraform child could therefore wait forever, and the
   parent had no opportunity to terminate descendants or emit cleanup data.
2. The Quality Gate timeout sent `SIGTERM` only to the immediate child. It had
   no process-group termination, descendant discovery, `SIGKILL` escalation,
   or hard settlement path. The promise waited exclusively for `exit`, so an
   ignored signal or detached grandchild could keep the gate pending forever.
3. Every Quality Gate wrote to one mutable
   `artifacts/quality-services-state.json`. Concurrent executions could
   overwrite ownership data or clean services used by another run.
4. A service that was unavailable before `docker compose up` was assumed to be
   created by the current run. Compose can instead restart or reuse a
   pre-existing container, so cleanup could remove a resource the run did not
   own.

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
- A Quality Gate that needs local services generates an internal, path-safe
  `runId` and acquires `artifacts/quality-services/quality-gate.lock` with
  exclusive `wx` creation. The lock has a closed schema containing `runId`,
  positive `pid`, ISO `startedAt`, and `hostname`.
- A live local lock rejects a contender without changing the active run. A
  malformed lock or a lock from another host fails closed. Recovery of a dead
  local lock is serialized by a second atomic `.recovery` lease so two
  contenders cannot replace each other's new live lock. The displaced lock is
  retained as `.stale-*` diagnostic evidence.
- Runtime ownership state is isolated at
  `artifacts/quality-services/<runId>.json`. Its versioned schema rejects
  traversal, unknown fields and services, invalid PIDs, timestamps, IDs, and
  filename/runId mismatches before any Docker mutation.
- Before Compose starts a missing service, the runner records its exact
  container ID. It records the ID again afterward and marks the container
  `owned=true` only when no ID existed before. A reused container is
  pre-existing and remains unowned.
- Cleanup uses only `docker rm --force <validated-container-id>` for IDs owned
  by that run. A changed ID, active owner, corrupt state, or unverifiable
  ownership blocks cleanup and preserves evidence. It never uses Compose
  `down`, prune, volumes, images, or names as deletion authority.
- Every supervised phase emits `[START]`, `[PASS]`, `[FAIL]`, `[TIMEOUT]`, and
  `[CLEANUP]` records with durations where applicable.
- CI jobs have bounded `timeout-minutes`, execute the process-termination
  and ownership regression tests, and upload command diagnostics, per-run
  service evidence, and remediation evidence.

The Terraform initialization guard is 600000 ms because the observed cold
provider initialization required 271976 ms after the fix. Other infrastructure
steps use 300000 ms. Quality tasks retain their existing workload-specific
limits. These values leave measured headroom without treating timeout changes
as the primary fix.

## Behavioral Tests

The tests execute real child processes instead of checking log text only. In
addition to the existing process-tree cases, they cover:

- a live Quality Gate rejecting a real concurrent contender while its lock and
  state remain unchanged;
- two child processes racing to recover one orphan lock, with exactly one
  winner and an intact live lock;
- orphan lock and abandoned recovery-coordinator handling;
- reused pre-existing containers, newly created containers, and changed
  container identity before cleanup;
- invalid JSON, unknown services, traversal, invalid PID and container ID,
  unknown version, missing fields, and unexpected fields;
- callback cleanup for `SIGINT`, `SIGTERM`, timeout, and exception, plus live
  subprocess signal tests that remove only their owned ID and release the
  lease.

| Suite | Result |
| --- | --- |
| Focused lifecycle and ownership tests | PASS, 62; SKIP, 1 platform fixture; FAIL, 0 |
| Quality service ownership tests | PASS, 26 of 26 |
| All repository script tests | PASS, 273; SKIP, 1 platform fixture; FAIL, 0 |
| Workspace tests | PASS, including API 513 of 513 and web 105 of 105 |

## Three Consecutive Clean-Clone Runs

The post-fix validation used a new recursive clone based on audited PR head
`883e881ced31fdaaccf8262ea4e2f01f77ad2798`, with only this remediation
applied. The pinned Kokecore submodule remained
`b0025e737d94a1dae4be2f8f71dcdcfea72c695f`.

### Infrastructure Plan

| Run | Started UTC | Finished UTC | Duration | Exit | Timeout | Remaining processes | Docker and ports |
| ---: | --- | --- | ---: | ---: | --- | ---: | --- |
| 1 | `2026-07-23T04:02:46.137Z` | `2026-07-23T04:02:54.652Z` | 8515 ms | 0 | No | 0 | Unchanged |
| 2 | `2026-07-23T04:03:09.961Z` | `2026-07-23T04:03:17.516Z` | 7555 ms | 0 | No | 0 | Unchanged |
| 3 | `2026-07-23T04:03:28.316Z` | `2026-07-23T04:03:35.869Z` | 7553 ms | 0 | No | 0 | Unchanged |

### Quality Gate

| Run | Started UTC | Finished UTC | Duration | Exit | Timeout | Remaining processes | Docker and ports |
| ---: | --- | --- | ---: | ---: | --- | ---: | --- |
| 1 | `2026-07-23T04:28:06.383Z` | `2026-07-23T04:32:58.334Z` | 291951 ms | 0 | No | 0 | Unchanged |
| 2 | `2026-07-23T04:33:19.673Z` | `2026-07-23T04:38:33.982Z` | 314309 ms | 0 | No | 0 | Unchanged |
| 3 | `2026-07-23T04:39:06.300Z` | `2026-07-23T04:44:25.946Z` | 319646 ms | 0 | No | 0 | Unchanged |

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

After every post-fix run, process inspection found zero descendants, no active
lock or per-run state remained, and Docker inspection found zero containers
owned by the command. All five running developer containers and one stopped
pre-existing Mailpit container retained their exact identities. Port snapshots
were identical before and after all six runs. A final process-table inspection
after both the focused and complete script suites also found zero hung
fixtures.

External provider registries, Docker registries, and cold builds can still be
slow or unavailable. They now fail with bounded duration, a non-zero code, and
diagnostic logs instead of waiting indefinitely. Platform process semantics are
covered for Unix process groups and Windows `taskkill`. Atomic file locking and
schema validation are platform-neutral; the live child `SIGINT`/`SIGTERM`
fixtures run on Unix and are skipped where those signal semantics are not
available. A hard `SIGKILL` cannot run `finally`, so the next invocation uses
the dead-owner recovery path. Manual out-of-band Docker replacement can race
with cleanup; an ID mismatch fails closed and retains evidence. Remote CI
remains the acceptance condition for the final pull request head.

## Rollback

Revert this remediation as an ordinary forward commit. Do not delete Terraform
state, service evidence, developer containers, rewrite `main`, or force-push.
Rollback restores the prior shared-state and inferred-ownership behavior and
therefore reopens both P1 findings as well as `AUD-001`; it is appropriate only
if an independent regression is more severe.

## Re-audit Request

Please re-run the two affected commands from a recursive clean clone, exercise
the hung-child fixture, and inspect the uploaded diagnostics. This remediation
is `READY_FOR_DEVIN_REAUDIT`; it is not a declaration that the independent
audit has passed.
