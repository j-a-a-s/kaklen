import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { OrganizationInvitation, OrganizationMember, OrganizationRole } from "../organizations/organization.models";
import { OrganizationService } from "../organizations/organization.service";

@Component({
  selector: "kaklen-organization-members",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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
              <option value="VIEWER">VIEWER</option>
              <option value="MEMBER">MEMBER</option>
              <option value="MANAGER">MANAGER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>
          <button type="submit" [disabled]="inviteForm.invalid || loading()" i18n="@@inviteButton">Invitar</button>
        </form>
        <p *ngIf="lastInvitation()">
          <ng-container i18n="@@testTokenLabel">Token de prueba:</ng-container> <code>{{ lastInvitation()?.invitationToken }}</code>
        </p>
      </section>

      <section class="list-panel">
        <article class="item-row" *ngFor="let member of members()">
          <div>
            <strong>{{ member.firstName }} {{ member.lastName }}</strong>
            <small>{{ member.email }} · {{ member.role }}</small>
          </div>
          <div class="row-actions" *ngIf="canEditMembers()">
            <select [value]="member.role" (change)="changeRole(member, roleFromEvent($event))">
              <option value="OWNER">OWNER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="MANAGER">MANAGER</option>
              <option value="MEMBER">MEMBER</option>
              <option value="VIEWER">VIEWER</option>
            </select>
            <button type="button" class="secondary" (click)="remove(member)" i18n="@@removeButton">Quitar</button>
          </div>
        </article>
      </section>
    </main>
  `
})
export class OrganizationMembersComponent implements OnInit {
  readonly members = signal<OrganizationMember[]>([]);
  readonly lastInvitation = signal<OrganizationInvitation | null>(null);
  readonly loading = signal(false);
  readonly inviteForm = new FormGroup({
    email: new FormControl("", { nonNullable: true, validators: [Validators.required, Validators.email] }),
    role: new FormControl<OrganizationRole>("MEMBER", { nonNullable: true })
  });
  private organizationId = "";

  constructor(
    private readonly route: ActivatedRoute,
    private readonly organizationService: OrganizationService
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

  async invite(): Promise<void> {
    if (this.inviteForm.invalid) {
      return;
    }
    this.lastInvitation.set(await this.organizationService.invite(this.organizationId, this.inviteForm.getRawValue()));
  }

  async changeRole(member: OrganizationMember, role: OrganizationRole): Promise<void> {
    await this.organizationService.updateMember(this.organizationId, member.id, role);
    await this.loadMembers();
  }

  async remove(member: OrganizationMember): Promise<void> {
    await this.organizationService.removeMember(this.organizationId, member.id);
    await this.loadMembers();
  }

  private async loadMembers(): Promise<void> {
    this.members.set(await this.organizationService.members(this.organizationId));
  }
}
