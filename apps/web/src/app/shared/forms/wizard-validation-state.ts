import { AbstractControl, FormArray, FormGroup } from "@angular/forms";

export interface WizardValidationError {
  path: string;
  errors: Readonly<Record<string, unknown>>;
}

export interface WizardValidationConfig {
  steps: Readonly<Record<number, readonly string[]>>;
  groupErrorFields?: Readonly<Record<string, string>>;
  fieldIds?: Readonly<Record<string, string>>;
}

export class WizardValidationState {
  private readonly attemptedSteps = new Set<number>();

  constructor(
    private readonly form: FormGroup,
    private readonly config: WizardValidationConfig
  ) {}

  attempt(step: number): readonly WizardValidationError[] {
    this.attemptedSteps.add(step);
    this.controlsFor(step).forEach(({ control }) => {
      control.markAsTouched();
      control.updateValueAndValidity({ emitEvent: false });
    });
    this.form.updateValueAndValidity({ emitEvent: false });
    return this.errors(step);
  }

  attemptAll(): readonly WizardValidationError[] {
    Object.keys(this.config.steps).forEach((step) => this.attemptedSteps.add(Number(step)));
    this.form.markAllAsTouched();
    this.form.updateValueAndValidity({ emitEvent: false });
    return this.errorsForScopes(this.allScopePaths());
  }

  isAttempted(step: number): boolean {
    return this.attemptedSteps.has(step);
  }

  scopePaths(step: number): readonly string[] {
    return this.config.steps[step] ?? [];
  }

  errors(step: number): readonly WizardValidationError[] {
    return this.errorsForScopes(this.scopePaths(step));
  }

  firstError(step: number): WizardValidationError | null {
    return this.errors(step)[0] ?? null;
  }

  focusFirst(step: number): void {
    const error = this.firstError(step);
    if (!error || typeof document === "undefined") return;
    const targetId = this.config.fieldIds?.[error.path] ?? this.config.fieldIds?.[shortPath(error.path)];
    const selector = targetId
      ? `#${escapeSelector(targetId)}`
      : `[formControlName="${escapeSelector(shortPath(error.path))}"]`;
    const focus = (): void => {
      const target = document.querySelector<HTMLElement>(selector);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(focus);
    else queueMicrotask(focus);
  }

  private controlsFor(step: number): Array<{ path: string; control: AbstractControl<unknown> }> {
    const scopes = this.scopePaths(step);
    return collectControls(this.form).filter(({ path }) => inScope(path, scopes));
  }

  private errorsForScopes(scopes: readonly string[]): readonly WizardValidationError[] {
    const errors = collectControls(this.form)
      .filter(({ path, control }) => control.invalid && inScope(path, scopes))
      .map(({ path, control }) => ({ path, errors: control.errors ?? {} }));
    for (const [errorName, fieldPath] of Object.entries(this.config.groupErrorFields ?? {})) {
      if (!this.form.hasError(errorName) || !inScope(fieldPath, scopes) || errors.some((error) => error.path === fieldPath)) {
        continue;
      }
      errors.push({ path: fieldPath, errors: { [errorName]: true } });
    }
    return errors;
  }

  private allScopePaths(): readonly string[] {
    return [...new Set(Object.values(this.config.steps).flat())];
  }
}

function collectControls(control: AbstractControl<unknown>, path = ""): Array<{ path: string; control: AbstractControl<unknown> }> {
  if (control instanceof FormGroup) {
    return Object.entries(control.controls).flatMap(([name, child]) =>
      collectControls(child, path ? `${path}.${name}` : name)
    );
  }
  if (control instanceof FormArray) {
    return control.controls.flatMap((child, index) => collectControls(child, `${path}.${index}`));
  }
  return [{ path, control }];
}

function inScope(path: string, scopes: readonly string[]): boolean {
  return scopes.length === 0 || scopes.some((scope) => path === scope || path.startsWith(`${scope}.`));
}

function shortPath(path: string): string {
  return path.split(".").filter((part) => !/^\d+$/.test(part)).at(-1) ?? path;
}

function escapeSelector(value: string): string {
  return typeof CSS !== "undefined" && CSS.escape
    ? CSS.escape(value)
    : value.replace(/(["'\\#.:[\]()])/g, "\\$1");
}
