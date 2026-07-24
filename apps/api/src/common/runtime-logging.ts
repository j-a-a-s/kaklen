/**
 * @deprecated Use @kokecore/logging directly. This module re-exports for backward
 * compatibility during migration.
 */
export {
  createRequestLoggingMiddleware as createLoggingMiddleware,
  redactSensitiveData as redactSecret,
} from "@kokecore/logging";
