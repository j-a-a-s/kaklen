import { Injectable } from "@angular/core";
import { RUNTIME_CONFIG } from "../config/runtime-config";

export type ProductAnalyticsEvent =
  | "onboarding_started"
  | "onboarding_step_completed"
  | "first_client_created"
  | "first_catalog_item_created"
  | "first_quotation_created"
  | "first_quotation_approved"
  | "first_event_created"
  | "command_palette_opened"
  | "global_search_used"
  | "wizard_abandoned"
  | "wizard_completed";

export interface ProductAnalyticsContext {
  flow?: "onboarding" | "client" | "quotation" | "event" | "command_palette";
  step?: string;
  source?: "dashboard" | "navigation" | "quick_action" | "detail";
}

@Injectable({ providedIn: "root" })
export class ProductAnalyticsService {
  track(event: ProductAnalyticsEvent, context: ProductAnalyticsContext = {}): void {
    if (RUNTIME_CONFIG.environment === "development") {
      console.info(JSON.stringify({ type: "product_analytics", event, context, occurredAt: new Date().toISOString() }));
    }
  }
}
