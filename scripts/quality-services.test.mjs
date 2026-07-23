import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import {
  acquireQualityGateLock,
  cleanupQualityServices,
  createQualityRunId,
  ensureQualityServices,
  readQualityGateLock,
  recoverStaleQualityServices,
  resolveQualityServicesStatePath,
  validateQualityServicesState,
  withQualityGateLock,
} from "./quality-services-core.mjs";

const CONTAINER_A = "a".repeat(64);
const CONTAINER_B = "b".repeat(64);
const CONTAINER_C = "c".repeat(64);
const CONTAINER_D = "d".repeat(64);
const DATABASE_URL =
  "postgresql://kaklen:kaklen_dev_password@localhost:5432/kaklen_dev?schema=public";

test("quality run IDs are generated safely and traversal is rejected", () => {
  const first = createQualityRunId();
  const second = createQualityRunId();

  assert.match(first, /^quality-\d+-\d{13}-[a-f0-9]{12}$/u);
  assert.notEqual(first, second);
  assert.match(resolveQualityServicesStatePath(first), new RegExp(`${first}\\.json$`, "u"));
  for (const invalid of ["../escape", "quality/escape", "quality_unsafe", "", "A".repeat(81)]) {
    assert.throws(() => resolveQualityServicesStatePath(invalid), /runId/u);
  }
});

test("a concurrent Quality Gate fails fast without changing the active run", async () => {
  const directory = temporaryDirectory();
  const lockPath = join(directory, "quality-gate.lock");
  const statePath = join(directory, "quality-concurrent-a.json");
  const lease = acquireQualityGateLock({
    lockPath,
    runId: "quality-concurrent-a",
  });
  const originalState = JSON.stringify(
    qualityState({
      runId: lease.runId,
      pid: lease.pid,
      startedAt: lease.startedAt,
      ownerHostname: lease.hostname,
    }),
    null,
    2,
  );
  writeFileSync(statePath, `${originalState}\n`);

  try {
    const moduleUrl = pathToFileURL(
      resolve("scripts/quality-services-core.mjs"),
    ).href;
    const source = [
      `const { acquireQualityGateLock } = await import(${JSON.stringify(moduleUrl)});`,
      "try {",
      `  acquireQualityGateLock({ runId: "quality-concurrent-b", lockPath: ${JSON.stringify(lockPath)} });`,
      "  process.exitCode = 0;",
      "} catch (error) {",
      "  console.error(error.message);",
      "  process.exitCode = 73;",
      "}",
    ].join("\n");
    const child = spawn(
      process.execPath,
      ["--input-type=module", "-e", source],
      { shell: false, stdio: ["ignore", "pipe", "pipe"] },
    );
    const childResult = await collectChild(child);

    assert.equal(childResult.code, 73);
    assert.match(childResult.stderr, /is active with pid/u);
    assert.equal(readQualityGateLock({ lockPath }).runId, lease.runId);
    assert.equal(readFileSync(statePath, "utf8"), `${originalState}\n`);
  } finally {
    lease.release();
  }
});

test("an orphan lock is preserved as evidence and replaced atomically", () => {
  const directory = temporaryDirectory();
  const lockPath = join(directory, "quality-gate.lock");
  acquireQualityGateLock({
    lockPath,
    pid: 999_999,
    runId: "quality-stale-a",
  });
  const diagnostics = [];

  const replacement = acquireQualityGateLock({
    isPidAlive: () => false,
    lockPath,
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    runId: "quality-stale-b",
  });
  try {
    assert.equal(readQualityGateLock({ lockPath }).runId, "quality-stale-b");
    assert.equal(replacement.staleLocks.length, 1);
    assert.equal(existsSync(replacement.staleLocks[0]), true);
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].runId, "quality-stale-a");
  } finally {
    replacement.release();
  }
});

