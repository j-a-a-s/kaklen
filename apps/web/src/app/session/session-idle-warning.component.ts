import { CommonModule } from "@angular/common";
import { Component, ElementRef, ViewChild, effect } from "@angular/core";
import { SessionIdleService } from "./session-idle.service";
import { UiIconComponent } from "../shared/ui-icon.component";

@Component({
  selector: "kaklen-session-idle-warning",
  standalone: true,
  imports: [CommonModule, UiIconComponent],
  template: `
    <div *ngIf="idle.warningVisible()" class="modal-backdrop session-warning-backdrop">
      <section class="confirmation-dialog session-warning" role="alertdialog" aria-modal="true" aria-labelledby="session-warning-title" aria-describedby="session-warning-description">
        <span class="confirmation-icon warning" aria-hidden="true"><kaklen-icon name="clock" /></span>
        <h2 id="session-warning-title" i18n="@@sessionExpiringTitle">Tu sesión está por expirar</h2>
        <p id="session-warning-description" i18n="@@sessionExpiringDescription">Por seguridad cerraremos la sesión si no detectamos actividad.</p>
        <strong class="session-countdown" aria-live="assertive">{{ idle.formattedCountdown() }}</strong>
        <div class="row-actions">
          <button #continueButton type="button" class="success" (click)="idle.continueWorking()" i18n="@@continueWorkingButton">Continuar trabajando</button>
          <button type="button" class="secondary" (click)="logout()" i18n="@@logoutNowButton">Cerrar sesión ahora</button>
        </div>
      </section>
    </div>
  `
})
export class SessionIdleWarningComponent {
  @ViewChild("continueButton") private continueButton?: ElementRef<HTMLButtonElement>;

  constructor(readonly idle: SessionIdleService) {
    effect(() => {
      if (idle.warningVisible()) {
        window.setTimeout(() => this.continueButton?.nativeElement.focus(), 0);
      }
    });
  }

  logout(): void {
    void this.idle.logoutNow("manual");
  }
}
