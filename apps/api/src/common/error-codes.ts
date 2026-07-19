export const ERROR_CODES = {
  badRequest: "BAD_REQUEST",
  unauthorized: "UNAUTHORIZED",
  forbidden: "FORBIDDEN",
  notFound: "NOT_FOUND",
  conflict: "CONFLICT",
  duplicateTaxId: "DUPLICATE_TAX_ID",
  rutInvalid: "RUT_INVALID",
  rutRequired: "RUT_REQUIRED",
  resourceNotFound: "RESOURCE_NOT_FOUND",
  validationError: "VALIDATION_ERROR",
  quotationInvalidStatus: "QUOTATION_INVALID_STATUS",
  quotationMoneyMismatch: "QUOTATION_MONEY_MISMATCH",
  quotationMoneyRepairNotAllowed: "QUOTATION_MONEY_REPAIR_NOT_ALLOWED",
  quotationMoneyRepairNotPossible: "QUOTATION_MONEY_REPAIR_NOT_POSSIBLE",
  quotationMoneyRepairConflict: "QUOTATION_MONEY_REPAIR_CONFLICT",
  clpFractionNotAllowed: "CLP_FRACTION_NOT_ALLOWED",
  moneyPrecisionNotAllowed: "MONEY_PRECISION_NOT_ALLOWED",
  eventInvalidStatus: "EVENT_INVALID_STATUS",
  passwordMismatch: "PASSWORD_MISMATCH",
  passwordPolicy: "PASSWORD_POLICY",
  passwordReuse: "PASSWORD_REUSE",
  passwordResetTokenInvalid: "PASSWORD_RESET_TOKEN_INVALID",
  passwordResetTokenExpired: "PASSWORD_RESET_TOKEN_EXPIRED",
  passwordResetTokenUsed: "PASSWORD_RESET_TOKEN_USED",
  passwordResetTokenRevoked: "PASSWORD_RESET_TOKEN_REVOKED",
  emailNotVerified: "EMAIL_NOT_VERIFIED",
  emailVerificationTokenInvalid: "EMAIL_VERIFICATION_TOKEN_INVALID",
  emailVerificationTokenExpired: "EMAIL_VERIFICATION_TOKEN_EXPIRED",
  emailVerificationTokenUsed: "EMAIL_VERIFICATION_TOKEN_USED",
  emailVerificationTokenRevoked: "EMAIL_VERIFICATION_TOKEN_REVOKED",
  tooManyRequests: "TOO_MANY_REQUESTS",
  internalServerError: "INTERNAL_SERVER_ERROR"
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export function codeForStatus(statusCode: number): ErrorCode {
  if (statusCode === 400) {
    return ERROR_CODES.badRequest;
  }
  if (statusCode === 401) {
    return ERROR_CODES.unauthorized;
  }
  if (statusCode === 403) {
    return ERROR_CODES.forbidden;
  }
  if (statusCode === 404) {
    return ERROR_CODES.notFound;
  }
  if (statusCode === 409) {
    return ERROR_CODES.conflict;
  }
  if (statusCode === 429) {
    return ERROR_CODES.tooManyRequests;
  }
  return ERROR_CODES.internalServerError;
}

export interface ApiErrorResponse {
  code: ErrorCode | string;
  message: string;
  statusCode: number;
  field?: string;
  resourceId?: string;
  repairable?: boolean;
}
