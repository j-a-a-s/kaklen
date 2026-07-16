import { HttpErrorResponse } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { passwordStrength } from "@kaklen/shared";
import { AuthService } from "../auth/auth.service";
import { KeyboardSequenceService } from "../shared/keyboard-sequence.service";
import { VersionService } from "../version/version.service";
import { ForgotPasswordComponent } from "./forgot-password.component";
import { LoginComponent } from "./login.component";
import { ResetPasswordComponent, resetErrorState } from "./reset-password.component";

describe("password recovery UI", () => {
  it("shows the recovery link on login", async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { healthReady: async () => undefined, login: async () => undefined } },
        { provide: KeyboardSequenceService, useValue: { listen: () => () => undefined } },
        { provide: VersionService, useValue: { start: () => undefined, stop: () => undefined } }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a[href="/forgot-password"]') as HTMLAnchorElement | null;
    expect(link?.textContent).toContain("¿Olvidaste tu contraseña?");
  });

  it("does not submit an invalid recovery request", async () => {
    const forgotPassword = jasmine.createSpy("forgotPassword");
    const component = new ForgotPasswordComponent({ forgotPassword } as unknown as AuthService);

    await component.submit();

    expect(forgotPassword).not.toHaveBeenCalled();
    expect(component.form.controls.email.touched).toBeTrue();
  });

  it("shows loading and the generic success state", async () => {
    let completeRequest: (() => void) | undefined;
    const forgotPassword = jasmine.createSpy("forgotPassword").and.returnValue(
      new Promise((resolve) => {
        completeRequest = () => resolve({ message: "generic" });
      })
    );
    const component = new ForgotPasswordComponent({ forgotPassword } as unknown as AuthService);
    component.form.controls.email.setValue("ada@example.com");

    const submission = component.submit();
    expect(component.loading()).toBeTrue();
    completeRequest?.();
    await submission;

    expect(component.loading()).toBeFalse();
    expect(component.sent()).toBeTrue();
  });

  it("keeps reset unavailable when the token is absent", () => {
    const component = resetComponent(null);

    expect(component.state()).toBe("missing");
  });

  it("maps expired, used, and invalid tokens without depending on backend messages", () => {
    expect(resetErrorState(apiError("PASSWORD_RESET_TOKEN_EXPIRED", 410)).state).toBe("expired");
    expect(resetErrorState(apiError("PASSWORD_RESET_TOKEN_USED", 410)).state).toBe("used");
    expect(resetErrorState(apiError("PASSWORD_RESET_TOKEN_INVALID", 400)).state).toBe("invalid");
  });

  it("toggles password visibility and reports human strength", () => {
    const component = resetComponent("token");
    expect(component.passwordVisible()).toBeFalse();
    component.togglePasswordVisibility();
    expect(component.passwordVisible()).toBeTrue();
    expect(passwordStrength("short")).toBe("weak");
    expect(passwordStrength("Acceptable123")).toBe("acceptable");
    expect(passwordStrength("VeryStrongPass123!")).toBe("strong");
  });

  it("validates password confirmation before submission", async () => {
    const resetPassword = jasmine.createSpy("resetPassword");
    const component = resetComponent("token", resetPassword);
    component.form.setValue({ password: "UpdatedPass456!", confirmPassword: "DifferentPass789!" });

    await component.submit();

    expect(component.passwordsMatch()).toBeFalse();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("shows success and removes the token from browser history", async () => {
    const resetPassword = jasmine.createSpy("resetPassword").and.resolveTo({ message: "updated" });
    const navigate = jasmine.createSpy("navigate").and.resolveTo(true);
    const component = resetComponent("token", resetPassword, navigate);
    component.form.setValue({ password: "UpdatedPass456!", confirmPassword: "UpdatedPass456!" });

    await component.submit();

    expect(component.state()).toBe("success");
    expect(navigate).toHaveBeenCalledWith([], { queryParams: {}, replaceUrl: true });
  });
});

function resetComponent(
  token: string | null,
  resetPassword: jasmine.Spy = jasmine.createSpy("resetPassword"),
  navigate: jasmine.Spy = jasmine.createSpy("navigate").and.resolveTo(true)
): ResetPasswordComponent {
  return new ResetPasswordComponent(
    { resetPassword } as unknown as AuthService,
    { snapshot: { queryParamMap: { get: () => token } } } as never,
    { navigate } as never
  );
}

function apiError(code: string, status: number): HttpErrorResponse {
  return new HttpErrorResponse({ error: { code, message: "backend fallback" }, status });
}
