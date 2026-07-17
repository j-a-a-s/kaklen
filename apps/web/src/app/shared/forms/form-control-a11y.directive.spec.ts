import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { FormControlA11yDirective, FormFieldComponent } from "./form-feedback.components";

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, FormControlA11yDirective, FormFieldComponent],
  template: `
    <form [formGroup]="form">
      <label kaklen-form-field label="Name" controlId="name" required="auto" invalid="auto">
        <input kaklenControl formControlName="name" maxlength="80" />
      </label>
    </form>
  `
})
class A11yFormHostComponent {
  readonly form = new FormGroup({
    name: new FormControl("", { nonNullable: true, validators: [Validators.required] })
  });
}

describe("FormControlA11yDirective", () => {
  let fixture: ComponentFixture<A11yFormHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [A11yFormHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(A11yFormHostComponent);
    fixture.detectChanges();
  });

  it("derives required and invalid ARIA state from the reactive control", () => {
    const input = fixture.nativeElement.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("aria-required")).toBe("true");
    expect(input.getAttribute("aria-invalid")).toBe("false");

    fixture.componentInstance.form.controls.name.markAsTouched();
    fixture.detectChanges();
    expect(input.getAttribute("aria-invalid")).toBe("true");

    fixture.componentInstance.form.controls.name.setValue("Kaklen");
    fixture.detectChanges();
    expect(input.getAttribute("aria-invalid")).toBe("false");
  });
});
