import { CommonModule } from "@angular/common";
import { Component, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { AuthService } from "../auth/auth.service";
import { BrandLogoComponent } from "../shared/brand-logo.component";
import { emailValidator, normalizeEmail } from "../shared/forms/form-validators";
import { FieldErrorComponent, FormControlA11yDirective, FormErrorSummaryComponent,   FormFieldComponent
} from "../shared/forms/form-feedback.components";
import { UiIconComponent } from "../shared/ui-icon.component";

@Component({
  selector: "kaklen-resend-verification",
  standalone: true,
  imports: [FormFieldComponent, CommonModule, ReactiveFormsModule, RouterLink, BrandLogoComponent, FieldErrorComponent, FormControlA11yDirective, FormErrorSummaryComponent, UiIconComponent],
  template: `
    <main class="auth-shell">
      <aside class="auth-brand-panel" aria-label="Kaklen">
        <kaklen-brand-logo variant="signature" />
        <div class="auth-brand-message">
          <span class="brand-rule" aria-hidden="true"></span>
          <p i18n="@@verificationBrandPromise">Confirma tu identidad para proteger tu cuenta.</p>
        </div>
      </aside>
      <section class="auth-panel" aria-labelledby="resend-title">
        <ng-container *ngIf="!sent(); else successState">
          <header class="auth-heading">
            <p class="eyebrow" i18n="@@resendVerificationEyebrow">Confirmación de cuenta</p>
            <h1 id="resend-title" i18n="@@resendVerificationTitle">Reenviar correo de confirmación</h1>
            <p i18n="@@resendVerificationDescription">Ingresa tu correo. Si la cuenta sigue pendiente, enviaremos un nuevo enlace.</p>
          </header>
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <kaklen-form-error-summary [form]="form" [attempted]="submitAttempted()" [labels]="fieldLabels" />
            <label kaklen-form-field label="Email" i18n-label="@@emailLabel" controlId="resend-verification-email" required="auto" invalid="auto">
              <input kaklenControl type="email" formControlName="email" autocomplete="email" maxlength="254" inputmode="email" aria-describedby="resend-email-error" />
              <kaklen-field-error id="resend-email-error" [control]="form.controls.email" [attempted]="submitAttempted()" />
            </label>
            <p class="form-error" *ngIf="error()" role="alert">{{ error() }}</p>
            <button type="submit" [disabled]="loading()"><kaklen-icon name="mail" /><span>{{ submitLabel() }}</span></button>
          </form>
          <p class="switch-link"><a routerLink="/login" i18n="@@backToLogin">Volver al inicio de sesión</a></p>
        </ng-container>
        <ng-template #successState>
          <div class="auth-result" role="status" aria-live="polite">
            <span class="result-icon success" aria-hidden="true"><kaklen-icon name="check-circle" /></span>
            <p class="eyebrow" i18n="@@verificationRequestReceivedEyebrow">Solicitud recibida</p>
            <h1 i18n="@@registerCheckEmailTitle">Revisa tu correo</h1>
            <p i18n="@@resendVerificationSuccess">Si la cuenta requiere confirmación, recibirás un nuevo enlace.</p>
            <a class="button-link" routerLink="/login" i18n="@@openLoginAction">Abrir inicio de sesión</a>
          </div>
        </ng-template>
      </section>
    </main>
  `
})
export class ResendVerificationComponent {
  readonly loading = signal(false);
  readonly sent = signal(false);
  readonly error = signal<string | null>(null);
  readonly submitAttempted = signal(false);
  readonly fieldLabels = { email: $localize`:@@emailLabel:Email` };
  readonly form = new FormGroup({
    email: new FormControl("", { nonNullable: true, validators: [emailValidator(true)] })
  });

  constructor(private readonly authService: AuthService) {}

  async submit(): Promise<void> {
    this.submitAttempted.set(true);
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.authService.resendVerificationEmail({
        email: normalizeEmail(this.form.controls.email.value)
      });
      this.sent.set(true);
    } catch {
      this.error.set($localize`:@@verificationResendError:No pudimos solicitar el reenvío. Intenta nuevamente.`);
    } finally {
      this.loading.set(false);
    }
  }

  submitLabel(): string {
    return this.loading()
      ? $localize`:@@verificationResendingLabel:Enviando...`
      : $localize`:@@resendVerificationAction:Reenviar correo de confirmación`;
  }
}
