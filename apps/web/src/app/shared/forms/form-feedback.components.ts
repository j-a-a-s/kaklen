import { CommonModule } from "@angular/common";
import { Component, ContentChild, Directive, HostBinding, InjectionToken, Input, forwardRef, inject } from "@angular/core";
import { AbstractControl, FormArray, FormGroup, NgControl, ValidationErrors, Validators } from "@angular/forms";
import { UiIconComponent } from "../ui-icon.component";
import {
  ValidationFieldType,
  resolveValidationLabel,
  validationMessageResolver
} from "./validation-message-resolver";

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

interface FormFieldContext {
  readonly controlId: string;
  readonly supportId: string;
}

const FORM_FIELD_CONTEXT = new InjectionToken<FormFieldContext>("KAKLEN_FORM_FIELD_CONTEXT");

@Component({
  selector: "label[kaklen-form-field]",
  standalone: true,
  imports: [CommonModule, RequiredFieldIndicatorComponent, OptionalFieldLabelComponent, UiIconComponent],
  providers: [{ provide: FORM_FIELD_CONTEXT, useExisting: forwardRef(() => FormFieldComponent) }],
  template: `
    <span class="form-field-label">
      <span>{{ label }}</span>
      <kaklen-required *ngIf="isRequired" />
      <kaklen-optional *ngIf="!isRequired" />
    </span>
    <ng-content select="[kaklenControl]" />
    <span class="form-field-support" [id]="supportId">
      <small *ngIf="isInvalid" class="field-error" role="alert">
        <kaklen-icon name="x-circle" [size]="15" />
        <span>{{ errorMessage }}</span>
      </small>
      <ng-container *ngIf="!isInvalid"><ng-content /></ng-container>
    </span>
  `
})
export class FormFieldComponent {
  @Input({ required: true }) label = "";
  @Input({ required: true }) controlId = "";
  @Input() required: boolean | "auto" = "auto";
  @Input() invalid: boolean | "auto" = "auto";
  @Input() requiredMessage = $localize`:@@fieldRequiredError:Este campo es obligatorio.`;
  @Input() invalidMessage = "";
  @Input() fieldType?: ValidationFieldType;
  @Input() currency = "";
  @Input() validationErrors: ValidationErrors | null = null;

  @ContentChild(forwardRef(() => FormControlA11yDirective)) private controlDirective?: FormControlA11yDirective;
  @ContentChild(forwardRef(() => FieldErrorComponent)) private legacyErrorConfig?: FieldErrorComponent;

  @HostBinding("class.form-field") readonly formFieldClass = true;

  @HostBinding("class.form-field-invalid") get invalidClass(): boolean {
    return this.isInvalid;
  }

  @HostBinding("attr.for") get associatedControlId(): string {
    return this.controlId;
  }

  get supportId(): string {
    return `${this.controlId}-support`;
  }

  get isRequired(): boolean {
    return this.required === "auto" ? this.controlDirective?.isRequired ?? false : this.required;
  }

  get isInvalid(): boolean {
    if (this.validationErrors) return true;
    if (this.invalid !== "auto") return this.invalid;
    const control = this.controlDirective?.control;
    return Boolean(control?.invalid && (control.touched || control.dirty || this.legacyErrorConfig?.attempted));
  }

  get errorMessage(): string {
    const control = this.controlDirective?.control ?? null;
    return validationMessageResolver.resolve({
      path: this.controlDirective?.path ?? "",
      label: this.label,
      errors: this.validationErrors ?? control?.errors ?? null,
      control,
      currency: this.currency || findCurrency(control),
      fieldType: this.fieldType ?? this.legacyErrorConfig?.fieldType,
      requiredMessage: this.requiredMessage,
      fallbackMessage: this.invalidMessage || this.legacyErrorConfig?.invalidMessage || undefined
    });
  }
}

@Directive({
  selector: "[kaklenControl][formControlName], [kaklenControl][formControl], [kaklenControl][ngModel]",
  standalone: true
})
export class FormControlA11yDirective {
  private readonly ngControl = inject(NgControl, { self: true });
  private readonly formField = inject(FORM_FIELD_CONTEXT, { optional: true });

  get control(): AbstractControl<unknown> | null {
    return this.ngControl.control;
  }

  get path(): string {
    return this.ngControl.path?.join(".") ?? "";
  }