test("concurrent orphan-lock recovery keeps exactly one live owner", async () => {
  const directory = temporaryDirectory();
  const lockPath = join(directory, "quality-gate.lock");
  const barrierPath = join(directory, "start");
  const finishPath = join(directory, "finish");
  acquireQualityGateLock({
    lockPath,
    pid: 999_999,
    runId: "quality-race-stale",
  });

  const moduleUrl = pathToFileURL(
    resolve("scripts/quality-services-core.mjs"),
  ).href;
  const contenders = ["a", "b"].map((suffix) => {
    const runId = `quality-race-${suffix}`;
    const readyPath = join(directory, `ready-${suffix}`);
    const acquiredPath = join(directory, `acquired-${suffix}`);
    const source = [
      `const { existsSync, writeFileSync } = await import("node:fs");`,
      `const { acquireQualityGateLock, readQualityGateLock } = await import(${JSON.stringify(moduleUrl)});`,
      `const runId = ${JSON.stringify(runId)};`,
      `const lockPath = ${JSON.stringify(lockPath)};`,
      `const barrierPath = ${JSON.stringify(barrierPath)};`,
      `const finishPath = ${JSON.stringify(finishPath)};`,
      `writeFileSync(${JSON.stringify(readyPath)}, "ready\\n");`,
      "while (!existsSync(barrierPath)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);",
      "try {",
      "  const lease = acquireQualityGateLock({ lockPath, runId });",
      `  writeFileSync(${JSON.stringify(acquiredPath)}, "acquired\\n");`,
      "  while (!existsSync(finishPath)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);",
      "  if (readQualityGateLock({ lockPath }).runId !== runId) throw new Error('live lock changed');",
      "  lease.release();",
      "  process.exitCode = 0;",
      "} catch (error) {",
      "  console.error(error.message);",
      "  process.exitCode = 73;",
      "}",
    ].join("\n");
    const child = spawn(
      process.execPath,
      ["--input-type=module", "-e", source],
      { shell: false, stdio: ["ignore", "pipe", "pipe"] },
    );
    return {
      acquiredPath,
      completion: collectChild(child),
      readyPath,
      runId,
    };
  });

  await waitFor(
    () => contenders.every(({ readyPath }) => existsSync(readyPath)),
    2_000,
  );
  writeFileSync(barrierPath, "start\n");
  await waitFor(
    () => contenders.some(({ acquiredPath }) => existsSync(acquiredPath)),
    2_000,
  );
  const firstResult = await Promise.race(
    contenders.map(({ completion }, index) => completion.then((result) => ({ index, result }))),
  );
  assert.equal(firstResult.result.code, 73);
  assert.match(firstResult.result.stderr, /is active with pid|lock recovery/u);

  const winner = contenders.find(({ acquiredPath }) => existsSync(acquiredPath));
  assert.ok(winner);
  assert.equal(readQualityGateLock({ lockPath }).runId, winner.runId);
  assert.equal(existsSync(`${lockPath}.recovery`), false);

  writeFileSync(finishPath, "finish\n");
  const results = await Promise.all(contenders.map(({ completion }) => completion));
  assert.deepEqual(results.map(({ code }) => code).sort(), [0, 73]);
  assert.equal(existsSync(lockPath), false);
  assert.equal(existsSync(`${lockPath}.recovery`), false);
});

test("an abandoned lock-recovery coordinator is removed before acquisition", () => {
  const directory = temporaryDirectory();
  const lockPath = join(directory, "quality-gate.lock");
  const recoveryPath = `${lockPath}.recovery`;
  const staleCoordinator = qualityOwner("quality-dead-recovery");
  staleCoordinator.pid = 999_999;
  writeFileSync(recoveryPath, `${JSON.stringify(staleCoordinator, null, 2)}\n`);
  const diagnostics = [];

  const lease = acquireQualityGateLock({
    isPidAlive: () => false,
    lockPath,
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    runId: "quality-after-recovery",
  });
  try {
    assert.equal(readQualityGateLock({ lockPath }).runId, lease.runId);
    assert.equal(existsSync(recoveryPath), false);
    assert.equal(diagnostics[0].phase, "quality:stale-lock-recovery");
  } finally {
    lease.release();
  }
});

test("an invalid lock blocks startup and is preserved", () => {
  const directory = temporaryDirectory();
  const lockPath = join(directory, "quality-gate.lock");
  const corruptLock = '{"runId":"../escape","pid":1}\n';
  writeFileSync(lockPath, corruptLock);

  assert.throws(
    () => acquireQualityGateLock({
      isPidAlive: () => false,
      lockPath,
      runId: "quality-safe-run",
    }),
    /missing or unexpected fields|runId/u,
  );
  assert.equal(readFileSync(lockPath, "utf8"), corruptLock);
});

