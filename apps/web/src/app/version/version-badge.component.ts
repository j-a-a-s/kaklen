import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { VersionService } from "./version.service";

@Component({
  selector: "kaklen-version-badge",
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="version-badge" aria-label="Versión de Kaklen" i18n-aria-label="@@versionBadgeAriaLabel">
      <span>{{ version.displayVersion() }}</span>
      <span>{{ version.displayCommit() }}</span>
      <small>{{ version.unavailable() ? unavailableLabel : version.displayBuildTime() }}</small>
    </section>
  `
})
export class VersionBadgeComponent implements OnInit {
  readonly unavailableLabel = $localize`:@@versionUnavailable:Versión no disponible`;

  constructor(readonly version: VersionService) {}

  ngOnInit(): void {
    this.version.start();
  }
}
