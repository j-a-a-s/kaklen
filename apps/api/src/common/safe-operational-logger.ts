import { Logger } from "@nestjs/common";

export interface OperationalLogEntry {
  event: string;
  component: string;
  errorName?: string;
  errorCode?: string;
  state?: string;
  timestamp: string;
}

export interface OperationalLogSink {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export type OperationalLogLevel = "log" | "warn" | "error";

interface OperationalLogDetails {
  error?: unknown;
  state?: string;
}

const DEDUPLICATION_WINDOW_MS = 60_000;
const SAFE_ERROR_NAME = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
const SAFE_ERROR_CODE = /^[A-Z][A-Z0-9_-]{0,63}$/;
const SAFE_STATE = /^[a-z][a-z0-9_-]{0,31}$/;

export class SafeOperationalLogger {
  private readonly lastLoggedAt = new Map<string, number>();

  constructor(
    private readonly component: string,
    private readonly sink: OperationalLogSink = new Logger(component),
    private readonly now: () => number = Date.now,
    private readonly deduplicationWindowMs = DEDUPLICATION_WINDOW_MS
  ) {}

  write(
    level: OperationalLogLevel,
    event: string,
    details: OperationalLogDetails = {}
  ): boolean {
    const errorName = this.errorName(details.error);
    const errorCode = this.errorCode(details.error);
    const state = this.safeState(details.state);
    const key = [this.component, event, errorCode ?? "", state ?? ""].join("\u0000");
    const timestampMs = this.now();
    const lastTimestamp = this.lastLoggedAt.get(key);

    if (
      lastTimestamp !== undefined &&
      timestampMs - lastTimestamp < this.deduplicationWindowMs
    ) {
      return false;
    }

    this.lastLoggedAt.set(key, timestampMs);
    const entry: OperationalLogEntry = {
      event,
      component: this.component,
      ...(errorName ? { errorName } : {}),
      ...(errorCode ? { errorCode } : {}),
      ...(state ? { state } : {}),
      timestamp: new Date(timestampMs).toISOString()
    };
    this.sink[level](JSON.stringify(entry));
    return true;
  }

  private errorName(error: unknown): string | undefined {
    if (!(error instanceof Error)) {
      return undefined;
    }
    return SAFE_ERROR_NAME.test(error.name) ? error.name : "Error";
  }

  private errorCode(error: unknown): string | undefined {
    if (!error || typeof error !== "object" || !("code" in error)) {
      return undefined;
    }
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" && SAFE_ERROR_CODE.test(code) ? code : undefined;
  }

  private safeState(state: string | undefined): string | undefined {
    return state && SAFE_STATE.test(state) ? state : undefined;
  }
}