test("a preexisting container is recorded as unowned and never removed", async () => {
  const directory = temporaryDirectory();
  const runId = "quality-preexisting";
  const statePath = join(directory, `${runId}.json`);
  const calls = [];
  let databaseReady = false;
  const ids = {
    postgres: CONTAINER_A,
    redis: CONTAINER_B,
    mailpit: CONTAINER_C,
  };

  const state = await ensureQualityServices({
    checkDatabase: async () => databaseReady
      ? { ok: true }
      : { ok: false, type: "unavailable", message: "offline" },
    env: { DATABASE_URL },
    owner: qualityOwner(runId),
    readContainerId: (service) => ids[service],
    run: async (command, args) => {
      calls.push([command, ...args]);
      databaseReady = true;
    },
    runId,
    statePath,
    tcpAvailable: async () => true,
  });

  assert.equal(state.containers.postgres.existedBefore, true);
  assert.equal(state.containers.postgres.owned, false);
  assert.deepEqual(state.ownedServices, []);
  assert.deepEqual(calls, [[
    "docker",
    "compose",
    "--project-name",
    "kaklen",
    "up",
    "-d",
    "postgres",
  ]]);

  let destructiveCalls = 0;
  const cleanup = await cleanupQualityServices({
    env: {},
    expectedRunId: runId,
    readContainerId: (service) => ids[service],
    run: async () => {
      destructiveCalls += 1;
    },
    statePath,
  });
  assert.deepEqual(cleanup.removedServices, []);
  assert.equal(destructiveCalls, 0);
  assert.equal(existsSync(statePath), false);
});

test("a container created by the run is owned and removed by exact ID", async () => {
  const directory = temporaryDirectory();
  const runId = "quality-created";
  const statePath = join(directory, `${runId}.json`);
  const calls = [];
  let databaseReady = false;
  let postgresId = "";
  const ids = {
    redis: CONTAINER_B,
    mailpit: CONTAINER_C,
  };
  const readContainerId = (service) => service === "postgres"
    ? postgresId
    : ids[service];
  const run = async (command, args) => {
    calls.push([command, ...args]);
    if (args[0] === "compose") {
      postgresId = CONTAINER_A;
      databaseReady = true;
    }
    if (args[0] === "rm") postgresId = "";
  };

  const state = await ensureQualityServices({
    checkDatabase: async () => databaseReady
      ? { ok: true }
      : { ok: false, type: "unavailable", message: "offline" },
    env: { DATABASE_URL },
    owner: qualityOwner(runId),
    readContainerId,
    run,
    runId,
    statePath,
    tcpAvailable: async () => true,
  });
  assert.equal(state.containers.postgres.existedBefore, false);
  assert.equal(state.containers.postgres.owned, true);
  assert.deepEqual(state.ownedServices, ["postgres"]);

  const cleanup = await cleanupQualityServices({
    env: {},
    expectedRunId: runId,
    readContainerId,
    run,
    statePath,
  });
  assert.deepEqual(cleanup.removedServices, ["postgres"]);
  assert.deepEqual(cleanup.removedContainerIds, [CONTAINER_A]);
  assert.deepEqual(calls.at(-1), ["docker", "rm", "--force", CONTAINER_A]);
  assert.equal(existsSync(statePath), false);
});

test("changed container ownership blocks cleanup without a Docker mutation", async () => {
  const directory = temporaryDirectory();
  const runId = "quality-ownership-changed";
  const statePath = join(directory, `${runId}.json`);
  writeFileSync(
    statePath,
    `${JSON.stringify(qualityState({
      containers: {
        postgres: {
          id: CONTAINER_A,
          owned: true,
          existedBefore: false,
        },
      },
      ownedServices: ["postgres"],
      runId,
    }), null, 2)}\n`,
  );
  let destructiveCalls = 0;

  await assert.rejects(
    cleanupQualityServices({
      env: {},
      expectedRunId: runId,
      readContainerId: () => CONTAINER_D,
      run: async () => {
        destructiveCalls += 1;
      },
      statePath,
    }),
    /ownership changed/u,
  );
  assert.equal(destructiveCalls, 0);
  assert.equal(existsSync(statePath), true);
});

