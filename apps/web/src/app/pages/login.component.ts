import { CommonModule } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, HostListener, OnDestroy, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { TimeoutError } from "rxjs";
import { PASSWORD_MIN_LENGTH } from "@kaklen/shared";
import { AuthService } from "../auth/auth.service";
import { BrandLogoComponent } from "../shared/brand-logo.component";
import { KeyboardSequenceService } from "../shared/keyboard-sequence.service";
import { VersionBadgeComponent } from "../version/version-badge.component";
import { VersionService } from "../version/version.service";
import { emailValidator, normalizeEmail } from "../shared/forms/form-validators";
import { FieldErrorComponent, FormErrorSummaryComponent, RequiredFieldIndicatorComponent } from "../shared/forms/form-feedback.components";
import { UiIconComponent } from "../shared/ui-icon.component";

interface LoginForm {
  email: FormControl<string>;
  password: FormControl<string>;
}

@Component({
  selector: "kaklen-login",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, VersionBadgeComponent, BrandLogoComponent, FieldErrorComponent, FormErrorSummaryComponent, RequiredFieldIndicatorComponent, UiIconComponent],
  template: `
    <main class="auth-shell">
      <aside class="auth-brand-panel" aria-label="Kaklen">
        <kaklen-brand-logo variant="signature" />
        <div class="auth-brand-message">
          <span class="brand-rule" aria-hidden="true"></span>
          <p i18n="@@authBrandPromise">Tu operación, clara y bajo control.</p>
        </div>
      </aside>
      <section class="auth-panel" aria-labelledby="login-title">
        <header class="auth-heading">
          <p class="eyebrow" i18n="@@loginEyebrow">Bienvenido de vuelta</p>
          <h1 id="login-title" i18n="@@loginTitle">Iniciar sesión</h1>
          <p i18n="@@loginDescription">Accede a tu espacio de trabajo para continuar.</p>
        </header>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <kaklen-form-error-summary [form]="form" [submitted]="submitAttempted()" [labels]="fieldLabels" />
          <label>
            <span><span i18n="@@emailLabel">Email</span><kaklen-required /></span>
            <input type="email" formControlName="email" autocomplete="email" maxlength="254" inputmode="email" aria-describedby="login-email-error" />
            <kaklen-field-error id="login-email-error" [control]="form.controls.email" [submitted]="submitAttempted()" />
          </label>

          <label>
            <span><span i18n="@@passwordLabel">Contraseña</span><kaklen-required /></span>
            <input type="password" formControlName="password" autocomplete="current-password" aria-describedby="login-password-error" />
            <kaklen-field-error id="login-password-error" [control]="form.controls.password" [submitted]="submitAttempted()" [invalidMessage]="passwordErrorLabel" />
          </label>

          <div class="password-help-link">
            <a routerLink="/forgot-password" i18n="@@forgotPasswordLink">¿Olvidaste tu contraseña?</a>
          </div>

          <p class="form-error" *ngIf="error()">{{ error() }}</p>

          <button type="submit" [disabled]="loading()">
            <kaklen-icon name="log-in" /><span>{{ submitLabel() }}</span>
          </button>
        </form>

        <p class="switch-link" i18n="@@loginSwitch">¿Aún no tienes cuenta? <a routerLink="/register">Crea una</a></p>
        <kaklen-version-badge *ngIf="versionPanelVisible()" (closed)="hideVersionPanel()" />
      </section>
    </main>
  `
})
export class LoginComponent implements OnInit, OnDestroy {
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly submitAttempted = signal(false);
  readonly versionPanelVisible = signal(false);
  readonly passwordErrorLabel = $localize`:@@passwordValidation:La contraseña debe tener al menos 10 caracteres.`;
  readonly fieldLabels = {
    email: $localize`:@@emailLabel:Email`,
    password: $localize`:@@passwordLabel:Contraseña`
  };
  readonly form = new FormGroup<LoginForm>({
    email: new FormControl("", {
      nonNullable: true,
      validators: [emailValidator(true)]
    }),
    password: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)]
    })
  });

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly keyboardSequence: KeyboardSequenceService,
    private readonly versionService: VersionService
  ) {}

  private stopVersionShortcut: (() => void) | null = null;

  ngOnInit(): void {
    this.versionService.start();
    this.stopVersionShortcut = this.keyboardSequence.listen({ timeoutMs: 1500 }, () => this.toggleVersionPanel());
  }

  ngOnDestroy(): void {
    this.stopVersionShortcut?.();
    this.stopVersionShortcut = null;
    this.versionService.stop();
  }

  @HostListener("document:keydown.escape", ["$event"])
  closeVersionPanelOnEscape(event: KeyboardEvent): void {
    if (!this.versionPanelVisible()) {
      return;
    }
    event.preventDefault();
    this.hideVersionPanel();
  }

  toggleVersionPanel(): void {
    this.versionPanelVisible.update((visible) => !visible);
  }

  hideVersionPanel(): void {
    this.versionPanelVisible.set(false);
  }

  async submit(): Promise<void> {
    this.submitAttempted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      await this.authService.healthReady();
      const value = this.form.getRawValue();
      await this.authService.login({ ...value, email: normalizeEmail(value.email) });
      await this.router.navigateByUrl("/dashboard");
    } catch (error) {
      this.error.set(messageForLoginError(error));
    } finally {
      this.loading.set(false);
    }
  }

  submitLabel(): string {
    return this.loading() ? $localize`:@@loginSubmitting:Ingresando...` : $localize`:@@loginSubmit:Ingresar`;
  }
}

export function messageForLoginError(error: unknown): string {
  if (isTimeoutError(error)) {
    return $localize`:@@loginServerTimeout:El servidor está tardando demasiado.`;
  }

  if (error instanceof HttpErrorResponse) {
    if (error.status === 401) {
      return $localize`:@@loginError:Email o contraseña inválidos.`;
    }
    if (error.status === 0) {
      return $localize`:@@loginServerUnavailable:No fue posible conectar con el servidor.`;
    }
    if (error.status === 429) {
      return $localize`:@@loginRateLimit:Demasiados intentos de inicio de sesión. Espera un minuto e inténtalo nuevamente.`;
    }
    if (error.status >= 500) {
      return $localize`:@@loginServiceUnavailable:El servicio no está disponible temporalmente.`;
    }
  }

  return $localize`:@@loginServiceUnavailable:El servicio no está disponible temporalmente.`;
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof TimeoutError ||
    (error !== null &&
      typeof error === "object" &&
      "name" in error &&
      (error as { name?: unknown }).name === "TimeoutError")
  );
}
