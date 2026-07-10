import { CommonModule } from "@angular/common";
import { Component, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { AuthService } from "../auth/auth.service";

interface RegisterForm {
  firstName: FormControl<string>;
  lastName: FormControl<string>;
  email: FormControl<string>;
  password: FormControl<string>;
}

@Component({
  selector: "kaklen-register",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <main class="auth-shell">
      <section class="auth-panel" aria-labelledby="register-title">
        <p class="eyebrow">Start with Kaklen</p>
        <h1 id="register-title">Create account</h1>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field-grid">
            <label>
              First name
              <input type="text" formControlName="firstName" autocomplete="given-name" />
              <small *ngIf="form.controls.firstName.touched && form.controls.firstName.invalid">
                First name is required.
              </small>
            </label>

            <label>
              Last name
              <input type="text" formControlName="lastName" autocomplete="family-name" />
              <small *ngIf="form.controls.lastName.touched && form.controls.lastName.invalid">
                Last name is required.
              </small>
            </label>
          </div>

          <label>
            Email
            <input type="email" formControlName="email" autocomplete="email" />
            <small *ngIf="form.controls.email.touched && form.controls.email.invalid">
              Enter a valid email.
            </small>
          </label>

          <label>
            Password
            <input type="password" formControlName="password" autocomplete="new-password" />
            <small *ngIf="form.controls.password.touched && form.controls.password.invalid">
              Password must be at least 8 characters.
            </small>
          </label>

          <p class="form-error" *ngIf="error()">{{ error() }}</p>

          <button type="submit" [disabled]="form.invalid || loading()">
            {{ loading() ? "Creating..." : "Create account" }}
          </button>
        </form>

        <p class="switch-link">Already registered? <a routerLink="/login">Sign in</a></p>
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
      this.error.set("Unable to create account with these credentials.");
    } finally {
      this.loading.set(false);
    }
  }
}
