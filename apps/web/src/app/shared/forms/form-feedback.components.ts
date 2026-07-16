import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { AbstractControl, FormGroup } from "@angular/forms";
import { UiIconComponent } from "../ui-icon.component";

@Component({
  selector: "kaklen-required",
  standalone: true,
  template: `<span class="required-indicator" aria-hidden="true">*</span><span class="sr-only" i18n="@@requiredLabel">Obligatorio</span>`
})
export class RequiredFieldIndicatorComponent {}

@Component({
  selector: "kaklen-optional",
  standalone: true,
  template: `<small class="optional-label" i18n="@@optionalLabel">Opcional</small>`
})
export class OptionalFieldLabelComponent {}

@Component({
  selector: "kaklen-field-error",
  standalone: true,
  imports: [CommonModule, UiIconComponent],
  template: `
    <small *ngIf="visible" class="field-error" [id]="id" role="alert">
      <kaklen-icon name="x-circle" [size]="15" />
      <span>{{ message }}</span>
    </small>
  `
})
export class FieldErrorComponent {
  @Input({ required: true }) control: AbstractControl<unknown> | null = null;
  @Input() id = "";
  @Input() submitted = false;
  @Input() requiredMessage = $localize`:@@fieldRequiredError:Este campo es obligatorio.`;
  @Input() invalidMessage = $localize`:@@fieldInvalidError:Revisa el valor ingresado.`;

  get visible(): boolean {
    return Boolean(this.control?.invalid && (this.control.touched || this.control.dirty || this.submitted));
  }

  get message(): string {
    const errors = this.control?.errors;
    if (!errors) return "";
    if (errors["required"] || errors["whitespace"]) return this.requiredMessage;
    if (errors["email"]) return $localize`:@@emailValidation:Ingresa un correo válido, por ejemplo nombre@empresa.cl.`;
    if (errors["phone"]) return $localize`:@@phoneValidation:Ingresa un teléfono válido con código de país, por ejemplo +56 9 1234 5678.`;
    if (errors["chileanRut"]) return $localize`:@@rutValidation:Ingresa un RUT válido.`;
    if (errors["dateOrder"]) return $localize`:@@dateOrderValidation:La fecha de término debe ser posterior o igual a la fecha de inicio.`;
    if (errors["min"] || errors["max"] || errors["precision"] || errors["decimal"] || errors["maxlength"]) return this.invalidMessage;
    return this.invalidMessage;
  }
}

@Component({
  selector: "kaklen-form-error-summary",
  standalone: true,
  imports: [CommonModule, UiIconComponent],
  template: `
    <div *ngIf="visible" class="form-error-summary" role="alert" tabindex="-1">
      <kaklen-icon name="x-circle" />
      <span>
        <strong>{{ title }}</strong>
        <small>{{ description }}</small>
      </span>
    </div>
  `
})
export class FormErrorSummaryComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input() submitted = false;
  @Input() labels: Readonly<Record<string, string>> = {};

  get visible(): boolean {
    return this.submitted && this.form.invalid;
  }

  get title(): string {
    const invalid = this.invalidLabels();
    return invalid.length === 1
      ? $localize`:@@singleFieldMissingError:Falta completar o corregir 1 campo.`
      : $localize`:@@multipleFieldsMissingError:Falta completar o corregir ${invalid.length}:fieldCount: campos.`;
  }

  get description(): string {
    const labels = this.invalidLabels();
    return labels.length
      ? labels.join(", ")
      : $localize`:@@formErrorSummaryHelp:Los mensajes bajo cada campo indican qué debes corregir.`;
  }

  private invalidLabels(): string[] {
    return Object.entries(this.form.controls)
      .filter(([, control]) => control.invalid)
      .map(([name]) => this.labels[name] ?? name);
  }
}
