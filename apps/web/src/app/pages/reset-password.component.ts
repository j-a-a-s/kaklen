import { CommonModule } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { PASSWORD_MIN_LENGTH, passwordStrength, type PasswordStrength } from "@kaklen/shared";
import { TimeoutError } from "rxjs";
import { AuthService } from "../auth/auth.service";
import { BrandLogoComponent } from "../shared/brand-logo.component";
import { FieldErrorComponent, FormErrorSummaryComponent, RequiredFieldIndicatorComponent } from "../shared/forms/form-feedback.components";
import { UiIconComponent } from "../shared/ui-icon.component";

interface ResetPasswordForm {
  password: FormControl<string>;
  confirmPassword: FormControl<string>;
}

type ResetPasswordState = "form" | "missing" | "invalid" | "expired" | "used" | "network" | "success";

@Component({
  selector: "kaklen-reset-password",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, BrandLogoComponent, FieldErrorComponent, FormErrorSummaryComponent, RequiredFieldIndicatorComponent, UiIconComponent],
  template: `
    <main class="auth-shell">
      <aside class="auth-brand-panel" aria-label="Kaklen">
        <kaklen-brand-logo variant="signature" />
        <div class="auth-brand-message">
          <span class="brand-rule" aria-hidden="true"></span>
          <p i18n="@@resetBrandPromise">Protege tu cuenta con una nueva contraseña.</p>
        </div>
      </aside>
      <section class="auth-panel" aria-labelledby="reset-password-title">
        <ng-container [ngSwitch]="state()">
          <ng-container *ngSwitchCase="'form'">
            <header class="auth-heading">
              <p class="eyebrow" i18n="@@resetPasswordEyebrow">Recuperación de acceso</p>
              <h1 id="reset-password-title" i18n="@@resetPasswordTitle">Crea una nueva contraseña</h1>
              <p i18n="@@resetPasswordDescription">Elige una contraseña distinta a la que utilizabas antes.</p>
            </header>

            <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
              <kaklen-form-error-summary [form]="form" [submitted]="submitAttempted()" [labels]="fieldLabels" />
              <label>
                <span><span i18n="@@newPasswordLabel">Nueva contraseña</span><kaklen-required /></span>
                <span class="password-input-wrap">
                  <input
                    [type]="passwordVisible() ? 'text' : 'password'"
                    formControlName="password"
                    autocomplete="new-password"
                    maxlength="128"
                    aria-required="true"
                    aria-describedby="reset-password-error password-requirements"
                  />
                  <button
                    type="button"
                    class="password-visibility-button"
                    (click)="togglePasswordVisibility()"
                    [attr.aria-pressed]="passwordVisible()"
                  >{{ visibilityLabel() }}</button>
                </span>
                <kaklen-field-error id="reset-password-error" [control]="form.controls.password" [submitted]="submitAttempted()" [invalidMessage]="passwordValidationLabel" />
              </label>

              <div class="password-strength" [attr.data-strength]="strength()" aria-live="polite">
                <span i18n="@@passwordStrengthLabel">Fortaleza</span>
                <strong>{{ strengthLabel() }}</strong>
                <span class="strength-track" aria-hidden="true"><span></span></span>
              </div>
              <p id="password-requirements" class="form-help" i18n="@@passwordRequirements">
                Usa al menos 10 caracteres y evita tu nombre, correo o contraseña anterior.
              </p>

              <label>
                <span><span i18n="@@confirmNewPasswordLabel">Confirmar contraseña</span><kaklen-required /></span>
                <input
                  [type]="passwordVisible() ? 'text' : 'password'"
                  formControlName="confirmPassword"
                  autocomplete="new-password"
                  maxlength="128"
                  aria-required="true"
                  aria-describedby="reset-confirm-password-error"
                />
                <kaklen-field-error id="reset-confirm-password-error" [control]="form.controls.confirmPassword" [submitted]="submitAttempted()" [invalidMessage]="passwordValidationLabel" />
                <small class="field-error"
                  *ngIf="form.controls.confirmPassword.touched && !passwordsMatch()"
                  i18n="@@passwordConfirmationValidation"
                >Las contraseñas deben coincidir.</small>
              </label>

              <p class="form-error" *ngIf="error()" role="alert">{{ error() }}</p>

              <button type="submit" [disabled]="loading()">
                <kaklen-icon name="check" /><span>{{ submitLabel() }}</span>
              </button>
            </form>

            <p class="switch-link"><a routerLink="/login" i18n="@@backToLogin">Volver al inicio de sesión</a></p>
          </ng-container>

          <div *ngSwitchCase="'success'" class="auth-result" role="status" aria-live="polite">
            <span class="result-icon success" aria-hidden="true"><kaklen-icon name="check-circle" /></span>
            <p class="eyebrow" i18n="@@resetCompleteEyebrow">Acceso recuperado</p>
            <h1 i18n="@@passwordUpdatedTitle">Contraseña actualizada</h1>
            <p i18n="@@passwordUpdatedDescription">Ya puedes iniciar sesión con tu nueva contraseña.</p>
            <a class="button-link" routerLink="/login" i18n="@@signInAction">Iniciar sesión</a>
          </div>

          <div *ngSwitchCase="'expired'" class="auth-result" role="alert">
            <span class="result-icon warning" aria-hidden="true">!</span>
            <h1 i18n="@@expiredTokenTitle">Enlace vencido</h1>
            <p i18n="@@expiredTokenMessage">Este enlace ya venció. Solicita uno nuevo.</p>
            <a class="button-link" routerLink="/forgot-password" i18n="@@requestAnotherLink">Solicitar otro enlace</a>
          </div>

          <div *ngSwitchCase="'used'" class="auth-result" role="alert">
            <span class="result-icon warning" aria-hidden="true">!</span>
            <h1 i18n="@@usedTokenTitle">Enlace utilizado</h1>
            <p i18n="@@usedTokenMessage">Este enlace ya fue utilizado. Puedes iniciar sesión o solicitar otro.</p>
            <a class="button-link" routerLink="/login" i18n="@@signInAction">Iniciar sesión</a>
            <a class="secondary-result-link" routerLink="/forgot-password" i18n="@@requestAnotherLink">Solicitar otro enlace</a>
          </div>

          <div *ngSwitchCase="'network'" class="auth-result" role="alert">
            <span class="result-icon warning" aria-hidden="true">!</span>
            <h1 i18n="@@networkErrorTitle">Sin conexión con el servidor</h1>
            <p i18n="@@recoveryServerUnavailable">No pudimos conectar con el servidor. Intenta nuevamente.</p>
            <button type="button" (click)="retry()" i18n="@@tryAgainAction">Intentar nuevamente</button>
          </div>

          <div *ngSwitchDefault class="auth-result" role="alert">
            <span class="result-icon warning" aria-hidden="true">!</span>
            <h1>{{ invalidStateTitle() }}</h1>
            <p>{{ invalidStateMessage() }}</p>
            <a class="button-link" routerLink="/forgot-password" i18n="@@requestAnotherLink">Solicitar otro enlace</a>
            <a class="secondary-result-link" routerLink="/login" i18n="@@backToLogin">Volver al inicio de sesión</a>
          </div>
        </ng-container>
      </section>
    </main>
  `
})
export class ResetPasswordComponent {
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly passwordVisible = signal(false);
  readonly submitAttempted = signal(false);
  readonly passwordValidationLabel = $localize`:@@passwordValidation:La contraseña debe tener al menos 10 caracteres.`;
  readonly fieldLabels = {
    password: $localize`:@@newPasswordLabel:Nueva contraseña`,
    confirmPassword: $localize`:@@confirmNewPasswordLabel:Confirmar contraseña`
  };
  readonly token: string | null;
  readonly state = signal<ResetPasswordState>("missing");
  readonly form = new FormGroup<ResetPasswordForm>({
    password: new FormControl("", {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(PASSWORD_MIN_LENGTH),
        Validators.maxLength(128)
      ]
    }),
    confirmPassword: new FormControl("", {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(PASSWORD_MIN_LENGTH),
        Validators.maxLength(128)
      ]
    })
  });

  constructor(
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {
    this.token = this.route.snapshot.queryParamMap.get("token");
    this.state.set(this.token ? "form" : "missing");
  }

  strength(): PasswordStrength {
    return passwordStrength(this.form.controls.password.value);
  }

  strengthLabel(): string {
    const labels: Record<PasswordStrength, string> = {
      weak: $localize`:@@passwordStrengthWeak:Débil`,
      acceptable: $localize`:@@passwordStrengthAcceptable:Aceptable`,
      strong: $localize`:@@passwordStrengthStrong:Fuerte`
    };
    return labels[this.strength()];
  }

  passwordsMatch(): boolean {
    return this.form.controls.password.value === this.form.controls.confirmPassword.value;
  }

  togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  visibilityLabel(): string {
    return this.passwordVisible()
      ? $localize`:@@hidePasswordAction:Ocultar`
      : $localize`:@@showPasswordAction:Mostrar`;
  }

  async submit(): Promise<void> {
    this.submitAttempted.set(true);
    if (!this.token) {
      this.state.set("missing");
      return;
    }
    if (this.form.invalid || !this.passwordsMatch() || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    try {
      await this.authService.resetPassword({ token: this.token, ...this.form.getRawValue() });
      this.state.set("success");
      await this.router.navigate([], { queryParams: {}, replaceUrl: true });
    } catch (error) {
      const result = resetErrorState(error);
      if (result.state === "form") {
        this.error.set(result.message);
      } else {
        this.state.set(result.state);
      }
    } finally {
      this.loading.set(false);
    }
  }

  retry(): void {
    this.error.set(null);
    this.state.set(this.token ? "form" : "missing");
  }

  submitLabel(): string {
    return this.loading()
      ? $localize`:@@resettingPasswordLabel:Actualizando...`
      : $localize`:@@resetPasswordAction:Restablecer contraseña`;
  }

  invalidStateTitle(): string {
    return this.state() === "missing"
      ? $localize`:@@missingTokenTitle:Falta el enlace de recuperación`
      : $localize`:@@invalidTokenTitle:Enlace no válido`;
  }

  invalidStateMessage(): string {
    return this.state() === "missing"
      ? $localize`:@@missingTokenMessage:Abre el enlace completo que recibiste por correo.`
      : $localize`:@@invalidTokenMessage:Este enlace no es válido.`;
  }
}

interface ResetErrorResult {
  state: ResetPasswordState;
  message: string | null;
}

export function resetErrorState(error: unknown): ResetErrorResult {
  if (error instanceof TimeoutError) {
    return {
      state: "form",
      message: $localize`:@@recoveryServerTimeout:El servidor está tardando demasiado.`
    };
  }
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return { state: "network", message: null };
    }
    const code = backendErrorCode(error);
    if (code === "PASSWORD_RESET_TOKEN_EXPIRED") return { state: "expired", message: null };
    if (code === "PASSWORD_RESET_TOKEN_USED") return { state: "used", message: null };
    if (code === "PASSWORD_RESET_TOKEN_INVALID" || code === "PASSWORD_RESET_TOKEN_REVOKED") {
      return { state: "invalid", message: null };
    }
    if (code === "PASSWORD_MISMATCH") {
      return {
        state: "form",
        message: $localize`:@@passwordConfirmationValidation:Las contraseñas deben coincidir.`
      };
    }
    if (code === "PASSWORD_REUSE") {
      return {
        state: "form",
        message: $localize`:@@passwordReuseError:Elige una contraseña distinta a la anterior.`
      };
    }
    if (code === "PASSWORD_POLICY") {
      return {
        state: "form",
        message: $localize`:@@passwordPolicyError:La contraseña no cumple los requisitos de seguridad.`
      };
    }
    if (code === "TOO_MANY_REQUESTS") {
      return {
        state: "form",
        message: $localize`:@@passwordResetRateLimit:Demasiados intentos. Espera unos minutos.`
      };
    }
  }
  return {
    state: "form",
    message: $localize`:@@passwordResetFailed:No pudimos actualizar la contraseña. Intenta nuevamente.`
  };
}

function backendErrorCode(error: HttpErrorResponse): string {
  const body: unknown = error.error;
  return body && typeof body === "object" && "code" in body && typeof body.code === "string"
    ? body.code
    : "";
}
