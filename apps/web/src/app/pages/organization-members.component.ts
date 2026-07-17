import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { organizationRoleLabel } from "../i18n/display-labels";
import { OrganizationInvitation, OrganizationMember, OrganizationRole } from "../organizations/organization.models";
import { OrganizationService } from "../organizations/organization.service";
import { NotificationService } from "../shared/notifications/notification.service";
import { ConfirmationDialogComponent } from "../shared/confirmation-dialog.component";
import { EmptyStateComponent } from "../shared/empty-state.component";
import { ActionMenuComponent, ActionMenuItemDirective } from "../shared/action-menu.component";
import { emailValidator, normalizeEmail } from "../shared/forms/form-validators";
import { FieldErrorComponent, FormControlA11yDirective, FormErrorSummaryComponent, RequiredFieldIndicatorComponent } from "../shared/forms/form-feedback.components";
import { UiIconComponent } from "../shared/ui-icon.component";

@Component({
  selector: "kaklen-organization-members",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ConfirmationDialogComponent, EmptyStateComponent, ActionMenuComponent, ActionMenuItemDirective, FieldErrorComponent, FormControlA11yDirective, FormErrorSummaryComponent, RequiredFieldIndicatorComponent, UiIconComponent],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header">
        <div>
          <p class="eyebrow" i18n="@@membersEyebrow">Miembros</p>
          <h1 i18n="@@teamTitle">Equipo</h1>
        </div>
      </section>

      <section class="dashboard-panel" *ngIf="canInvite()">
        <h2 i18n="@@invitePersonTitle">Invitar persona</h2>
        <form [formGroup]="inviteForm" (ngSubmit)="invite()">
          <kaklen-form-error-summary [form]="inviteForm" [submitted]="submitAttempted()" [labels]="inviteFieldLabels" />
          <label>
            <span><span i18n="@@emailLabel">Email</span><kaklen-required /></span>
            <input id="member-invite-email" type="email" inputmode="email" maxlength="254" formControlName="email" aria-describedby="member-email-error" />
            <kaklen-field-error id="member-email-error" [control]="inviteForm.controls.email" [submitted]="submitAttempted()" />
          </label>
          <label>
            <span><span i18n="@@roleLabel">Rol</span><kaklen-required /></span>
            <select formControlName="role">
              <option value="VIEWER">{{ roleLabel('VIEWER') }}</option>
              <option value="MEMBER">{{ roleLabel('MEMBER') }}</option>
              <option value="MANAGER">{{ roleLabel('MANAGER') }}</option>
              <option value="ADMIN">{{ roleLabel('ADMIN') }}</option>
            </select>
          </label>
          <button type="submit" [disabled]="loading()">
            <kaklen-icon name="mail" /><span>{{ loading() ? invitingLabel : inviteLabel }}</span>
          </button>
        </form>
        <p *ngIf="lastInvitation()">
          <ng-container i18n="@@testTokenLabel">Token de prueba:</ng-container> <code>{{ lastInvitation()?.invitationToken }}</code>
        </p>
      </section>

      <section class="list-panel" *ngIf="members().length > 0; else emptyMembers">
        <article class="item-row" *ngFor="let member of members()">
          <div>
            <strong>{{ member.firstName }} {{ member.lastName }}</strong>
            <small>{{ member.email }} · {{ roleLabel(member.role) }}</small>
          </div>
          <div class="row-actions" *ngIf="canEditMembers()">
            <select [value]="member.role" (change)="changeRole(member, roleFromEvent($event))">
              <option value="OWNER">{{ roleLabel('OWNER') }}</option>
              <option value="ADMIN">{{ roleLabel('ADMIN') }}</option>
              <option value="MANAGER">{{ roleLabel('MANAGER') }}</option>
              <option value="MEMBER">{{ roleLabel('MEMBER') }}</option>
              <option value="VIEWER">{{ roleLabel('VIEWER') }}</option>
            </select>
            <kaklen-action-menu [contextKey]="organizationId"><button kaklenMenuItem type="button" class="danger" (click)="pendingRemoval.set(member)"><kaklen-icon name="x-circle" /><span i18n="@@removeButton">Quitar</span></button></kaklen-action-menu>
          </div>
        </article>
      </section>
      <ng-template #emptyMembers>
        <kaklen-empty-state icon="users" [title]="membersEmptyTitle" [description]="membersEmptyDescription">
          <button type="button" *ngIf="canInvite()" (click)="focusInvite()" i18n="@@inviteFirstMemberAction">Invitar al primer miembro</button>
        </kaklen-empty-state>
      </ng-template>
      <kaklen-confirmation-dialog
        [open]="pendingRemoval() !== null"
        [busy]="loading()"
        [title]="removeDialogTitle"
        [description]="removeDialogDescription"
        [confirmLabel]="removeLabel"
        (confirm)="remove()"
        (cancel)="pendingRemoval.set(null)"
      />
    </main>
  `
})
export class OrganizationMembersComponent implements OnInit {
  readonly members = signal<OrganizationMember[]>([]);
  readonly lastInvitation = signal<OrganizationInvitation | null>(null);
  readonly loading = signal(false);
  readonly submitAttempted = signal(false);
  readonly pendingRemoval = signal<OrganizationMember | null>(null);
  readonly inviteLabel = $localize`:@@inviteButton:Invitar`;
  readonly invitingLabel = $localize`:@@invitingButton:Invitando...`;
  readonly removeDialogTitle = $localize`:@@removeMemberDialogTitle:Quitar miembro`;
  readonly removeDialogDescription = $localize`:@@removeMemberDialogDescription:La persona perderá inmediatamente el acceso a esta organización y a sus datos.`;
  readonly removeLabel = $localize`:@@removeMemberAction:Quitar acceso`;
  readonly membersEmptyTitle = $localize`:@@membersEmptyTitle:Tu equipo comienza contigo`;
  readonly membersEmptyDescription = $localize`:@@membersEmptyDescription:Invita personas para repartir tareas y mantener permisos claros dentro de la organización.`;
  readonly inviteFieldLabels = {
    email: $localize`:@@emailLabel:Email`,
    role: $localize`:@@roleLabel:Rol`
  };
  readonly inviteForm = new FormGroup({
    email: new FormControl("", { nonNullable: true, validators: [emailValidator(true)] }),
    role: new FormControl<OrganizationRole>("MEMBER", { nonNullable: true, validators: [Validators.required] })
  });
  organizationId = "";

  constructor(
    private readonly route: ActivatedRoute,
    private readonly organizationService: OrganizationService,
    private readonly notifications: NotificationService
  ) {}

  async ngOnInit(): Promise<void> {
    this.organizationId = this.route.snapshot.paramMap.get("organizationId") ?? "";
    await this.organizationService.setActiveOrganization(this.organizationId);
    await this.loadMembers();
  }

  canInvite(): boolean {
    return this.organizationService.hasPermission("organization.members.invite");
  }

  canEditMembers(): boolean {
    return this.organizationService.hasPermission("organization.members.update");
  }

  roleFromEvent(event: Event): OrganizationRole {
    return (event.target as HTMLSelectElement).value as OrganizationRole;
  }

  roleLabel(role: OrganizationRole): string {
    return organizationRoleLabel(role);
  }

  focusInvite(): void {
    document.getElementById("member-invite-email")?.focus();
  }

  async invite(): Promise<void> {
    this.submitAttempted.set(true);
    if (this.inviteForm.invalid) {
      this.inviteForm.markAllAsTouched();
      this.focusInvite();
      return;
    }
    this.loading.set(true);
    try {
      const value = this.inviteForm.getRawValue();
      this.lastInvitation.set(await this.organizationService.invite(this.organizationId, { ...value, email: normalizeEmail(value.email) }));
      this.notifications.success($localize`:@@invitationSentSuccess:Invitación enviada correctamente.`);
      this.inviteForm.reset({ email: "", role: "MEMBER" });
      this.submitAttempted.set(false);
    } catch (error) {
      this.notifications.fromError(error);
    } finally {
      this.loading.set(false);
    }
  }

  async changeRole(member: OrganizationMember, role: OrganizationRole): Promise<void> {
    this.loading.set(true);
    try {
      await this.organizationService.updateMember(this.organizationId, member.id, role);
      this.notifications.success($localize`:@@memberRoleUpdatedSuccess:Rol actualizado correctamente.`);
      await this.loadMembers();
    } catch (error) {
      this.notifications.fromError(error);
    } finally {
      this.loading.set(false);
    }
  }

  async remove(): Promise<void> {
    const member = this.pendingRemoval();
    if (!member || this.loading()) {
      return;
    }
    this.loading.set(true);
    try {
      await this.organizationService.removeMember(this.organizationId, member.id);
      this.pendingRemoval.set(null);
      this.notifications.success($localize`:@@memberRemovedSuccess:Miembro eliminado correctamente.`);
      await this.loadMembers();
    } catch (error) {
      this.notifications.fromError(error);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadMembers(): Promise<void> {
    this.members.set(await this.organizationService.members(this.organizationId));
  }
}
