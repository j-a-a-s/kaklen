export const AUTH_DELIVERY_QUEUE = "auth-delivery";

export type AuthDeliveryJobName = "password-reset" | "verification-resend";

export interface AuthDeliveryJobData {
  email: string;
  ipHash: string;
  userAgentHash?: string;
  requestIdHash?: string;
}
