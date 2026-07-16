import { Component, Input } from "@angular/core";
import { UiIconComponent, UiIconName } from "./ui-icon.component";

@Component({
  selector: "kaklen-empty-state",
  standalone: true,
  imports: [UiIconComponent],
  template: `
    <section class="empty-state" role="status">
      <span class="empty-state-icon" aria-hidden="true"><kaklen-icon [name]="icon" [size]="28" /></span>
      <div class="empty-state-copy">
        <h2>{{ title }}</h2>
        <p>{{ description }}</p>
      </div>
      <div class="empty-state-action">
        <ng-content />
      </div>
    </section>
  `
})
export class EmptyStateComponent {
  @Input({ required: true }) title = "";
  @Input({ required: true }) description = "";
  @Input() icon: UiIconName = "plus";
}
