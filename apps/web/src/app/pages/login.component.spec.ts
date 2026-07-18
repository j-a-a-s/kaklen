import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Validators } from "@angular/forms";
import { provideRouter } from "@angular/router";
import { AuthService } from "../auth/auth.service";
import { KeyboardSequenceService } from "../shared/keyboard-sequence.service";
import { VersionService } from "../version/version.service";
import { LoginComponent } from "./login.component";

describe("LoginComponent required email semantics", () => {
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: {} },
        {
          provide: KeyboardSequenceService,
          useValue: { listen: () => (): void => undefined }
        },
        {
          provide: VersionService,
          useValue: { start: (): void => undefined, stop: (): void => undefined }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
  });

  it("renders email as required and never as optional", () => {
    const control = fixture.componentInstance.form.controls.email;
    const input = fixture.nativeElement.querySelector("#login-email") as HTMLInputElement;
    const field = input.closest(".form-field") as HTMLElement;

    expect(control.hasValidator(Validators.required)).toBeTrue();
    expect(input.getAttribute("aria-required")).toBe("true");
    expect(field.textContent).toContain("*");
    expect(field.textContent).not.toContain("Opcional");
  });

  it("distinguishes empty, malformed, and valid email values", () => {
    const control = fixture.componentInstance.form.controls.email;
    const input = fixture.nativeElement.querySelector("#login-email") as HTMLInputElement;

    control.markAsTouched();
    fixture.detectChanges();
    expect(control.hasError("required")).toBeTrue();
    expect(input.getAttribute("aria-invalid")).toBe("true");

    control.setValue("invalid-email");
    fixture.detectChanges();
    expect(control.hasError("email")).toBeTrue();
    expect(input.getAttribute("aria-invalid")).toBe("true");

    control.setValue("person@example.com");
    fixture.detectChanges();
    expect(control.errors).toBeNull();
    expect(input.getAttribute("aria-invalid")).toBe("false");
  });
});
