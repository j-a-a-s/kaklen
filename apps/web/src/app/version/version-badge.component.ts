import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Output } from "@angular/core";
import { VersionService } from "./version.service";

@Component({
  selector: "kaklen-version-badge",
  standalone: true,
  imports: [CommonModule],
  template: `
    <section
      class="version-panel"
      role="status"
      aria-live="polite"
      aria-label="Información de versión de Kaklen"
      i18n-aria-label="@@versionPanelAriaLabel"
    >
      <div class="version-panel-header">
        <div class="version-panel-title">
          <span class="version-kicker" i18n="@@versionLabel">Versión</span>
          <strong>{{ version.displayVersion() }}</strong>
        </div>
        <button
          type="button"
          class="version-close-button"
          (click)="closed.emit()"
          aria-label="Cerrar información de versión"
          i18n-aria-label="@@closeVersionInfoLabel"
        >
          ×
        </button>
      </div>

      <p *ngIf="version.unavailable()" class="version-unavailable">{{ unavailableLabel }}</p>

      <dl>
        <div>
          <dt i18n="@@commitLabel">Commit</dt>
          <dd>{{ version.displayCommitSha() }}</dd>
        </div>
        <div>
          <dt i18n="@@buildTimeLabel">Compilado</dt>
          <dd>{{ version.displayBuildTimeValue() }}</dd>
        </div>
        <div>
          <dt i18n="@@environmentLabel">Entorno</dt>
          <dd>{{ version.displayEnvironment() }}</dd>
        </div>
      </dl>
    </section>
  `
})
export class VersionBadgeComponent {
  @Output() readonly closed = new EventEmitter<void>();
  readonly unavailableLabel = $localize`:@@versionUnavailable:Versión no disponible`;

  constructor(readonly version: VersionService) {}
}
