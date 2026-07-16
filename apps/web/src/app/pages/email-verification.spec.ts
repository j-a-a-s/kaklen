import { HttpErrorResponse } from "@angular/common/http";
import { AuthService } from "../auth/auth.service";
import { LocaleService } from "../i18n/locale.service";
import { LoginComponent } from "./login.component";
import { RegisterComponent } from "./register.component";
import { ResendVerificationComponent } from "./resend-verification.component";
import { VerifyEmailComponent, verificationStateForError } from "./verify-email.component";

describe("email verification UI", () => {
  it("keeps registration pending without creating a frontend session", async () => {
    const register = jasmine.createSpy("register").and.resolveTo({ message: "pending" });
    const component = new RegisterComponent(
      { register } as unknown as AuthService,
      { getLocale: () => "es" } as unknown as LocaleService
    );
    component.form.setValue({
      firstName: "  Ada  ",
      lastName: "  Lovelace  ",
      email: "  ADA@EXAMPLE.COM  ",
      password: "KaklenTest123!"
    });

    await component.submit();

    expect(register).toHaveBeenCalledOnceWith({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      password: "KaklenTest123!",
      locale: "es"
    });
    expect(component.registered()).toBeTrue();
    expect(component.registeredEmail()).toBe("ada@example.com");
  });

  it("shows the unverified state by stable error code and keeps the email", async () => {
    const navigateByUrl = jasmine.createSpy("navigateByUrl").and.resolveTo(true);
    const component = loginComponent(
      jasmine.createSpy("login").and.rejectWith(apiError("EMAIL_NOT_VERIFIED", 403)),
      navigateByUrl
    );
    component.form.setValue({ email: "pending@example.com", password: "KaklenTest123!" });

    await component.submit();

    expect(component.emailNotVerified()).toBeTrue();
    expect(component.form.controls.email.value).toBe("pending@example.com");
    expect(component.error()).toContain("confirmado");
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it("prevents duplicate verification resend requests from login", async () => {
    let completeRequest: (() => void) | undefined;
    const resendVerificationEmail = jasmine.createSpy("resendVerificationEmail").and.returnValue(
      new Promise((resolve) => {
        completeRequest = () => resolve({ message: "generic" });
      })
    );
    const component = loginComponent(jasmine.createSpy("login"), jasmine.createSpy("navigateByUrl"), resendVerificationEmail);
    component.form.controls.email.setValue("pending@example.com");
    component.emailNotVerified.set(true);

    const first = component.resendVerification();
    const second = component.resendVerification();
    expect(component.resending()).toBeTrue();
    expect(resendVerificationEmail).toHaveBeenCalledTimes(1);
    completeRequest?.();
    await Promise.all([first, second]);

    expect(component.resending()).toBeFalse();
    expect(component.resendMessage()).toContain("nuevo correo");
  });

  it("confirms a valid token without signing in and removes it from history", async () => {
    const verifyEmail = jasmine.createSpy("verifyEmail").and.resolveTo({ message: "confirmed" });
    const navigate = jasmine.createSpy("navigate").and.resolveTo(true);
    const component = verificationComponent("verification-token", verifyEmail, navigate);

    await component.ngOnInit();

    expect(verifyEmail).toHaveBeenCalledOnceWith({ token: "verification-token" });
    expect(component.state()).toBe("confirmed");
    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: {}, replaceUrl: true }));
  });

  it("maps expired, used, revoked, invalid, and network failures", () => {
    expect(verificationStateForError(apiError("EMAIL_VERIFICATION_TOKEN_EXPIRED", 410))).toBe("expired");
    expect(verificationStateForError(apiError("EMAIL_VERIFICATION_TOKEN_USED", 410))).toBe("used");
    expect(verificationStateForError(apiError("EMAIL_VERIFICATION_TOKEN_REVOKED", 410))).toBe("invalid");
    expect(verificationStateForError(apiError("EMAIL_VERIFICATION_TOKEN_INVALID", 400))).toBe("invalid");
    expect(verificationStateForError(apiError("INTERNAL_ERROR", 503))).toBe("network");
  });

  it("keeps a missing confirmation token invalid", async () => {
    const verifyEmail = jasmine.createSpy("verifyEmail");
    const component = verificationComponent(null, verifyEmail, jasmine.createSpy("navigate"));

    await component.ngOnInit();

    expect(component.state()).toBe("invalid");
    expect(verifyEmail).not.toHaveBeenCalled();
  });

  it("prevents duplicate requests on the public resend screen", async () => {
    let completeRequest: (() => void) | undefined;
    const resendVerificationEmail = jasmine.createSpy("resendVerificationEmail").and.returnValue(
      new Promise((resolve) => {
        completeRequest = () => resolve({ message: "generic" });
      })
    );
    const component = new ResendVerificationComponent({ resendVerificationEmail } as unknown as AuthService);
    component.form.controls.email.setValue("pending@example.com");

    const first = component.submit();
    const second = component.submit();
    expect(resendVerificationEmail).toHaveBeenCalledTimes(1);
    completeRequest?.();
    await Promise.all([first, second]);

    expect(component.sent()).toBeTrue();
    expect(component.loading()).toBeFalse();
  });
});

function loginComponent(
  login: jasmine.Spy,
  navigateByUrl: jasmine.Spy,
  resendVerificationEmail: jasmine.Spy = jasmine.createSpy("resendVerificationEmail")
): LoginComponent {
  return new LoginComponent(
    {
      healthReady: async () => undefined,
      login,
      resendVerificationEmail
    } as unknown as AuthService,
    { navigateByUrl } as never,
    { listen: () => () => undefined } as never,
    { start: () => undefined, stop: () => undefined } as never
  );
}

function verificationComponent(
  token: string | null,
  verifyEmail: jasmine.Spy,
  navigate: jasmine.Spy
): VerifyEmailComponent {
  return new VerifyEmailComponent(
    { verifyEmail } as unknown as AuthService,
    { snapshot: { queryParamMap: { get: () => token } } } as never,
    { navigate } as never
  );
}

function apiError(code: string, status: number): HttpErrorResponse {
  return new HttpErrorResponse({ error: { code, message: "backend fallback" }, status });
}