test("corrupt or untrusted state blocks every destructive cleanup", async (context) => {
  const valid = qualityState({ runId: "quality-corrupt" });
  const cases = [
    ["invalid JSON", "{not-json"],
    ["unknown service", JSON.stringify({
      ...valid,
      ownedServices: ["database"],
      containers: {
        database: {
          id: CONTAINER_A,
          owned: true,
          existedBefore: false,
        },
      },
    })],
    ["invalid pid", JSON.stringify({ ...valid, pid: 0 })],
    ["unknown version", JSON.stringify({ ...valid, version: 2 })],
    ["missing fields", JSON.stringify({ version: 1, runId: valid.runId })],
    ["unexpected fields", JSON.stringify({ ...valid, injected: true })],
  ];

  for (const [label, contents] of cases) {
    await context.test(label, async () => {
      const directory = temporaryDirectory();
      const statePath = join(directory, `${valid.runId}.json`);
      writeFileSync(statePath, `${contents}\n`);
      let destructiveCalls = 0;

      await assert.rejects(
        cleanupQualityServices({
          env: {},
          expectedRunId: valid.runId,
          readContainerId: () => CONTAINER_A,
          run: async () => {
            destructiveCalls += 1;
          },
          statePath,
        }),
      );
      assert.equal(destructiveCalls, 0);
      assert.equal(existsSync(statePath), true);
    });
  }
  assert.throws(
    () => validateQualityServicesState({
      ...valid,
      containers: {
        postgres: {
          id: "not-a-container-id",
          owned: false,
          existedBefore: true,
        },
      },
    }),
    /container ID/u,
  );
});

test("stale cleanup rejects a state whose owner is still active", async () => {
  const directory = temporaryDirectory();
  const lockPath = join(directory, "quality-gate.lock");
  const lease = acquireQualityGateLock({
    lockPath,
    runId: "quality-current-run",
  });
  const staleRunId = "quality-active-state";
  const stalePath = join(directory, `${staleRunId}.json`);
  writeFileSync(
    stalePath,
    `${JSON.stringify(qualityState({
      pid: process.pid,
      runId: staleRunId,
    }), null, 2)}\n`,
  );
  let destructiveCalls = 0;

  try {
    await assert.rejects(
      recoverStaleQualityServices({
        activeLease: lease,
        isPidAlive: () => true,
        run: async () => {
          destructiveCalls += 1;
        },
        stateDirectory: directory,
      }),
      /still has an active owner/u,
    );
    assert.equal(destructiveCalls, 0);
    assert.equal(existsSync(stalePath), true);
  } finally {
    lease.release();
  }
});

test("stale cleanup removes only exact containers from a dead owner", async () => {
  const directory = temporaryDirectory();
  const lockPath = join(directory, "quality-gate.lock");
  const lease = acquireQualityGateLock({
    lockPath,
    runId: "quality-current-recovery",
  });
  const staleRunId = "quality-dead-state";
  const stalePath = join(directory, `${staleRunId}.json`);
  writeFileSync(
    stalePath,
    `${JSON.stringify(qualityState({
      containers: {
        postgres: {
          id: CONTAINER_A,
          owned: true,
          existedBefore: false,
        },
      },
      ownedServices: ["postgres"],
      pid: 999_999,
      runId: staleRunId,
    }), null, 2)}\n`,
  );
  let currentId = CONTAINER_A;

  try {
    const result = await recoverStaleQualityServices({
      activeLease: lease,
      env: {},
      isPidAlive: () => false,
      readContainerId: () => currentId,
      run: async (command, args) => {
        assert.deepEqual([command, ...args], [
          "docker",
          "rm",
          "--force",
          CONTAINER_A,
        ]);
        currentId = "";
      },
      stateDirectory: directory,
    });
    assert.deepEqual(result.recoveredRuns, [staleRunId]);
    assert.deepEqual(result.removedServices, ["postgres"]);
    assert.equal(existsSync(stalePath), false);
    assert.equal(readQualityGateLock({ lockPath }).runId, lease.runId);
  } finally {
    lease.release();
  }
});

test("the Quality Gate lease is released for signals, timeout, and exceptions", async (context) => {
  for (const reason of ["SIGINT", "SIGTERM", "timeout", "exception"]) {
    await context.test(reason, async () => {
      const directory = temporaryDirectory();
      const lockPath = join(directory, "quality-gate.lock");
      await assert.rejects(
        withQualityGateLock(
          {
            lockPath,
            runId: `quality-release-${reason.toLowerCase()}`,
          },
          async () => {
            throw new Error(reason);
          },
        ),
        new RegExp(reason, "u"),
      );
      assert.equal(existsSync(lockPath), false);
    });
  }
});

