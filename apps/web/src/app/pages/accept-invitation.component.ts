import { CommonModule } from "@angular/common";
import { Component, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { OrganizationService } from "../organizations/organization.service";
import { trimmedRequired } from "../shared/forms/form-validators";
import { FieldErrorComponent, FormControlA11yDirective, FormErrorSummaryComponent, RequiredFieldIndicatorComponent } from "../shared/forms/form-feedback.components";
import { UiIconComponent } from "../shared/ui-icon.component";

@Component({
  selector: "kaklen-accept-invitation",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FieldErrorComponent, FormControlA11yDirective, FormErrorSummaryComponent, RequiredFieldIndicatorComponent, UiIconComponent],
  template: `
    <main class="dashboard-shell form-shell">
      <section class="dashboard-panel form-panel">
        <p class="eyebrow" i18n="@@invitationEyebrow">Invitación</p>
        <h1 i18n="@@acceptInvitationTitle">Aceptar invitación</h1>
        <form [formGroup]="form" (ngSubmit)="accept()">
          <kaklen-form-error-summary [form]="form" [submitted]="submitAttempted()" [labels]="fieldLabels" />
          <label>
            <span><span i18n="@@tokenLabel">Token</span><kaklen-required /></span>
            <input formControlName="token" maxlength="512" aria-required="true" aria-describedby="invitation-token-error" />
            <kaklen-field-error id="invitation-token-error" [control]="form.controls.token" [submitted]="submitAttempted()" />
          </label>
          <p class="form-error" *ngIf="message()">{{ message() }}</p>
          <button type="submit" [disabled]="loading()"><kaklen-icon name="check" /><span i18n="@@acceptButton">Aceptar</span></button>
        </form>
      </section>
    </main>
  `
})
export class AcceptInvitationComponent {
  readonly loading = signal(false);
  readonly message = signal<string | null>(null);
  readonly submitAttempted = signal(false);
  readonly fieldLabels = { token: $localize`:@@tokenLabel:Token` };
  readonly form = new FormGroup({
    token: new FormControl("", { nonNullable: true, validators: [Validators.required, trimmedRequired(), Validators.maxLength(512)] })
  });

  constructor(
    private readonly organizationService: OrganizationService,
    private readonly router: Router
  ) {}

  async accept(): Promise<void> {
    this.submitAttempted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.message.set(null);
    try {
      const organization = await this.organizationService.acceptInvitation(this.form.getRawValue().token.trim());
      await this.organizationService.setActiveOrganization(organization.id);
      await this.router.navigate(["/organizations", organization.id, "members"]);
    } catch {
      this.message.set($localize`:@@invitationInvalidError:La invitación no es válida o expiró.`);
    } finally {
      this.loading.set(false);
    }
  }
}
