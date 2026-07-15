import { CommonModule } from "@angular/common";
import { Component, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { OrganizationService } from "../organizations/organization.service";

@Component({
  selector: "kaklen-accept-invitation",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <main class="dashboard-shell form-shell">
      <section class="dashboard-panel form-panel">
        <p class="eyebrow" i18n="@@invitationEyebrow">Invitación</p>
        <h1 i18n="@@acceptInvitationTitle">Aceptar invitación</h1>
        <form [formGroup]="form" (ngSubmit)="accept()">
          <label>
            <span i18n="@@tokenLabel">Token</span>
            <input formControlName="token" />
          </label>
          <p class="form-error" *ngIf="message()">{{ message() }}</p>
          <button type="submit" [disabled]="form.invalid || loading()" i18n="@@acceptButton">Aceptar</button>
        </form>
      </section>
    </main>
  `
})
export class AcceptInvitationComponent {
  readonly loading = signal(false);
  readonly message = signal<string | null>(null);
  readonly form = new FormGroup({
    token: new FormControl("", { nonNullable: true, validators: [Validators.required] })
  });

  constructor(
    private readonly organizationService: OrganizationService,
    private readonly router: Router
  ) {}

  async accept(): Promise<void> {
    this.loading.set(true);
    this.message.set(null);
    try {
      const organization = await this.organizationService.acceptInvitation(this.form.getRawValue().token);
      await this.organizationService.setActiveOrganization(organization.id);
      await this.router.navigate(["/organizations", organization.id, "members"]);
    } catch {
      this.message.set($localize`:@@invitationInvalidError:La invitación no es válida o expiró.`);
    } finally {
      this.loading.set(false);
    }
  }
}
