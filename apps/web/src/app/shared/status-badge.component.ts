import { Component, Input } from "@angular/core";

@Component({
  selector: "kaklen-status-badge",
  standalone: true,
  template: `<span class="status-badge" [attr.data-status]="status">{{ label }}</span>`
})
export class StatusBadgeComponent {
  @Input({ required: true }) status = "";
  @Input({ required: true }) label = "";
}
