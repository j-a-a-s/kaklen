import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { AssistedDashboard, ActivationStep } from "../assistant/assistant.models";
import { AssistantService } from "../assistant/assistant.service";
import { ProductAnalyticsService } from "../assistant/product-analytics.service";
import { AuthUser } from "../auth/auth.models";
import { AuthService } from "../auth/auth.service";
import { formatRegionalDate } from "../i18n/formatting";
import { OrganizationService } from "../organizations/organization.service";
import { EmptyStateComponent } from "../shared/empty-state.component";
import { OrganizationActivityComponent } from "../shared/organization-activity.component";

interface OnboardingStepView {
  id: string;
  number: number;
  title: string;
  description: string;
  action: string;
  route: string;
  completed: boolean;
}

@Component({
  selector: "kaklen-dashboard",
  standalone: true,
  imports: [CommonModule, RouterLink, EmptyStateComponent, OrganizationActivityComponent],
  template: `
    <main class="dashboard-shell assisted-dashboard">
      <section class="dashboard-header dashboard-welcome">
        <div>
          <p class="eyebrow" i18n="@@dashboardEyebrow">Resumen de hoy</p>
          <h1>{{ greetingLabel() }}, {{ user()?.firstName || fallbackName }}</h1>
          <p *ngIf="activeOrganizationName(); else noActiveOrganization"><span i18n="@@dashboardContext">Esto es lo más importante en</span> <strong>{{ activeOrganizationName() }}</strong>.</p>
          <ng-template #noActiveOrganization><p i18n="@@dashboardNoOrganization">Elige una organización para comenzar a trabajar.</p></ng-template>
        </div>
        <a class="secondary-link" routerLink="/organizations" i18n="@@changeOrganizationButton">Cambiar organización</a>
      </section>

      <kaklen-empty-state *ngIf="!loading() && !organizationId()" icon="building" [title]="noOrganizationTitle" [description]="noOrganizationDescription">
        <a class="button-link" routerLink="/organizations/new" i18n="@@createOrganizationLink">Crear organización</a>
      </kaklen-empty-state>

      <section class="dashboard-skeleton" *ngIf="loading()" aria-label="Cargando resumen" i18n-aria-label="@@dashboardLoadingLabel"><span *ngFor="let item of skeletonItems" aria-hidden="true"></span></section>
      <p class="form-error" *ngIf="error()">{{ error() }}</p>

      <ng-container *ngIf="!loading() && dashboard() as summary">
        <section class="recommended-action-banner">
          <span class="recommended-action-icon" aria-hidden="true">→</span>
          <div><p class="eyebrow" i18n="@@recommendedNextStepEyebrow">Siguiente acción recomendada</p><h2>{{ recommendationTitle(summary.recommendedAction.kind) }}</h2><p>{{ recommendationDescription(summary.recommendedAction.kind) }}</p></div>
          <a class="button-link" [routerLink]="summary.recommendedAction.route">{{ recommendationAction(summary.recommendedAction.kind) }}</a>
        </section>

        <section class="metric-card-grid five-columns" aria-label="Indicadores principales" i18n-aria-label="@@mainMetricsAriaLabel">
          <a [routerLink]="['/organizations', organizationId(), 'events']" class="metric-card"><span class="metric-icon events" aria-hidden="true">□</span><span><strong>{{ summary.counts.upcomingEvents }}</strong><small i18n="@@upcomingEventsMetric">eventos próximos</small></span><span aria-hidden="true">→</span></a>
          <a [routerLink]="['/organizations', organizationId(), 'quotations']" [queryParams]="{ status: 'SENT' }" class="metric-card"><span class="metric-icon quotations" aria-hidden="true">▤</span><span><strong>{{ summary.counts.pendingQuotations }}</strong><small i18n="@@pendingQuotationsToday">cotizaciones por responder</small></span><span aria-hidden="true">→</span></a>
          <a [routerLink]="['/organizations', organizationId(), 'quotations']" class="metric-card attention"><span class="metric-icon" aria-hidden="true">!</span><span><strong>{{ summary.counts.expiringQuotations }}</strong><small i18n="@@expiringQuotationsMetric">cotizaciones por vencer</small></span><span aria-hidden="true">→</span></a>
          <a [routerLink]="['/organizations', organizationId(), 'events']" class="metric-card attention"><span class="metric-icon" aria-hidden="true">✓</span><span><strong>{{ summary.counts.urgentTasks }}</strong><small i18n="@@urgentTasksMetric">tareas prioritarias</small></span><span aria-hidden="true">→</span></a>
          <a [routerLink]="['/organizations', organizationId(), 'clients']" class="metric-card"><span class="metric-icon clients" aria-hidden="true">◎</span><span><strong>{{ summary.counts.clientsWithoutRecentInteraction }}</strong><small i18n="@@clientsWithoutFollowUpMetric">clientes por contactar</small></span><span aria-hidden="true">→</span></a>
        </section>

        <section class="dashboard-panel onboarding-panel assisted-onboarding" *ngIf="!onboardingHidden()" [class.completed]="summary.activation.isCompleted">
          <div class="section-heading compact">
            <div><p class="eyebrow" i18n="@@onboardingEyebrow">Primeros pasos</p><h2>{{ summary.activation.isCompleted ? onboardingCompleteTitle : onboardingTitle }}</h2><p>{{ summary.activation.isCompleted ? onboardingCompleteDescription : onboardingDescription }}</p></div>
            <strong *ngIf="!summary.activation.isCompleted">{{ summary.activation.percentage }}%</strong>
            <button type="button" class="icon-button" (click)="hideOnboarding()" aria-label="Ocultar por ahora" i18n-aria-label="@@hideOnboardingButton">×</button>
          </div>
          <div class="progress-track" role="progressbar" [attr.aria-valuenow]="summary.activation.percentage" aria-valuemin="0" aria-valuemax="100"><span [style.width.%]="summary.activation.percentage"></span></div>
          <button type="button" class="secondary" *ngIf="summary.activation.isCompleted" (click)="toggleOnboardingDetails()">{{ showOnboardingDetails() ? hideDetailsLabel : showDetailsLabel }}</button>
          <ol class="guided-onboarding-list" *ngIf="!summary.activation.isCompleted || showOnboardingDetails()">
            <li *ngFor="let step of onboardingSteps(summary)" [class.complete]="step.completed">
              <span class="step-state" aria-hidden="true">{{ step.completed ? '✓' : step.number }}</span>
              <div><strong>{{ step.title }}</strong><p>{{ step.description }}</p></div>
              <span *ngIf="step.completed" class="status-success" i18n="@@onboardingCompletedLabel">Completado</span>
              <a *ngIf="!step.completed" class="secondary-link" [routerLink]="step.route">{{ step.action }}</a>
            </li>
          </ol>
        </section>
        <button type="button" class="show-onboarding-link" *ngIf="onboardingHidden()" (click)="showOnboarding()" i18n="@@showOnboardingButton">Ver guía de primeros pasos</button>

        <section class="assisted-dashboard-columns">
          <article class="dashboard-panel today-panel">
            <div class="section-heading"><div><p class="eyebrow" i18n="@@todayAttentionEyebrow">Requiere atención</p><h2 i18n="@@todayAttentionTitle">Prioridades operativas</h2></div></div>
            <div class="actionable-feed">
              <a *ngFor="let quotation of summary.pendingQuotations" [routerLink]="quotation.route"><span aria-hidden="true">▤</span><span><strong>{{ quotation.number }} · {{ quotation.clientName }}</strong><small><span i18n="@@validUntilShortLabel">Vence</span> {{ dateLabel(quotation.validUntil) }}</small></span><span aria-hidden="true">→</span></a>
              <a *ngFor="let task of summary.urgentTasks" [routerLink]="task.route"><span aria-hidden="true">!</span><span><strong>{{ task.title }}</strong><small>{{ task.eventName }}<ng-container *ngIf="task.dueAt"> · {{ dateLabel(task.dueAt) }}</ng-container></small></span><span aria-hidden="true">→</span></a>
              <p class="empty-inline" *ngIf="summary.pendingQuotations.length === 0 && summary.urgentTasks.length === 0" i18n="@@noUrgentWork">No hay tareas urgentes ni cotizaciones esperando respuesta.</p>
            </div>
          </article>
          <article class="dashboard-panel upcoming-panel">
            <div class="section-heading"><div><p class="eyebrow" i18n="@@upcomingEyebrow">Próximamente</p><h2 i18n="@@upcomingEventsTitle">Eventos en agenda</h2></div><a [routerLink]="['/organizations', organizationId(), 'events']" i18n="@@viewAllLink">Ver todos</a></div>
            <div class="actionable-feed">
              <a *ngFor="let event of summary.upcomingEvents" [routerLink]="event.route"><span aria-hidden="true">□</span><span><strong>{{ event.name }}</strong><small>{{ dateLabel(event.startAt) }}</small></span><span aria-hidden="true">→</span></a>
              <p class="empty-inline" *ngIf="summary.upcomingEvents.length === 0" i18n="@@noUpcomingEvents">Aún no hay eventos próximos. Crea uno para organizar fechas, tareas y recursos.</p>
            </div>
          </article>
        </section>

        <section class="dashboard-panel recent-activity-panel">
          <div class="section-heading"><div><p class="eyebrow" i18n="@@organizationActivityEyebrow">Trabajo del equipo</p><h2 i18n="@@recentActivityTitle">Actividad reciente</h2></div></div>
          <kaklen-organization-activity [items]="summary.recentActivity" />
        </section>
      </ng-container>
    </main>
  `
})
export class DashboardComponent implements OnInit {
  readonly loading = signal(false);
  readonly error = signal("");
  readonly user = signal<AuthUser | null>(null);
  readonly organizationId = signal<string | null>(null);
  readonly dashboard = signal<AssistedDashboard | null>(null);
  readonly onboardingHidden = signal(false);
  readonly showOnboardingDetails = signal(false);
  readonly skeletonItems = [0, 1, 2, 3, 4];
  readonly fallbackName = $localize`:@@dashboardFallbackName:usuario`;
  readonly noOrganizationTitle = $localize`:@@noOrganizationTitle:Crea tu primer espacio de trabajo`;
  readonly noOrganizationDescription = $localize`:@@noOrganizationDescription:Una organización reúne clientes, catálogo, cotizaciones y eventos en un solo lugar.`;
  readonly onboardingTitle = $localize`:@@onboardingTitle:Configura tu espacio`;
  readonly onboardingDescription = $localize`:@@onboardingDescription:Completa estos pasos para pasar de tus primeros datos a una operación lista para trabajar.`;
  readonly onboardingCompleteTitle = $localize`:@@onboardingCompleteTitle:Configuración inicial completada`;
  readonly onboardingCompleteDescription = $localize`:@@onboardingCompleteDescription:Tu espacio está listo. Ahora puedes concentrarte en clientes, cotizaciones y eventos.`;
  readonly showDetailsLabel = $localize`:@@showDetailsButton:Ver detalles`;
  readonly hideDetailsLabel = $localize`:@@hideDetailsButton:Ocultar detalles`;

