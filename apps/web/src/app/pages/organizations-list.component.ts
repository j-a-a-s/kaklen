import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { Organization } from "../organizations/organization.models";
import { OrganizationService } from "../organizations/organization.service";

@Component({
  selector: "kaklen-organizations-list",
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header">
        <div>
          <p class="eyebrow" i18n="@@organizationsEyebrow">Organizaciones</p>
          <h1 i18n="@@organizationsTitle">Elige tu espacio de trabajo</h1>
        </div>
        <a class="button-link" routerLink="/organizations/new" i18n="@@createOrganizationLink">Crear organización</a>
      </section>

      <section class="dashboard-panel" *ngIf="loading()" i18n="@@organizationsLoading">Cargando organizaciones...</section>
      <section class="dashboard-panel" *ngIf="error()">{{ error() }}</section>
      <section class="dashboard-panel" *ngIf="!loading() && organizations().length === 0" i18n="@@organizationsEmpty">
        Aún no tienes organizaciones.
      </section>

      <section class="list-panel" *ngIf="organizations().length > 0">
        <article class="item-row" *ngFor="let organization of organizations()">
          <div>
            <strong>{{ organization.name }}</strong>
            <small>{{ organization.slug }}</small>
          </div>
          <div class="row-actions">
            <button type="button" class="secondary" (click)="activate(organization)" i18n="@@activateOrganizationButton">Activar</button>
            <a [routerLink]="['/organizations', organization.id, 'members']" i18n="@@membersLink">Miembros</a>
            <a [routerLink]="['/organizations', organization.id, 'settings']" i18n="@@settingsLink">Ajustes</a>
          </div>
        </article>
      </section>
    </main>
  `
})
export class OrganizationsListComponent implements OnInit {
  readonly organizations = signal<Organization[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor(private readonly organizationService: OrganizationService) {}

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      this.organizations.set(await this.organizationService.list());
    } catch {
      this.error.set($localize`:@@organizationsLoadError:No pudimos cargar tus organizaciones.`);
    } finally {
      this.loading.set(false);
    }
  }

  async activate(organization: Organization): Promise<void> {
    await this.organizationService.setActiveOrganization(organization.id);
  }
}
