import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { GlobalBusyService } from "./global-busy.service";

@Component({
  selector: "kaklen-global-busy",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="busy.visible()"
      class="global-busy-indicator"
      role="status"
      aria-live="polite"
      i18n="@@globalBusyLabel"
    >
      Procesando
    </div>
  `
})
export class GlobalBusyIndicatorComponent {
  constructor(readonly busy: GlobalBusyService) {}
}