  constructor(
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly organizationService: OrganizationService,
    private readonly assistantService: AssistantService,
    private readonly analytics: ProductAnalyticsService
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      this.user.set(await this.authService.me());
      await this.organizationService.list();
      const requestedOrganizationId = this.route.snapshot.paramMap.get("organizationId");
      if (requestedOrganizationId) await this.organizationService.setActiveOrganization(requestedOrganizationId);
      const organizationId = this.organizationService.activeOrganizationId();
      this.organizationId.set(organizationId);
      if (organizationId) {
        this.onboardingHidden.set(sessionStorage.getItem(this.onboardingStorageKey(organizationId)) === "true");
        const dashboard = await this.assistantService.dashboard(organizationId);
        this.dashboard.set(dashboard);
        if (!dashboard.activation.isCompleted) this.analytics.track("onboarding_started", { flow: "onboarding", source: "dashboard" });
      }
    } catch {
      this.error.set($localize`:@@dashboardLoadError:No pudimos cargar el resumen. Intenta actualizar la página.`);
    } finally {
      this.loading.set(false);
    }
  }

  greetingLabel(): string {
    const hour = new Date().getHours();
    if (hour < 12) return $localize`:@@goodMorningGreeting:Buenos días`;
    return hour < 19 ? $localize`:@@goodAfternoonGreeting:Buenas tardes` : $localize`:@@goodEveningGreeting:Buenas noches`;
  }

  activeOrganizationName(): string {
    return this.organizationService.activeOrganization()?.name ?? "";
  }

  dateLabel(value: string): string {
    const organization = this.organizationService.activeOrganization();
    return formatRegionalDate(value, { dateFormat: organization?.dateFormat ?? "dd-MM-yyyy", numberFormat: organization?.numberFormat ?? "es" });
  }

  hideOnboarding(): void {
    const organizationId = this.organizationId();
    if (organizationId) sessionStorage.setItem(this.onboardingStorageKey(organizationId), "true");
    this.onboardingHidden.set(true);
  }

  showOnboarding(): void {
    const organizationId = this.organizationId();
    if (organizationId) sessionStorage.removeItem(this.onboardingStorageKey(organizationId));
    this.onboardingHidden.set(false);
  }

  toggleOnboardingDetails(): void {
    this.showOnboardingDetails.update((value) => !value);
  }

  onboardingSteps(summary: AssistedDashboard): OnboardingStepView[] {
    const organizationId = this.organizationId() ?? "";
    const complete = (step: ActivationStep): boolean => summary.activation.completedSteps.includes(step);
    return [
      { id: "organization", number: 1, title: $localize`:@@guidedOrganizationTitle:Configura tu organización`, description: $localize`:@@guidedOrganizationDescription:Define identidad, país, moneda y zona horaria.`, action: $localize`:@@configureAction:Configurar`, route: `/organizations/${organizationId}/settings`, completed: complete("organization_configured") },
      { id: "client", number: 2, title: $localize`:@@guidedClientTitle:Crea tu primer cliente`, description: $localize`:@@guidedClientDescription:Registra a la persona o empresa con la que trabajarás.`, action: $localize`:@@newClientButton:Nuevo cliente`, route: `/organizations/${organizationId}/clients/new`, completed: complete("first_client_created") },
      { id: "catalog", number: 3, title: $localize`:@@guidedCatalogTitle:Agrega productos o servicios`, description: $localize`:@@guidedCatalogDescription:Guarda precios y unidades para cotizar sin repetir trabajo.`, action: $localize`:@@addCatalogItemButton:Agregar producto o servicio`, route: `/organizations/${organizationId}/catalog/new`, completed: complete("first_catalog_item_created") },
      { id: "quotation", number: 4, title: $localize`:@@guidedQuotationTitle:Crea y envía una cotización`, description: $localize`:@@guidedQuotationDescription:Convierte las necesidades del cliente en una propuesta clara.`, action: $localize`:@@newQuotationButton:Nueva cotización`, route: `/organizations/${organizationId}/quotations/new`, completed: complete("first_quotation_created") && complete("first_quotation_sent") },
      { id: "approval", number: 5, title: $localize`:@@guidedApprovalTitle:Registra la aprobación`, description: $localize`:@@guidedApprovalDescription:Confirma la propuesta que se convertirá en trabajo operativo.`, action: $localize`:@@viewQuotationsAction:Ver cotizaciones`, route: `/organizations/${organizationId}/quotations`, completed: complete("first_quotation_approved") },
      { id: "event", number: 6, title: $localize`:@@guidedEventTitle:Crea tu primer evento`, description: $localize`:@@guidedEventDescription:Organiza fechas, equipo, tareas y recursos.`, action: $localize`:@@newEventButton:Nuevo evento`, route: `/organizations/${organizationId}/events/new`, completed: complete("first_event_created") }
    ];
  }

  recommendationTitle(kind: string): string {
    return this.recommendation(kind).title;
  }

  recommendationDescription(kind: string): string {
    return this.recommendation(kind).description;
  }

  recommendationAction(kind: string): string {
    return this.recommendation(kind).action;
  }

  private recommendation(kind: string): { title: string; description: string; action: string } {
    const copy: Record<string, { title: string; description: string; action: string }> = {
      organization_configured: { title: $localize`:@@recommendedOrganizationTitle:Completa la configuración de tu organización`, description: $localize`:@@recommendedOrganizationDescription:La información regional permite usar fechas, moneda e impuestos correctamente.`, action: $localize`:@@configureAction:Configurar` },
      first_client_created: { title: $localize`:@@recommendedClientTitle:Agrega tu primer cliente`, description: $localize`:@@recommendedClientDescription:Es el punto de partida para cotizar y organizar nuevos trabajos.`, action: $localize`:@@newClientButton:Nuevo cliente` },
      first_catalog_item_created: { title: $localize`:@@recommendedCatalogTitle:Completa tu catálogo`, description: $localize`:@@recommendedCatalogDescription:Guarda productos y servicios para cotizar más rápido.`, action: $localize`:@@addCatalogItemButton:Agregar producto o servicio` },
      first_quotation_created: { title: $localize`:@@recommendedQuotationTitle:Crea una nueva cotización`, description: $localize`:@@recommendedQuotationDescription:Convierte la información de clientes y catálogo en una propuesta clara.`, action: $localize`:@@newQuotationButton:Nueva cotización` },
      first_quotation_sent: { title: $localize`:@@recommendedSendQuotationTitle:Envía tu primera cotización`, description: $localize`:@@recommendedSendQuotationDescription:Compártela con el cliente para iniciar el seguimiento comercial.`, action: $localize`:@@viewQuotationsAction:Ver cotizaciones` },
      first_quotation_approved: { title: $localize`:@@recommendedApprovalTitle:Registra la primera aprobación`, description: $localize`:@@recommendedApprovalDescription:Una propuesta aprobada puede transformarse directamente en un evento.`, action: $localize`:@@viewQuotationsAction:Ver cotizaciones` },
      first_event_created: { title: $localize`:@@recommendedEventTitle:Crea tu primer evento`, description: $localize`:@@recommendedEventDescription:Organiza la ejecución de una cotización aprobada o un trabajo manual.`, action: $localize`:@@newEventButton:Nuevo evento` },
      quotation_expiring: { title: $localize`:@@recommendedExpiringTitle:Da seguimiento a una cotización por vencer`, description: $localize`:@@recommendedExpiringDescription:Una respuesta a tiempo mantiene viva la oportunidad.`, action: $localize`:@@openQuotationAction:Abrir cotización` },
      event_upcoming: { title: $localize`:@@recommendedUpcomingEventTitle:Revisa tu próximo evento`, description: $localize`:@@recommendedUpcomingEventDescription:Confirma tareas, participantes y recursos antes de comenzar.`, action: $localize`:@@openEventAction:Abrir evento` },
      task_urgent: { title: $localize`:@@recommendedUrgentTaskTitle:Resuelve una tarea prioritaria`, description: $localize`:@@recommendedUrgentTaskDescription:Atenderla ahora reduce riesgos para el evento.`, action: $localize`:@@reviewTaskAction:Revisar tarea` },
      client_follow_up: { title: $localize`:@@recommendedFollowUpTitle:Retoma contacto con un cliente`, description: $localize`:@@recommendedFollowUpDescription:Un seguimiento breve puede abrir una nueva oportunidad.`, action: $localize`:@@openClientAction:Abrir cliente` },
      create_opportunity: { title: $localize`:@@recommendedOpportunityTitle:Crea una nueva oportunidad`, description: $localize`:@@recommendedOpportunityDescription:Tu operación está al día. Prepara la próxima propuesta comercial.`, action: $localize`:@@newQuotationButton:Nueva cotización` }
    };
    return copy[kind] ?? copy["create_opportunity"];
  }

  private onboardingStorageKey(organizationId: string): string {
    return `kaklen.onboarding.hidden.${organizationId}`;
  }
}
