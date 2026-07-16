import { CommonModule } from "@angular/common";
import { Component, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { AuthService } from "../auth/auth.service";
import { BrandLogoComponent } from "../shared/brand-logo.component";
import { PASSWORD_MIN_LENGTH } from "@kaklen/shared";
import { emailValidator, normalizeEmail, trimmedRequired } from "../shared/forms/form-validators";
import { FieldErrorComponent, FormErrorSummaryComponent, RequiredFieldIndicatorComponent } from "../shared/forms/form-feedback.components";
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
  imports: [CommonModule, ReactiveFormsModule, RouterLink, BrandLogoComponent, FieldErrorComponent, FormErrorSummaryComponent, RequiredFieldIndicatorComponent, UiIconComponent],
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
        <header class="auth-heading">
          <p class="eyebrow" i18n="@@registerEyebrow">Comienza con Kaklen</p>
          <h1 id="register-title" i18n="@@registerTitle">Crear cuenta</h1>
          <p i18n="@@registerDescription">Crea tu acceso. Después podrás configurar tu organización.</p>
        </header>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <kaklen-form-error-summary [form]="form" [submitted]="submitAttempted()" [labels]="fieldLabels" />
          <div class="field-grid">
            <label>
              <span><span i18n="@@firstNameLabel">Nombre</span><kaklen-required /></span>
              <input type="text" formControlName="firstName" autocomplete="given-name" maxlength="80" aria-describedby="register-first-name-error" />
              <kaklen-field-error id="register-first-name-error" [control]="form.controls.firstName" [submitted]="submitAttempted()" />
            </label>

            <label>
              <span><span i18n="@@lastNameLabel">Apellido</span><kaklen-required /></span>
              <input type="text" formControlName="lastName" autocomplete="family-name" maxlength="80" aria-describedby="register-last-name-error" />
              <kaklen-field-error id="register-last-name-error" [control]="form.controls.lastName" [submitted]="submitAttempted()" />
            </label>
          </div>

          <label>
            <span><span i18n="@@emailLabel">Email</span><kaklen-required /></span>
            <input type="email" formControlName="email" autocomplete="email" maxlength="254" inputmode="email" aria-describedby="register-email-error" />
            <kaklen-field-error id="register-email-error" [control]="form.controls.email" [submitted]="submitAttempted()" />
          </label>

          <label>
            <span><span i18n="@@passwordLabel">Contraseña</span><kaklen-required /></span>
            <input type="password" formControlName="password" autocomplete="new-password" aria-describedby="register-password-error" />
            <kaklen-field-error id="register-password-error" [control]="form.controls.password" [submitted]="submitAttempted()" [invalidMessage]="passwordErrorLabel" />
          </label>

          <p class="form-error" *ngIf="error()">{{ error() }}</p>

          <button type="submit" [disabled]="loading()">
            <kaklen-icon name="user-plus" /><span>{{ submitLabel() }}</span>
          </button>
        </form>

        <p class="switch-link" i18n="@@registerSwitch">¿Ya tienes cuenta? <a routerLink="/login">Ingresa</a></p>
      </section>
    </main>
  `
})
export class RegisterComponent {
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
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
    private readonly router: Router
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
        email: normalizeEmail(value.email)
      });
      await this.router.navigateByUrl("/dashboard");
    } catch {
      this.error.set($localize`:@@registerError:No fue posible crear la cuenta con esas credenciales.`);
    } finally {
      this.loading.set(false);
    }
  }

  submitLabel(): string {
    return this.loading() ? $localize`:@@registerSubmitting:Creando...` : $localize`:@@registerSubmit:Crear cuenta`;
  }
}
