import { Component, Input } from "@angular/core";

@Component({
  selector: "kaklen-empty-state",
  standalone: true,
  template: `
    <section class="empty-state" role="status">
      <span class="empty-state-icon" aria-hidden="true">{{ icon }}</span>
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
  @Input() icon = "+";
}