test(
  "SIGINT and SIGTERM clean owned state and release a live child-process lease",
  { skip: process.platform === "win32" },
  async (context) => {
    for (const signal of ["SIGINT", "SIGTERM"]) {
      await context.test(signal, async () => {
        const directory = temporaryDirectory();
        const lockPath = join(directory, "quality-gate.lock");
        const statePath = join(directory, `quality-live-${signal.toLowerCase()}.json`);
        const moduleUrl = pathToFileURL(
          resolve("scripts/quality-services-core.mjs"),
        ).href;
        const runId = `quality-live-${signal.toLowerCase()}`;
        const source = [
          `const { cleanupQualityServices, ensureQualityServices, withQualityGateLock } = await import(${JSON.stringify(moduleUrl)});`,
          `const signal = ${JSON.stringify(signal)};`,
          `const runId = ${JSON.stringify(runId)};`,
          `const lockPath = ${JSON.stringify(lockPath)};`,
          `const statePath = ${JSON.stringify(statePath)};`,
          `const ownedContainerId = ${JSON.stringify(CONTAINER_A)};`,
          `const preexistingIds = { redis: ${JSON.stringify(CONTAINER_B)}, mailpit: ${JSON.stringify(CONTAINER_C)} };`,
          `const databaseUrl = ${JSON.stringify(DATABASE_URL)};`,
          "let databaseReady = false;",
          "let postgresId = '';",
          "const readContainerId = (service) => service === 'postgres' ? postgresId : preexistingIds[service];",
          "const run = async (_command, args) => {",
          "  if (args[0] === 'compose') { postgresId = ownedContainerId; databaseReady = true; }",
          "  if (args[0] === 'rm') { console.log(`REMOVED ${args.at(-1)}`); postgresId = ''; }",
          "};",
          "const interrupted = new Promise((resolveSignal) => process.once(signal, resolveSignal));",
          "await withQualityGateLock({ runId, lockPath }, async (lease) => {",
          "  await ensureQualityServices({",
          "    checkDatabase: async () => databaseReady",
          "      ? { ok: true }",
          "      : { ok: false, type: 'unavailable', message: 'offline' },",
          "    env: { DATABASE_URL: databaseUrl },",
          "    owner: {",
          "      runId: lease.runId,",
          "      pid: lease.pid,",
          "      startedAt: lease.startedAt,",
          "      hostname: lease.hostname,",
          "    },",
          "    readContainerId,",
          "    run,",
          "    runId,",
          "    statePath,",
          "    tcpAvailable: async () => true,",
          "  });",
          "  console.log('LOCKED');",
          "  const keepAlive = setInterval(() => {}, 1000);",
          "  await interrupted;",
          "  clearInterval(keepAlive);",
          "  await cleanupQualityServices({",
          "    env: {},",
          "    expectedRunId: runId,",
          "    readContainerId,",
          "    run,",
          "    statePath,",
          "  });",
          "  console.log('CLEANED');",
          "});",
        ].join("\n");
        const child = spawn(
          process.execPath,
          ["--input-type=module", "-e", source],
          { shell: false, stdio: ["ignore", "pipe", "pipe"] },
        );
        const completion = collectChild(child);
        await waitFor(
          () => existsSync(lockPath) && stateOwnsService(statePath, "postgres"),
          2_000,
        );
        assert.equal(existsSync(lockPath), true);
        assert.equal(existsSync(statePath), true);
        child.kill(signal);
        const childResult = await completion;

        assert.equal(childResult.code, 0);
        assert.equal(childResult.signal, null);
        assert.match(childResult.stdout, /LOCKED/u);
        assert.match(childResult.stdout, new RegExp(`REMOVED ${CONTAINER_A}`, "u"));
        assert.match(childResult.stdout, /CLEANED/u);
        assert.equal(existsSync(lockPath), false);
        assert.equal(existsSync(statePath), false);
      });
    }
  },
);

function qualityOwner(runId) {
  return {
    runId,
    pid: process.pid,
    startedAt: new Date().toISOString(),
    hostname: hostname(),
  };
}

function qualityState(options = {}) {
  const runId = options.runId ?? "quality-state";
  return {
    version: 1,
    runId,
    pid: options.pid ?? 999_999,
    startedAt: options.startedAt ?? new Date().toISOString(),
    hostname: options.ownerHostname ?? hostname(),
    composeProject: "kaklen",
    ownedServices: options.ownedServices ?? [],
    containers: options.containers ?? {},
  };
}

function temporaryDirectory() {
  return mkdtempSync(join(tmpdir(), "kaklen-quality-services-"));
}

function stateOwnsService(statePath, service) {
  if (!existsSync(statePath)) return false;
  try {
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    return Array.isArray(state.ownedServices) && state.ownedServices.includes(service);
  } catch {
    return false;
  }
}

function collectChild(child) {
  return new Promise((resolveChild, rejectChild) => {
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      rejectChild(new Error("Concurrent lock fixture did not terminate."));
    }, 5_000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      rejectChild(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      resolveChild({ code, signal, stdout, stderr });
    });
  });
}

async function waitFor(check, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 10));
  }
}
