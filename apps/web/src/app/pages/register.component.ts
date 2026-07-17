import { CommonModule } from "@angular/common";
import { Component, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { AuthService } from "../auth/auth.service";
import { LocaleService } from "../i18n/locale.service";
import { BrandLogoComponent } from "../shared/brand-logo.component";
import { PASSWORD_MIN_LENGTH } from "@kaklen/shared";
import { emailValidator, normalizeEmail, trimmedRequired } from "../shared/forms/form-validators";
import { FieldErrorComponent, FormControlA11yDirective, FormErrorSummaryComponent,   FormFieldComponent
} from "../shared/forms/form-feedback.components";
import { UiIconComponent } from "../shared/ui-icon.component";

interface RegisterForm {
  firstName: FormControl<string>;
  lastName: FormControl<string>;
  email: FormControl<string>;
  password: FormControl<string>;
}

@Component({
  selector: "kaklen-register",
  standalone: true,
  imports: [FormFieldComponent, CommonModule, ReactiveFormsModule, RouterLink, BrandLogoComponent, FieldErrorComponent, FormControlA11yDirective, FormErrorSummaryComponent, UiIconComponent],
  template: `
    <main class="auth-shell">
      <aside class="auth-brand-panel" aria-label="Kaklen">
        <kaklen-brand-logo variant="signature" />
        <div class="auth-brand-message">
          <span class="brand-rule" aria-hidden="true"></span>
          <p i18n="@@registerBrandPromise">Empieza simple. Crece con una operación ordenada.</p>
        </div>
      </aside>
      <section class="auth-panel" aria-labelledby="register-title">
        <ng-container *ngIf="!registered(); else confirmationState">
          <header class="auth-heading">
            <p class="eyebrow" i18n="@@registerEyebrow">Comienza con Kaklen</p>
            <h1 id="register-title" i18n="@@registerTitle">Crear cuenta</h1>
            <p i18n="@@registerDescription">Crea tu acceso. Después podrás configurar tu organización.</p>
          </header>

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <kaklen-form-error-summary [form]="form" [attempted]="submitAttempted()" [labels]="fieldLabels" />
            <div class="field-grid">
              <label kaklen-form-field label="Nombre" i18n-label="@@firstNameLabel" controlId="register-firstName" required="auto" invalid="auto">
                <input kaklenControl type="text" formControlName="firstName" autocomplete="given-name" maxlength="80" aria-describedby="register-first-name-error" />
                <kaklen-field-error id="register-first-name-error" [control]="form.controls.firstName" [attempted]="submitAttempted()" />
              </label>

              <label kaklen-form-field label="Apellido" i18n-label="@@lastNameLabel" controlId="register-lastName" required="auto" invalid="auto">
                <input kaklenControl type="text" formControlName="lastName" autocomplete="family-name" maxlength="80" aria-describedby="register-last-name-error" />
                <kaklen-field-error id="register-last-name-error" [control]="form.controls.lastName" [attempted]="submitAttempted()" />
              </label>
            </div>

            <label kaklen-form-field label="Email" i18n-label="@@emailLabel" controlId="register-email" required="auto" invalid="auto">
              <input kaklenControl type="email" formControlName="email" autocomplete="email" maxlength="254" inputmode="email" aria-describedby="register-email-error" />
              <kaklen-field-error id="register-email-error" [control]="form.controls.email" [attempted]="submitAttempted()" />
            </label>

            <label kaklen-form-field label="Contraseña" i18n-label="@@passwordLabel" controlId="register-password" required="auto" invalid="auto">
              <input kaklenControl type="password" formControlName="password" autocomplete="new-password" maxlength="128" aria-describedby="register-password-error" />
              <kaklen-field-error id="register-password-error" [control]="form.controls.password" [attempted]="submitAttempted()" [invalidMessage]="passwordErrorLabel" />
            </label>

            <p class="form-error" *ngIf="error()" role="alert">{{ error() }}</p>

            <button type="submit" [disabled]="loading()">
              <kaklen-icon name="user-plus" /><span>{{ submitLabel() }}</span>
            </button>
          </form>

          <p class="switch-link" i18n="@@registerSwitch">¿Ya tienes cuenta? <a routerLink="/login">Ingresa</a></p>
        </ng-container>

        <ng-template #confirmationState>
          <div class="auth-result" role="status" aria-live="polite">
            <span class="result-icon success" aria-hidden="true"><kaklen-icon name="mail" /></span>
            <p class="eyebrow" i18n="@@accountCreatedEyebrow">Cuenta creada</p>
            <h1 id="register-title" i18n="@@registerCheckEmailTitle">Revisa tu correo</h1>
            <p i18n="@@registerCheckEmailDescription">Creamos tu cuenta, pero debes confirmar tu dirección antes de iniciar sesión.</p>
            <p class="form-success" *ngIf="resendMessage()">{{ resendMessage() }}</p>
            <p class="form-error" *ngIf="error()" role="alert">{{ error() }}</p>
            <div class="auth-result-actions">
              <a class="button-link" routerLink="/login" i18n="@@openLoginAction">Abrir inicio de sesión</a>
              <button type="button" class="secondary" [disabled]="resending()" (click)="resend()">{{ resendLabel() }}</button>
              <button type="button" class="ghost" (click)="changeEmail()" i18n="@@changeRegistrationEmailAction">Cambiar correo</button>
            </div>
          </div>
        </ng-template>
      </section>
    </main>
  `
})
export class RegisterComponent {
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly resendMessage = signal<string | null>(null);
  readonly registered = signal(false);
  readonly registeredEmail = signal("");
  readonly resending = signal(false);
  readonly submitAttempted = signal(false);
  readonly passwordErrorLabel = $localize`:@@passwordValidation:La contraseña debe tener al menos 10 caracteres.`;
  readonly fieldLabels = {
    firstName: $localize`:@@firstNameLabel:Nombre`,
    lastName: $localize`:@@lastNameLabel:Apellido`,
    email: $localize`:@@emailLabel:Email`,
    password: $localize`:@@passwordLabel:Contraseña`
  };
  readonly form = new FormGroup<RegisterForm>({
    firstName: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, trimmedRequired(), Validators.maxLength(80)]
    }),
    lastName: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, trimmedRequired(), Validators.maxLength(80)]
    }),
    email: new FormControl("", {
      nonNullable: true,
      validators: [emailValidator(true)]
    }),
    password: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH), Validators.maxLength(128)]
    })
  });

  constructor(
    private readonly authService: AuthService,
    private readonly localeService: LocaleService
  ) {}

  async submit(): Promise<void> {
    this.submitAttempted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const value = this.form.getRawValue();
      await this.authService.register({
        ...value,
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim(),
        email: normalizeEmail(value.email),
        locale: this.localeService.getLocale()
      });
      this.registeredEmail.set(normalizeEmail(value.email));
      this.registered.set(true);
    } catch {
      this.error.set($localize`:@@registerError:No fue posible crear la cuenta con esas credenciales.`);
    } finally {
      this.loading.set(false);
    }
  }

  submitLabel(): string {
    return this.loading() ? $localize`:@@registerSubmitting:Creando...` : $localize`:@@registerSubmit:Crear cuenta`;
  }

  async resend(): Promise<void> {
    if (this.resending() || !this.registeredEmail()) return;
    this.resending.set(true);
    this.error.set(null);
    this.resendMessage.set(null);
    try {
      await this.authService.resendVerificationEmail({ email: this.registeredEmail() });
      this.resendMessage.set($localize`:@@verificationResentMessage:Si tu cuenta sigue pendiente, enviamos un nuevo correo de confirmación.`);
    } catch {
      this.error.set($localize`:@@verificationResendError:No pudimos solicitar el reenvío. Intenta nuevamente.`);
    } finally {
      this.resending.set(false);
    }
  }

  changeEmail(): void {
    this.registered.set(false);
    this.resendMessage.set(null);
    this.error.set(null);
    this.submitAttempted.set(false);
  }

  resendLabel(): string {
    return this.resending()
      ? $localize`:@@verificationResendingLabel:Enviando...`
      : $localize`:@@resendVerificationAction:Reenviar correo de confirmación`;
  }
}
