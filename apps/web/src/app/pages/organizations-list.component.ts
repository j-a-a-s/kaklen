import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { countryLabel, currencyLabel } from "../i18n/display-labels";
import { Organization } from "../organizations/organization.models";
import { OrganizationService } from "../organizations/organization.service";
import { EmptyStateComponent } from "../shared/empty-state.component";

@Component({
  selector: "kaklen-organizations-list",
  standalone: true,
  imports: [CommonModule, RouterLink, EmptyStateComponent],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header">
        <div>
          <p class="eyebrow" i18n="@@organizationsEyebrow">Organizaciones</p>
          <h1 i18n="@@organizationsTitle">Elige tu espacio de trabajo</h1>
        </div>
        <a class="button-link" routerLink="/organizations/new" i18n="@@createOrganizationLink">Crear organización</a>
      </section>

      <section class="dashboard-skeleton" *ngIf="loading()" aria-label="Cargando organizaciones" i18n-aria-label="@@organizationsLoading">
        <span *ngFor="let item of skeletonItems" aria-hidden="true"></span>
      </section>
      <p class="form-error" *ngIf="error()">{{ error() }}</p>
      <kaklen-empty-state
        *ngIf="!loading() && organizations().length === 0"
        icon="building"
        [title]="organizationsEmptyTitle"
        [description]="organizationsEmptyDescription"
      >
        <a class="button-link" routerLink="/organizations/new" i18n="@@createOrganizationLink">Crear organización</a>
      </kaklen-empty-state>

      <section class="organization-grid" *ngIf="organizations().length > 0">
        <article class="organization-card" *ngFor="let organization of organizations()">
          <div class="entity-heading">
            <span class="entity-avatar square" aria-hidden="true">{{ organization.name.charAt(0).toUpperCase() }}</span>
            <div>
              <strong>{{ organization.name }}</strong>
              <small>{{ organization.slug }}</small>
            </div>
          </div>
          <dl>
            <div><dt i18n="@@countryLabel">País</dt><dd>{{ countryName(organization.country) }}</dd></div>
            <div><dt i18n="@@currencyLabel">Moneda</dt><dd>{{ currencyName(organization.currency) }}</dd></div>
          </dl>
          <div class="row-actions">
            <button type="button" (click)="activate(organization)" i18n="@@openOrganizationButton">Abrir organización</button>
            <a class="secondary-link" [routerLink]="['/organizations', organization.id, 'settings']" i18n="@@settingsLink">Ajustes</a>
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
  readonly skeletonItems = [0, 1, 2];
  readonly organizationsEmptyTitle = $localize`:@@organizationsEmptyTitle:Crea tu primer espacio de trabajo`;
  readonly organizationsEmptyDescription = $localize`:@@organizationsEmpty:Tu organización mantendrá separados sus clientes, productos, cotizaciones y eventos.`;

  constructor(
    private readonly organizationService: OrganizationService,
    private readonly router: Router
  ) {}

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
    await this.router.navigate(["/organizations", organization.id]);
  }

  countryName(country: string): string {
    return countryLabel(country);
  }

  currencyName(currency: string): string {
    return currencyLabel(currency);
  }
}
