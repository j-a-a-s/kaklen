import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { organizationRoleLabel } from "../i18n/display-labels";
import { OrganizationInvitation, OrganizationMember, OrganizationRole } from "../organizations/organization.models";
import { OrganizationService } from "../organizations/organization.service";
import { NotificationService } from "../shared/notifications/notification.service";
import { ConfirmationDialogComponent } from "../shared/confirmation-dialog.component";

@Component({
  selector: "kaklen-organization-members",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ConfirmationDialogComponent],
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
          <label>
            <span i18n="@@emailLabel">Email</span>
            <input type="email" formControlName="email" />
          </label>
          <label>
            <span i18n="@@roleLabel">Rol</span>
            <select formControlName="role">
              <option value="VIEWER">{{ roleLabel('VIEWER') }}</option>
              <option value="MEMBER">{{ roleLabel('MEMBER') }}</option>
              <option value="MANAGER">{{ roleLabel('MANAGER') }}</option>
              <option value="ADMIN">{{ roleLabel('ADMIN') }}</option>
            </select>
          </label>
          <button type="submit" [disabled]="inviteForm.invalid || loading()">
            {{ loading() ? invitingLabel : inviteLabel }}
          </button>
        </form>
        <p *ngIf="lastInvitation()">
          <ng-container i18n="@@testTokenLabel">Token de prueba:</ng-container> <code>{{ lastInvitation()?.invitationToken }}</code>
        </p>
      </section>

      <section class="list-panel">
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
            <details class="action-menu"><summary aria-label="Más acciones" i18n-aria-label="@@moreActionsLabel">•••</summary><div class="action-menu-panel"><button type="button" class="danger" (click)="pendingRemoval.set(member)" i18n="@@removeButton">Quitar</button></div></details>
          </div>
        </article>
      </section>
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
  readonly pendingRemoval = signal<OrganizationMember | null>(null);
  readonly inviteLabel = $localize`:@@inviteButton:Invitar`;
  readonly invitingLabel = $localize`:@@invitingButton:Invitando...`;
  readonly removeDialogTitle = $localize`:@@removeMemberDialogTitle:Quitar miembro`;
  readonly removeDialogDescription = $localize`:@@removeMemberDialogDescription:La persona perderá inmediatamente el acceso a esta organización y a sus datos.`;
  readonly removeLabel = $localize`:@@removeMemberAction:Quitar acceso`;
  readonly inviteForm = new FormGroup({
    email: new FormControl("", { nonNullable: true, validators: [Validators.required, Validators.email] }),
    role: new FormControl<OrganizationRole>("MEMBER", { nonNullable: true })
  });
  private organizationId = "";

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

  async invite(): Promise<void> {
    if (this.inviteForm.invalid) {
      return;
    }
    this.loading.set(true);
    try {
      this.lastInvitation.set(await this.organizationService.invite(this.organizationId, this.inviteForm.getRawValue()));
      this.notifications.success($localize`:@@invitationSentSuccess:Invitación enviada correctamente.`);
      this.inviteForm.reset({ email: "", role: "MEMBER" });
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
