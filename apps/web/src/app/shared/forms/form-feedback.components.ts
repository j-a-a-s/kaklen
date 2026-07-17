import { CommonModule } from "@angular/common";
import { Component, Directive, HostBinding, Input, inject } from "@angular/core";
import { AbstractControl, FormArray, FormGroup, NgControl, Validators } from "@angular/forms";
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
  selector: "kaklen-field-helper",
  standalone: true,
  template: `<small class="field-helper"><ng-content /></small>`
})
export class FieldHelperComponent {}

@Directive({
  selector: "input[formControlName], textarea[formControlName], select[formControlName]",
  standalone: true
})
export class FormControlA11yDirective {
  private readonly ngControl = inject(NgControl, { self: true });

  @HostBinding("attr.aria-required") get ariaRequired(): string | null {
    const control = this.ngControl.control;
    return control?.hasValidator(Validators.required) || control?.hasValidator(Validators.requiredTrue)
      ? "true"
      : null;
  }

  @HostBinding("attr.aria-invalid") get ariaInvalid(): string {
    const control = this.ngControl.control;
    return control?.invalid && (control.touched || control.dirty) ? "true" : "false";
  }
}

@Component({
  selector: "kaklen-form-field",
  standalone: true,
  imports: [CommonModule, RequiredFieldIndicatorComponent, OptionalFieldLabelComponent],
  template: `
    <div class="form-field" [class.form-field-invalid]="invalid">
      <label [for]="controlId">
        <span class="form-field-label">
          <span>{{ label }}</span>
          <kaklen-required *ngIf="required" />
          <kaklen-optional *ngIf="!required" />
        </span>
      </label>
      <ng-content select="[kaklenControl]" />
      <div class="form-field-support"><ng-content /></div>
    </div>
  `
})
export class FormFieldComponent {
  @Input({ required: true }) label = "";
  @Input({ required: true }) controlId = "";
  @Input() required = false;
  @Input() invalid = false;
}

export interface WizardStep {
  id: string;
  label: string;
}

@Component({
  selector: "kaklen-wizard-steps",
  standalone: true,
  imports: [CommonModule],
  template: `
    <ol class="wizard-steps" [attr.aria-label]="ariaLabel">
      <li
        *ngFor="let step of steps; let index = index"
        [class.active]="currentStep === index + 1"
        [class.complete]="currentStep > index + 1"
        [attr.aria-current]="currentStep === index + 1 ? 'step' : null"
      >
        <span>{{ index + 1 }}</span><strong>{{ step.label }}</strong>
      </li>
    </ol>
  `
})
export class WizardStepIndicatorComponent {
  @Input({ required: true }) steps: readonly WizardStep[] = [];
  @Input({ required: true }) currentStep = 1;
  @Input() ariaLabel = $localize`:@@wizardProgressLabel:Progreso`;
}

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
    return fieldErrorMessage(this.control, this.requiredMessage, this.invalidMessage);
  }
}

export interface FormErrorEntry {
  path: string;
  label: string;
  message: string;
  targetId: string;
}

@Component({
  selector: "kaklen-form-error-summary",
  standalone: true,
  imports: [CommonModule, UiIconComponent],
  template: `
    <div *ngIf="visible" class="form-error-summary" role="alert" aria-live="assertive" tabindex="-1">
      <kaklen-icon name="x-circle" />
      <span>
        <strong>{{ title }}</strong>
        <ul>
          <li *ngFor="let entry of entries">
            <button type="button" class="form-error-link" (click)="focus(entry)">
              <span>{{ entry.label }}: {{ entry.message }}</span>
            </button>
          </li>
        </ul>
      </span>
    </div>
  `
})
export class FormErrorSummaryComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input() submitted = false;
  @Input() labels: Readonly<Record<string, string>> = {};
  @Input() fieldIds: Readonly<Record<string, string>> = {};
  @Input() messages: Readonly<Record<string, string>> = {};
  @Input() groupErrorFields: Readonly<Record<string, string>> = {};

  get visible(): boolean {
    return this.submitted && this.form.invalid;
  }

  get title(): string {
    return $localize`:@@formCannotContinueTitle:No puedes continuar. Corrige:`;
  }

  get description(): string {
    const labels = this.entries.map((entry) => entry.label);
    return labels.length
      ? labels.join(", ")
      : $localize`:@@formErrorSummaryHelp:Los mensajes bajo cada campo indican qué debes corregir.`;
  }

  get entries(): FormErrorEntry[] {
    const entries = this.collectInvalid(this.form);
    for (const errorName of Object.keys(this.form.errors ?? {})) {
      const path = this.groupErrorFields[errorName];
      if (!path || entries.some((entry) => entry.path === path)) {
        continue;
      }
      entries.push({
        path,
        label: this.labels[path] ?? path,
        message: this.messages[path] ?? groupErrorMessage(errorName),
        targetId: this.fieldIds[path] ?? ""
      });
    }
    return entries;
  }

  focus(entry: FormErrorEntry): void {
    const selector = entry.targetId
      ? `#${escapeSelector(entry.targetId)}`
      : `[formControlName="${escapeSelector(entry.path.split(".").at(-1) ?? entry.path)}"]`;
    const target = document.querySelector<HTMLElement>(selector);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.focus({ preventScroll: true });
  }

  private collectInvalid(control: AbstractControl<unknown>, path = ""): FormErrorEntry[] {
    if (control instanceof FormGroup) {
      return Object.entries(control.controls).flatMap(([name, child]) =>
        this.collectInvalid(child, path ? `${path}.${name}` : name)
      );
    }
    if (control instanceof FormArray) {
      return control.controls.flatMap((child, index) =>
        this.collectInvalid(child, `${path}.${index}`)
      );
    }
    if (!control.invalid) {
      return [];
    }
    const shortPath = path.split(".").filter((part) => !/^\d+$/.test(part)).at(-1) ?? path;
    return [{
      path,
      label: this.labels[path] ?? this.labels[shortPath] ?? shortPath,
      message:
        this.messages[path] ??
        this.messages[shortPath] ??
        fieldErrorMessage(
          control,
          $localize`:@@fieldRequiredError:Este campo es obligatorio.`,
          $localize`:@@fieldInvalidError:Revisa el valor ingresado.`
        ),
      targetId: this.fieldIds[path] ?? this.fieldIds[shortPath] ?? ""
    }];
  }
}

export function fieldErrorMessage(
  control: AbstractControl<unknown> | null,
  requiredMessage: string,
  invalidMessage: string
): string {
  const errors = control?.errors;
  if (!errors) return "";
  if (errors["required"] || errors["whitespace"]) return requiredMessage;
  if (errors["email"]) return $localize`:@@emailValidation:Ingresa un correo válido, por ejemplo nombre@empresa.cl.`;
  if (errors["phone"]) return $localize`:@@phoneValidation:Ingresa un teléfono válido con código de país, por ejemplo +56 9 1234 5678.`;
  if (errors["chileanRut"]) return $localize`:@@rutValidation:Ingresa un RUT válido.`;
  if (errors["dateOrder"]) return groupErrorMessage("dateOrder");
  return invalidMessage;
}

function groupErrorMessage(errorName: string): string {
  if (errorName === "dateOrder") {
    return $localize`:@@dateOrderValidation:La fecha de término debe ser posterior o igual a la fecha de inicio.`;
  }
  return $localize`:@@fieldInvalidError:Revisa el valor ingresado.`;
}

function escapeSelector(value: string): string {
  return typeof CSS !== "undefined" && CSS.escape
    ? CSS.escape(value)
    : value.replace(/(["'\\#.:[\]()])/g, "\\$1");
}
