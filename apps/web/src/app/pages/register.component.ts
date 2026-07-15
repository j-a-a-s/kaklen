import { CommonModule } from "@angular/common";
import { Component, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { AuthService } from "../auth/auth.service";
import { BrandLogoComponent } from "../shared/brand-logo.component";

interface RegisterForm {
  firstName: FormControl<string>;
  lastName: FormControl<string>;
  email: FormControl<string>;
  password: FormControl<string>;
}

@Component({
  selector: "kaklen-register",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, BrandLogoComponent],
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
          <div class="field-grid">
            <label>
              <span i18n="@@firstNameLabel">Nombre</span>
              <input type="text" formControlName="firstName" autocomplete="given-name" />
              <small *ngIf="form.controls.firstName.touched && form.controls.firstName.invalid" i18n="@@firstNameValidation">
                El nombre es obligatorio.
              </small>
            </label>

            <label>
              <span i18n="@@lastNameLabel">Apellido</span>
              <input type="text" formControlName="lastName" autocomplete="family-name" />
              <small *ngIf="form.controls.lastName.touched && form.controls.lastName.invalid" i18n="@@lastNameValidation">
                El apellido es obligatorio.
              </small>
            </label>
          </div>

          <label>
            <span i18n="@@emailLabel">Email</span>
            <input type="email" formControlName="email" autocomplete="email" />
            <small *ngIf="form.controls.email.touched && form.controls.email.invalid" i18n="@@emailValidation">
              Ingresa un email válido.
            </small>
          </label>

          <label>
            <span i18n="@@passwordLabel">Contraseña</span>
            <input type="password" formControlName="password" autocomplete="new-password" />
            <small *ngIf="form.controls.password.touched && form.controls.password.invalid" i18n="@@passwordValidation">
              La contraseña debe tener al menos 8 caracteres.
            </small>
          </label>

          <p class="form-error" *ngIf="error()">{{ error() }}</p>

          <button type="submit" [disabled]="form.invalid || loading()">
            <span>{{ submitLabel() }}</span>
            <span aria-hidden="true">→</span>
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
  readonly form = new FormGroup<RegisterForm>({
    firstName: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)]
    }),
    lastName: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)]
    }),
    email: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.email]
    }),
    password: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)]
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
      await this.authService.register(this.form.getRawValue());
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
