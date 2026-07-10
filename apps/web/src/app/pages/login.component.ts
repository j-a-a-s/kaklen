import { CommonModule } from "@angular/common";
import { Component, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { AuthService } from "../auth/auth.service";

interface LoginForm {
  email: FormControl<string>;
  password: FormControl<string>;
}

@Component({
  selector: "kaklen-login",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <main class="auth-shell">
      <section class="auth-panel" aria-labelledby="login-title">
        <p class="eyebrow">Welcome back</p>
        <h1 id="login-title">Login</h1>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label>
            Email
            <input type="email" formControlName="email" autocomplete="email" />
            <small *ngIf="form.controls.email.touched && form.controls.email.invalid">
              Enter a valid email.
            </small>
          </label>

          <label>
            Password
            <input type="password" formControlName="password" autocomplete="current-password" />
            <small *ngIf="form.controls.password.touched && form.controls.password.invalid">
              Password must be at least 8 characters.
            </small>
          </label>

          <p class="form-error" *ngIf="error()">{{ error() }}</p>

          <button type="submit" [disabled]="form.invalid || loading()">
            {{ loading() ? "Signing in..." : "Sign in" }}
          </button>
        </form>

        <p class="switch-link">No account yet? <a routerLink="/register">Create one</a></p>
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
      this.error.set("Invalid email or password.");
    } finally {
      this.loading.set(false);
    }
  }
}
