import { EventEmitter } from "node:events";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { observeQueue, observeRedis, observeWorker } from "./infrastructure-observability";
import {
  SafeOperationalLogger,
  type OperationalLogEntry,
  type OperationalLogSink
} from "./safe-operational-logger";

class RedisEventEmitter extends EventEmitter {
  status = "connecting";
}

describe("infrastructure observability", () => {
  it("records every required Redis, queue, and worker event as structured data", () => {
    const entries: OperationalLogEntry[] = [];
    const sink = collectingSink(entries);
    const redis = new RedisEventEmitter();
    const queue = new EventEmitter();
    const worker = new EventEmitter();
    observeRedis(redis, new SafeOperationalLogger("redis", sink, fixedClock));
    observeQueue(queue, new SafeOperationalLogger("queue", sink, fixedClock));
    observeWorker(worker, new SafeOperationalLogger("worker", sink, fixedClock));
    const error = Object.assign(new Error("connection details"), { code: "ECONNRESET" });

    redis.emit("error", error);
    redis.status = "reconnecting";
    redis.emit("reconnecting", 250);
    redis.status = "ready";
    redis.emit("ready");
    redis.status = "end";
    redis.emit("close");
    queue.emit("error", error);
    queue.emit("waiting", { payload: "must-not-be-logged" });
    worker.emit("error", error);
    worker.emit("failed", { payload: "must-not-be-logged" }, error);
    worker.emit("stalled", "job-id", "active");
    worker.emit("ready");
    worker.emit("closed");

    expect(entries.map(({ component, event }) => `${component}:${event}`)).toEqual([
      "redis:error",
      "redis:reconnecting",
      "redis:ready",
      "redis:close",
      "queue:error",
      "queue:waiting",
      "worker:error",
      "worker:failed",
      "worker:stalled",
      "worker:ready",
      "worker:closed"
    ]);
    expect(entries.every((entry) => entry.timestamp === "2026-07-19T12:00:00.000Z")).toBe(true);
  });

  it("deduplicates repeated events for 60 seconds while retaining state changes", () => {
    const entries: OperationalLogEntry[] = [];
    let now = Date.parse("2026-07-19T12:00:00.000Z");
    const logger = new SafeOperationalLogger(
      "redis",
      collectingSink(entries),
      () => now
    );
    const error = Object.assign(new Error("not logged"), { code: "ECONNRESET" });

    expect(logger.write("error", "error", { error, state: "reconnecting" })).toBe(true);
    expect(logger.write("error", "error", { error, state: "reconnecting" })).toBe(false);
    expect(logger.write("error", "error", { error, state: "ready" })).toBe(true);
    now += 60_000;
    expect(logger.write("error", "error", { error, state: "reconnecting" })).toBe(true);

    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => entry.state)).toEqual([
      "reconnecting",
      "ready",
      "reconnecting"
    ]);
  });

  it("never serializes connection URLs, credentials, PII, messages, stacks, or payloads", () => {
    const entries: OperationalLogEntry[] = [];
    const logger = new SafeOperationalLogger(
      "redis",
      collectingSink(entries),
      fixedClock
    );
    const error = Object.assign(
      new Error(
        "rediss://admin:password@cache.example/4 ada@example.com token=private payload=secret"
      ),
      { code: "ECONNRESET", url: "rediss://admin:password@cache.example/4" }
    );

    logger.write("error", "error", { error, state: "reconnecting" });

    const serialized = JSON.stringify(entries);
    expect(serialized).not.toMatch(
      /cache\.example|admin|password|ada@example\.com|private|payload|secret|rediss:\/\//i
    );
    expect(entries[0]).toMatchObject({
      component: "redis",
      event: "error",
      errorName: "Error",
      errorCode: "ECONNRESET",
      state: "reconnecting"
    });
  });

  it("contains no empty production event listeners", () => {
    const sourceFiles = productionTypeScriptFiles(resolve(__dirname, ".."));
    const emptyExpressionListener =
      /\.on\(\s*["'][^"']+["']\s*,\s*\([^)]*\)\s*=>\s*undefined\s*\)/s;
    const emptyBlockListener =
      /\.on\(\s*["'][^"']+["']\s*,\s*\([^)]*\)\s*=>\s*\{\s*\}\s*\)/s;

    const offenders = sourceFiles.filter((file) => {
      const source = readFileSync(file, "utf8");
      return emptyExpressionListener.test(source) || emptyBlockListener.test(source);
    });

    expect(offenders).toEqual([]);
  });
});

function fixedClock(): number {
  return Date.parse("2026-07-19T12:00:00.000Z");
}

function collectingSink(entries: OperationalLogEntry[]): OperationalLogSink {
  const collect = (message: string): void => {
    entries.push(JSON.parse(message) as OperationalLogEntry);
  };
  return { log: collect, warn: collect, error: collect };
}

function productionTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return productionTypeScriptFiles(path);
    }
    return entry.isFile() && entry.name.endsWith(".ts") && !entry.name.includes(".spec.")
      ? [path]
      : [];
  });
}
