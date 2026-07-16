import { CommonModule } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, OnInit, signal } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { AuthService } from "../auth/auth.service";
import { BrandLogoComponent } from "../shared/brand-logo.component";
import { UiIconComponent } from "../shared/ui-icon.component";

type VerificationState = "verifying" | "confirmed" | "expired" | "used" | "invalid" | "network";

@Component({
  selector: "kaklen-verify-email",
  standalone: true,
  imports: [CommonModule, RouterLink, BrandLogoComponent, UiIconComponent],
  template: `
    <main class="auth-shell">
      <aside class="auth-brand-panel" aria-label="Kaklen">
        <kaklen-brand-logo variant="signature" />
        <div class="auth-brand-message">
          <span class="brand-rule" aria-hidden="true"></span>
          <p i18n="@@verificationBrandPromise">Confirma tu identidad para proteger tu cuenta.</p>
        </div>
      </aside>
      <section class="auth-panel">
        <div class="auth-result" role="status" aria-live="polite">
          <span class="result-icon" [class.success]="state() === 'confirmed'" [class.warning]="state() !== 'confirmed'" aria-hidden="true">
            <kaklen-icon [name]="state() === 'confirmed' ? 'check-circle' : 'mail'" />
          </span>
          <p class="eyebrow" i18n="@@emailVerificationEyebrow">Confirmación de correo</p>
          <h1>{{ title() }}</h1>
          <p>{{ description() }}</p>
          <a *ngIf="state() !== 'verifying'" class="button-link" routerLink="/login" i18n="@@openLoginAction">Abrir inicio de sesión</a>
          <a *ngIf="state() === 'expired' || state() === 'invalid' || state() === 'used'" class="secondary-result-link" routerLink="/resend-verification" i18n="@@requestNewVerificationAction">Solicitar un nuevo correo</a>
        </div>
      </section>
    </main>
  `
})
export class VerifyEmailComponent implements OnInit {
  readonly state = signal<VerificationState>("verifying");

  constructor(
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get("token");
    if (!token) {
      this.state.set("invalid");
      return;
    }

    try {
      await this.authService.verifyEmail({ token });
      this.state.set("confirmed");
    } catch (error) {
      this.state.set(verificationStateForError(error));
    } finally {
      await this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true
      });
    }
  }

  title(): string {
    const titles: Record<VerificationState, string> = {
      verifying: $localize`:@@verifyingEmailTitle:Confirmando tu correo`,
      confirmed: $localize`:@@emailConfirmedTitle:Correo confirmado`,
      expired: $localize`:@@verificationExpiredTitle:Enlace expirado`,
      used: $localize`:@@verificationUsedTitle:Enlace utilizado`,
      invalid: $localize`:@@verificationInvalidTitle:Enlace inválido`,
      network: $localize`:@@verificationNetworkTitle:No pudimos confirmar tu correo`
    };
    return titles[this.state()];
  }

  description(): string {
    const descriptions: Record<VerificationState, string> = {
      verifying: $localize`:@@verifyingEmailDescription:Estamos validando tu enlace de confirmación.`,
      confirmed: $localize`:@@emailConfirmedDescription:Tu correo fue confirmado correctamente. Ya puedes iniciar sesión.`,
      expired: $localize`:@@verificationExpiredDescription:Este enlace ya expiró. Solicita un nuevo correo de confirmación.`,
      used: $localize`:@@verificationUsedDescription:Este enlace ya fue utilizado. Puedes iniciar sesión o solicitar uno nuevo.`,
      invalid: $localize`:@@verificationInvalidDescription:El enlace no es válido. Solicita un nuevo correo de confirmación.`,
      network: $localize`:@@verificationNetworkDescription:Revisa tu conexión e intenta abrir el enlace nuevamente.`
    };
    return descriptions[this.state()];
  }
}

export function verificationStateForError(error: unknown): VerificationState {
  if (!(error instanceof HttpErrorResponse)) return "network";
  const body: unknown = error.error;
  const code = body && typeof body === "object" && "code" in body
    ? (body as { code?: unknown }).code
    : null;
  if (code === "EMAIL_VERIFICATION_TOKEN_EXPIRED") return "expired";
  if (code === "EMAIL_VERIFICATION_TOKEN_USED") return "used";
  if (code === "EMAIL_VERIFICATION_TOKEN_INVALID" || code === "EMAIL_VERIFICATION_TOKEN_REVOKED") return "invalid";
  return error.status === 0 || error.status >= 500 ? "network" : "invalid";
}
