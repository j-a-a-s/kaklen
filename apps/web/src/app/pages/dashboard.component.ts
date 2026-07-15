import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { AuthUser } from "../auth/auth.models";
import { AuthService } from "../auth/auth.service";
import { CatalogService } from "../catalog/catalog.service";
import { ClientSummary } from "../clients/client.models";
import { ClientsService } from "../clients/clients.service";
import { EventSummary } from "../events/event.models";
import { EventsService } from "../events/events.service";
import { OrganizationService } from "../organizations/organization.service";
import { QuotationSummary } from "../quotations/quotation.models";
import { QuotationsService } from "../quotations/quotations.service";
import { EmptyStateComponent } from "../shared/empty-state.component";

@Component({
  selector: "kaklen-dashboard",
  standalone: true,
  imports: [CommonModule, RouterLink, EmptyStateComponent],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header dashboard-welcome">
        <div>
          <p class="eyebrow" i18n="@@dashboardEyebrow">Resumen de hoy</p>
          <h1>{{ greetingLabel() }}, {{ user()?.firstName || fallbackName }}</h1>
          <p *ngIf="activeOrganizationName(); else noActiveOrganization">
            <span i18n="@@dashboardContext">Esto es lo más importante en</span>
            <strong>{{ activeOrganizationName() }}</strong>.
          </p>
          <ng-template #noActiveOrganization>
            <p i18n="@@dashboardNoOrganization">Elige una organización para comenzar a trabajar.</p>
          </ng-template>
        </div>
        <a class="secondary-link" routerLink="/organizations" i18n="@@changeOrganizationButton">Cambiar organización</a>
      </section>

      <kaklen-empty-state
        *ngIf="!loading() && !organizationId()"
        icon="⌂"
        [title]="noOrganizationTitle"
        [description]="noOrganizationDescription"
      >
        <a class="button-link" routerLink="/organizations/new" i18n="@@createOrganizationLink">Crear organización</a>
      </kaklen-empty-state>

      <section class="dashboard-skeleton" *ngIf="loading()" aria-label="Cargando resumen" i18n-aria-label="@@dashboardLoadingLabel">
        <span *ngFor="let item of skeletonItems" aria-hidden="true"></span>
      </section>

      <ng-container *ngIf="!loading() && organizationId() as currentOrganizationId">
        <p class="form-error" *ngIf="error()">{{ error() }}</p>

        <section class="metric-card-grid" aria-label="Indicadores principales" i18n-aria-label="@@mainMetricsAriaLabel">
          <a *ngIf="can('events.read')" [routerLink]="['/organizations', currentOrganizationId, 'events']" class="metric-card">
            <span class="metric-icon events" aria-hidden="true">□</span>
            <span><strong>{{ eventSummary()?.confirmed || 0 }}</strong><small i18n="@@confirmedEventsToday">eventos confirmados</small></span>
            <span aria-hidden="true">→</span>
          </a>
          <a *ngIf="can('quotations.read')" [routerLink]="['/organizations', currentOrganizationId, 'quotations']" class="metric-card">
            <span class="metric-icon quotations" aria-hidden="true">▤</span>
            <span><strong>{{ quotationSummary()?.sent || 0 }}</strong><small i18n="@@pendingQuotationsToday">cotizaciones por responder</small></span>
            <span aria-hidden="true">→</span>
          </a>
          <a *ngIf="can('clients.read')" [routerLink]="['/organizations', currentOrganizationId, 'clients']" class="metric-card">
            <span class="metric-icon clients" aria-hidden="true">◎</span>
            <span><strong>{{ clientSummary()?.leads || 0 }}</strong><small i18n="@@clientLeadsToday">clientes potenciales</small></span>
            <span aria-hidden="true">→</span>
          </a>
          <a *ngIf="can('catalog.read')" [routerLink]="['/organizations', currentOrganizationId, 'catalog']" class="metric-card">
            <span class="metric-icon catalog" aria-hidden="true">◇</span>
            <span><strong>{{ catalogTotal() }}</strong><small i18n="@@catalogItemsToday">ítems en catálogo</small></span>
            <span aria-hidden="true">→</span>
          </a>
        </section>

        <section class="quick-actions-section">
          <div class="section-heading">
            <div>
              <p class="eyebrow" i18n="@@quickActionsEyebrow">Acciones rápidas</p>
              <h2 i18n="@@quickActionsTitle">Avanza con un clic</h2>
            </div>
            <small i18n="@@quickActionsHelp">Elige la acción que necesitas completar ahora.</small>
          </div>
          <div class="quick-action-grid">
            <a *ngIf="can('clients.create')" [routerLink]="['/organizations', currentOrganizationId, 'clients', 'new']">
              <span aria-hidden="true">+</span><strong i18n="@@newClientButton">Nuevo cliente</strong><small i18n="@@newClientHelp">Registra una persona o empresa</small>
            </a>
            <a *ngIf="can('quotations.create')" [routerLink]="['/organizations', currentOrganizationId, 'quotations', 'new']">
              <span aria-hidden="true">+</span><strong i18n="@@newQuotationButton">Nueva cotización</strong><small i18n="@@newQuotationHelp">Prepara una propuesta comercial</small>
            </a>
            <a *ngIf="can('events.create')" [routerLink]="['/organizations', currentOrganizationId, 'events', 'new']">
              <span aria-hidden="true">+</span><strong i18n="@@newEventButton">Nuevo evento</strong><small i18n="@@newEventHelp">Coordina fechas, tareas y recursos</small>
            </a>
            <a *ngIf="can('catalog.create')" [routerLink]="['/organizations', currentOrganizationId, 'catalog', 'new']">
              <span aria-hidden="true">+</span><strong i18n="@@addCatalogItemButton">Agregar producto</strong><small i18n="@@addCatalogItemHelp">Completa tu catálogo comercial</small>
            </a>
            <a *ngIf="can('organization.members.invite')" [routerLink]="['/organizations', currentOrganizationId, 'members']">
              <span aria-hidden="true">+</span><strong i18n="@@inviteUserButton">Invitar usuario</strong><small i18n="@@inviteUserHelp">Suma a alguien de tu equipo</small>
            </a>
          </div>
        </section>

        <section class="dashboard-columns">
          <article class="dashboard-panel onboarding-panel" [class.completed]="onboardingProgress() === 100">
            <div class="section-heading compact">
              <div>
                <p class="eyebrow" i18n="@@onboardingEyebrow">Primeros pasos</p>
                <h2 *ngIf="onboardingProgress() < 100" i18n="@@onboardingTitle">Configura tu espacio</h2>
                <h2 *ngIf="onboardingProgress() === 100" i18n="@@onboardingCompleteTitle">Configuración inicial completada</h2>
              </div>
              <strong *ngIf="onboardingProgress() < 100">{{ onboardingProgress() }}%</strong>
              <button type="button" class="secondary" *ngIf="onboardingProgress() === 100" (click)="toggleOnboardingDetails()">
                <span *ngIf="!showOnboardingDetails()" i18n="@@showDetailsButton">Ver detalles</span>
                <span *ngIf="showOnboardingDetails()" i18n="@@hideDetailsButton">Ocultar detalles</span>
              </button>
            </div>
            <p class="onboarding-complete-copy" *ngIf="onboardingProgress() === 100" i18n="@@onboardingCompleteDescription">Tu espacio está listo. Ahora puedes concentrarte en clientes, cotizaciones y eventos.</p>
            <div *ngIf="onboardingProgress() < 100 || showOnboardingDetails()" class="progress-track" role="progressbar" [attr.aria-valuenow]="onboardingProgress()" aria-valuemin="0" aria-valuemax="100">
              <span [style.width.%]="onboardingProgress()"></span>
            </div>
            <ol class="onboarding-list" *ngIf="onboardingProgress() < 100 || showOnboardingDetails()">
              <li class="complete"><span aria-hidden="true">✓</span><span i18n="@@onboardingOrganization">Crear una organización</span></li>
              <li [class.complete]="(clientSummary()?.total || 0) > 0"><span aria-hidden="true">{{ (clientSummary()?.total || 0) > 0 ? '✓' : '2' }}</span><a [routerLink]="['/organizations', currentOrganizationId, 'clients', 'new']" i18n="@@onboardingClient">Agregar el primer cliente</a></li>
              <li [class.complete]="catalogTotal() > 0"><span aria-hidden="true">{{ catalogTotal() > 0 ? '✓' : '3' }}</span><a [routerLink]="['/organizations', currentOrganizationId, 'catalog', 'new']" i18n="@@onboardingCatalog">Crear un producto o servicio</a></li>
              <li [class.complete]="(quotationSummary()?.total || 0) > 0"><span aria-hidden="true">{{ (quotationSummary()?.total || 0) > 0 ? '✓' : '4' }}</span><a [routerLink]="['/organizations', currentOrganizationId, 'quotations', 'new']" i18n="@@onboardingQuotation">Preparar la primera cotización</a></li>
            </ol>
          </article>

          <article class="dashboard-panel next-step-panel">
            <p class="eyebrow" i18n="@@recommendedNextStepEyebrow">Siguiente paso recomendado</p>
            <span class="next-step-icon" aria-hidden="true">{{ recommendedStep().icon }}</span>
            <h2>{{ recommendedStep().title }}</h2>
            <p>{{ recommendedStep().description }}</p>
            <a class="button-link" [routerLink]="recommendedStep().link">{{ recommendedStep().action }}</a>
          </article>
        </section>
      </ng-container>
    </main>
  `
})
export class DashboardComponent implements OnInit {
  readonly loading = signal(false);
  readonly error = signal("");
  readonly showOnboardingDetails = signal(false);
  readonly user = signal<AuthUser | null>(null);
  readonly organizationId = signal<string | null>(null);
  readonly clientSummary = signal<ClientSummary | null>(null);
  readonly quotationSummary = signal<QuotationSummary | null>(null);
  readonly eventSummary = signal<EventSummary | null>(null);
  readonly catalogTotal = signal(0);
  readonly skeletonItems = [0, 1, 2, 3];
  readonly fallbackName = $localize`:@@dashboardFallbackName:usuario`;
  readonly noOrganizationTitle = $localize`:@@noOrganizationTitle:Crea tu primer espacio de trabajo`;
  readonly noOrganizationDescription = $localize`:@@noOrganizationDescription:Una organización reúne clientes, catálogo, cotizaciones y eventos en un solo lugar.`;

  constructor(
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly organizationService: OrganizationService,
    private readonly clientsService: ClientsService,
    private readonly catalogService: CatalogService,
    private readonly quotationsService: QuotationsService,
    private readonly eventsService: EventsService
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    this.error.set("");
    try {
      this.user.set(await this.authService.me());
      await this.organizationService.list();
      const requestedOrganizationId = this.route.snapshot.paramMap.get("organizationId");
      if (requestedOrganizationId) {
        await this.organizationService.setActiveOrganization(requestedOrganizationId);
      }
      this.organizationId.set(this.organizationService.activeOrganizationId());
      if (this.organizationId()) {
        await this.loadOperationalSummary(this.organizationId() as string);
      }
    } catch {
      this.error.set($localize`:@@dashboardLoadError:No pudimos cargar el resumen. Intenta actualizar la página.`);
    } finally {
      this.loading.set(false);
    }
  }

  greetingLabel(): string {
    const hour = new Date().getHours();
    if (hour < 12) {
      return $localize`:@@goodMorningGreeting:Buenos días`;
    }
    return hour < 19 ? $localize`:@@goodAfternoonGreeting:Buenas tardes` : $localize`:@@goodEveningGreeting:Buenas noches`;
  }

  toggleOnboardingDetails(): void {
    this.showOnboardingDetails.update((show) => !show);
  }

  activeOrganizationName(): string {
    return this.organizationService.activeOrganization()?.name ?? "";
  }

  can(permission: Parameters<OrganizationService["hasPermission"]>[0]): boolean {
    return this.organizationService.hasPermission(permission);
  }

  onboardingProgress(): number {
    const completed = [
      true,
      (this.clientSummary()?.total || 0) > 0,
      this.catalogTotal() > 0,
      (this.quotationSummary()?.total || 0) > 0
    ].filter(Boolean).length;
    return completed * 25;
  }

  recommendedStep(): { icon: string; title: string; description: string; action: string; link: string[] } {
    const organizationId = this.organizationId() ?? "";
    if ((this.clientSummary()?.total || 0) === 0) {
      return {
        icon: "◎",
        title: $localize`:@@recommendedClientTitle:Agrega tu primer cliente`,
        description: $localize`:@@recommendedClientDescription:Es el punto de partida para cotizar y organizar nuevos trabajos.`,
        action: $localize`:@@newClientButton:Nuevo cliente`,
        link: ["/organizations", organizationId, "clients", "new"]
      };
    }
    if (this.catalogTotal() === 0) {
      return {
        icon: "◇",
        title: $localize`:@@recommendedCatalogTitle:Completa tu catálogo`,
        description: $localize`:@@recommendedCatalogDescription:Guarda productos y servicios para cotizar más rápido.`,
        action: $localize`:@@addCatalogItemButton:Agregar producto`,
        link: ["/organizations", organizationId, "catalog", "new"]
      };
    }
    return {
      icon: "▤",
      title: $localize`:@@recommendedQuotationTitle:Crea una nueva cotización`,
      description: $localize`:@@recommendedQuotationDescription:Convierte la información de clientes y catálogo en una propuesta clara.`,
      action: $localize`:@@newQuotationButton:Nueva cotización`,
      link: ["/organizations", organizationId, "quotations", "new"]
    };
  }

  private async loadOperationalSummary(organizationId: string): Promise<void> {
    const [clients, catalog, quotations, events] = await Promise.all([
      this.can("clients.read") ? this.clientsService.summary(organizationId) : Promise.resolve(null),
      this.can("catalog.read") ? this.catalogService.list(organizationId, { page: 1, pageSize: 1 }) : Promise.resolve(null),
      this.can("quotations.read") ? this.quotationsService.summary(organizationId) : Promise.resolve(null),
      this.can("events.read") ? this.eventsService.summary(organizationId) : Promise.resolve(null)
    ]);
    this.clientSummary.set(clients);
    this.catalogTotal.set(catalog?.total ?? 0);
    this.quotationSummary.set(quotations);
    this.eventSummary.set(events);
  }
}
