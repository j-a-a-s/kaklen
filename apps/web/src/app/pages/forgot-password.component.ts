import { CommonModule } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { TimeoutError } from "rxjs";
import { AuthService } from "../auth/auth.service";
import { BrandLogoComponent } from "../shared/brand-logo.component";

interface ForgotPasswordForm {
  email: FormControl<string>;
}

@Component({
  selector: "kaklen-forgot-password",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, BrandLogoComponent],
  template: `
    <main class="auth-shell">
      <aside class="auth-brand-panel" aria-label="Kaklen">
        <kaklen-brand-logo variant="signature" />
        <div class="auth-brand-message">
          <span class="brand-rule" aria-hidden="true"></span>
          <p i18n="@@recoveryBrandPromise">Recupera el acceso de forma segura.</p>
        </div>
      </aside>
      <section class="auth-panel" aria-labelledby="forgot-password-title">
        <ng-container *ngIf="!sent(); else successState">
          <header class="auth-heading">
            <p class="eyebrow" i18n="@@forgotPasswordEyebrow">Recuperación de acceso</p>
            <h1 id="forgot-password-title" i18n="@@forgotPasswordTitle">Recupera tu cuenta</h1>
            <p i18n="@@forgotPasswordDescription">
              Ingresa el correo asociado a tu cuenta. Si existe, te enviaremos instrucciones.
            </p>
          </header>

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <label>
              <span i18n="@@emailLabel">Email</span>
              <input type="email" formControlName="email" autocomplete="email" />
              <small *ngIf="form.controls.email.touched && form.controls.email.invalid" i18n="@@emailValidation">
                Ingresa un email válido.
              </small>
            </label>

            <p class="form-error" *ngIf="error()" role="alert">{{ error() }}</p>

            <button type="submit" [disabled]="form.invalid || loading()">
              <span>{{ submitLabel() }}</span>
              <span aria-hidden="true">→</span>
            </button>
          </form>

          <p class="switch-link"><a routerLink="/login" i18n="@@backToLogin">Volver al inicio de sesión</a></p>
        </ng-container>

        <ng-template #successState>
          <div class="auth-result" role="status" aria-live="polite">
            <span class="result-icon success" aria-hidden="true">✓</span>
            <p class="eyebrow" i18n="@@forgotPasswordSentEyebrow">Instrucciones enviadas</p>
            <h1 i18n="@@checkYourEmailTitle">Revisa tu correo</h1>
            <p i18n="@@checkYourEmailDescription">
              Si existe una cuenta asociada a ese correo, recibirás un enlace válido por 30 minutos.
            </p>
            <a class="button-link" routerLink="/login" i18n="@@backToLogin">Volver al inicio de sesión</a>
          </div>
        </ng-template>
      </section>
    </main>
  `
})
export class ForgotPasswordComponent {
  readonly loading = signal(false);
  readonly sent = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = new FormGroup<ForgotPasswordForm>({
    email: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.email]
    })
  });

  constructor(private readonly authService: AuthService) {}

  async submit(): Promise<void> {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    try {
      await this.authService.forgotPassword(this.form.getRawValue());
      this.sent.set(true);
    } catch (error) {
      this.error.set(recoveryRequestError(error));
    } finally {
      this.loading.set(false);
    }
  }

  submitLabel(): string {
    return this.loading()
      ? $localize`:@@sendingInstructionsLabel:Enviando...`
      : $localize`:@@sendInstructionsLabel:Enviar instrucciones`;
  }
}

export function recoveryRequestError(error: unknown): string {
  if (error instanceof TimeoutError) {
    return $localize`:@@recoveryServerTimeout:El servidor está tardando demasiado.`;
  }
  if (error instanceof HttpErrorResponse && error.status === 0) {
    return $localize`:@@recoveryServerUnavailable:No pudimos conectar con el servidor. Intenta nuevamente.`;
  }
  return $localize`:@@recoveryRequestFailed:No pudimos enviar las instrucciones. Intenta nuevamente.`;
}
