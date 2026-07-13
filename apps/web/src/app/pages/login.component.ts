import { CommonModule } from "@angular/common";
import { Component, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { AuthService } from "../auth/auth.service";
import { LocaleSelectorComponent } from "../i18n/locale-selector.component";
import { VersionBadgeComponent } from "../version/version-badge.component";

interface LoginForm {
  email: FormControl<string>;
  password: FormControl<string>;
}

@Component({
  selector: "kaklen-login",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LocaleSelectorComponent, VersionBadgeComponent],
  template: `
    <main class="auth-shell">
      <section class="auth-panel" aria-labelledby="login-title">
        <div class="auth-language">
          <kaklen-locale-selector />
        </div>
        <p class="eyebrow" i18n="@@loginEyebrow">Bienvenido de vuelta</p>
        <h1 id="login-title" i18n="@@loginTitle">Iniciar sesión</h1>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label>
            <span i18n="@@emailLabel">Email</span>
            <input type="email" formControlName="email" autocomplete="email" />
            <small *ngIf="form.controls.email.touched && form.controls.email.invalid" i18n="@@emailValidation">
              Ingresa un email válido.
            </small>
          </label>

          <label>
            <span i18n="@@passwordLabel">Contraseña</span>
            <input type="password" formControlName="password" autocomplete="current-password" />
            <small *ngIf="form.controls.password.touched && form.controls.password.invalid" i18n="@@passwordValidation">
              La contraseña debe tener al menos 8 caracteres.
            </small>
          </label>

          <p class="form-error" *ngIf="error()">{{ error() }}</p>

          <button type="submit" [disabled]="form.invalid || loading()">
            {{ submitLabel() }}
          </button>
        </form>

        <p class="switch-link" i18n="@@loginSwitch">¿Aún no tienes cuenta? <a routerLink="/register">Crea una</a></p>
        <kaklen-version-badge />
      </section>
    </main>
  `
})
export class LoginComponent {
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = new FormGroup<LoginForm>({
    email: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.email]
    }),
    password: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)]
    })
  });

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      await this.authService.login(this.form.getRawValue());
      await this.router.navigateByUrl("/dashboard");
    } catch {
      this.error.set($localize`:@@loginError:Email o contraseña inválidos.`);
    } finally {
      this.loading.set(false);
    }
  }

  submitLabel(): string {
    return this.loading() ? $localize`:@@loginSubmitting:Ingresando...` : $localize`:@@loginSubmit:Ingresar`;
  }
}