  get isRequired(): boolean {
    return Boolean(this.control?.hasValidator(Validators.required) || this.control?.hasValidator(Validators.requiredTrue));
  }

  get isInvalid(): boolean {
    return Boolean(this.control?.invalid && (this.control.touched || this.control.dirty));
  }

  @HostBinding("attr.id") get controlId(): string | null {
    return this.formField?.controlId || null;
  }

  @HostBinding("attr.aria-describedby") get describedBy(): string | null {
    return this.formField?.supportId || null;
  }

  @HostBinding("attr.aria-required") get ariaRequired(): string {
    return this.isRequired ? "true" : "false";
  }

  @HostBinding("attr.aria-invalid") get ariaInvalid(): string {
    return this.isInvalid ? "true" : "false";
  }
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
  template: ""
})
export class FieldErrorComponent {
  @Input({ required: true }) control: AbstractControl<unknown> | null = null;
  @Input() id = "";
  @Input() attempted = false;
  @Input() requiredMessage = $localize`:@@fieldRequiredError:Este campo es obligatorio.`;
  @Input() invalidMessage = "";
  @Input() fieldType?: ValidationFieldType;

  get visible(): boolean {
    return Boolean(this.control?.invalid && (this.control.touched || this.control.dirty || this.attempted));
  }

  get message(): string {
    return validationMessageResolver.resolve({
      path: "",
      label: "",
      errors: this.control?.errors ?? null,
      control: this.control,
      currency: findCurrency(this.control),
      fieldType: this.fieldType,
      requiredMessage: this.requiredMessage,
      fallbackMessage: this.invalidMessage || undefined
    });
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
  @Input() attempted = false;
  @Input() scopePaths: readonly string[] = [];
  @Input() labels: Readonly<Record<string, string>> = {};
  @Input() fieldIds: Readonly<Record<string, string>> = {};
  @Input() messages: Readonly<Record<string, string>> = {};
  @Input() groupErrorFields: Readonly<Record<string, string>> = {};

  get visible(): boolean {
    return this.attempted && this.entries.length > 0;
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
    const entries = this.collectInvalid(this.form).filter((entry) => this.isInScope(entry.path));
    for (const errorName of Object.keys(this.form.errors ?? {})) {
      const path = this.groupErrorFields[errorName];
      if (!path || !this.isInScope(path) || entries.some((entry) => entry.path === path)) {
        continue;
      }
      entries.push({
        path,
        label: resolveValidationLabel(path, this.labels),
        message: this.messages[path] ?? groupErrorMessage(errorName, path, this.form),
        targetId: this.fieldIds[path] ?? ""
      });
    }
    return entries;
  }

  focusFirst(): void {
    const first = this.entries[0];
    if (first) this.focus(first);
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
      label: resolveValidationLabel(path, this.labels),
      message:
        this.messages[path] ??
        this.messages[shortPath] ??
        validationMessageResolver.resolve({
          path,
          label: resolveValidationLabel(path, this.labels),
          errors: control.errors,
          control,
          currency: findCurrency(control)
        }),
      targetId: this.fieldIds[path] ?? this.fieldIds[shortPath] ?? ""
    }];
  }

  private isInScope(path: string): boolean {
    return this.scopePaths.length === 0 || this.scopePaths.some((scope) =>
      path === scope || path.startsWith(`${scope}.`)
    );
  }
}

export function fieldErrorMessage(
  control: AbstractControl<unknown> | null,
  requiredMessage: string,
  invalidMessage: string
): string {
  return validationMessageResolver.resolve({
    path: "",
    label: "",
    errors: control?.errors ?? null,
    control,
    currency: findCurrency(control),
    requiredMessage,
    fallbackMessage: invalidMessage
  });
}

function groupErrorMessage(errorName: string, path = "", control: AbstractControl<unknown> | null = null): string {
  return validationMessageResolver.resolve({
    path,
    label: resolveValidationLabel(path),
    errors: { [errorName]: true },
    control,
    currency: findCurrency(control)
  });
}

function findCurrency(control: AbstractControl<unknown> | null): string | undefined {
  let current = control;
  while (current) {
    const value = current.get("currency")?.value;
    if (typeof value === "string" && value) return value;
    current = current.parent;
  }
  return undefined;
}

function escapeSelector(value: string): string {
  return typeof CSS !== "undefined" && CSS.escape
    ? CSS.escape(value)
    : value.replace(/(["'\\#.:[\]()])/g, "\\$1");
}
