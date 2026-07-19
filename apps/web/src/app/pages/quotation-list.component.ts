import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { formatRegionalCurrency, formatRegionalDate, formatRegionalMoneyValue } from "../i18n/formatting";
import { OrganizationService } from "../organizations/organization.service";
import { PaginatedQuotations, QuotationStatus, QuotationSummary } from "../quotations/quotation.models";
import { QuotationsService } from "../quotations/quotations.service";
import { EmptyStateComponent } from "../shared/empty-state.component";
import { StatusBadgeComponent } from "../shared/status-badge.component";
import {
  backendErrorDetails,
  BackendErrorDetails,
  isBackendErrorCode,
  NotificationService,
  quotationIntegrityMessage
} from "../shared/notifications/notification.service";
import { ConfirmationDialogComponent } from "../shared/confirmation-dialog.component";
import { UiIconComponent } from "../shared/ui-icon.component";

@Component({
  selector: "kaklen-quotation-list",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, EmptyStateComponent, StatusBadgeComponent, ConfirmationDialogComponent, UiIconComponent],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header">
        <div>
          <p class="eyebrow" i18n="@@quotationsEyebrow">Cotizaciones</p>
          <h1 i18n="@@quotationsTitle">Cotizaciones</h1>
          <p i18n="@@quotationsDescription">Crea, envía y controla propuestas comerciales por organización.</p>
        </div>
        <a *ngIf="canCreate()" class="button-link" [routerLink]="['/organizations', organizationId, 'quotations', 'new']" i18n="@@newQuotationButton">Nueva cotización</a>
      </section>

      <section class="dashboard-panel pipeline-summary" *ngIf="summary() as currentSummary">
        <div class="metrics-grid">
          <span><strong>{{ currentSummary.total }}</strong><small i18n="@@totalLabel">Total</small></span>
          <span><strong>{{ currentSummary.draft }}</strong><small i18n="@@quotationDraftPluralLabel">Borradores</small></span>
          <span><strong>{{ currentSummary.sent }}</strong><small i18n="@@quotationSentPluralLabel">Enviadas</small></span>
          <span><strong>{{ currentSummary.approved }}</strong><small i18n="@@quotationApprovedPluralLabel">Aprobadas</small></span>
          <span><strong>{{ baseApprovedAmountLabel(currentSummary) }}</strong><small i18n="@@approvedBaseCurrencyLabel">Aprobado en moneda base</small></span>
        </div>
        <div class="approved-currency-breakdown" *ngIf="otherApprovedAmounts(currentSummary).length">
          <span i18n="@@approvedOtherAmountsLabel">Otros importes aprobados</span>
          <strong *ngFor="let item of otherApprovedAmounts(currentSummary)">{{ approvedAmountLabel(item) }}</strong>
        </div>
      </section>

      <section class="dashboard-panel filters-panel">
        <form class="filters-form" role="search" [formGroup]="filtersForm" (ngSubmit)="load(1)">
          <div class="filter-toolbar">
            <label class="filter-search">
              <span i18n="@@searchLabel">Buscar</span>
              <input id="quotations-filter-search" type="search" formControlName="search" maxlength="200" placeholder="Número o cliente" i18n-placeholder="@@quotationSearchPlaceholder" />
            </label>
            <button type="button" class="secondary filter-toggle" (click)="toggleFilters()" [attr.aria-expanded]="filtersOpen()" aria-controls="quotation-filter-controls">
              <span *ngIf="!filtersOpen()" i18n="@@filtersButton">Filtros</span>
              <span *ngIf="filtersOpen()" i18n="@@hideFiltersButton">Ocultar filtros</span>
            </button>
            <strong class="result-count" i18n="@@resultsCountLabel">{{ quotations().total }} resultados</strong>
          </div>
          <div id="quotation-filter-controls" class="filter-controls" [class.open]="filtersOpen()">
            <label>
              <span i18n="@@statusLabel">Estado</span>
              <select id="quotations-filter-status" formControlName="status">
                <option value="" i18n="@@allOption">Todos</option>
                <option value="DRAFT" i18n="@@draftLabel">Borrador</option>
                <option value="SENT" i18n="@@sentLabel">Enviada</option>
                <option value="CHANGES_REQUESTED" i18n="@@changesRequestedLabel">Cambios solicitados</option>
                <option value="APPROVED" i18n="@@approvedLabel">Aprobada</option>
                <option value="REJECTED" i18n="@@rejectedLabel">Rechazada</option>
                <option value="CANCELLED" i18n="@@quotationCancelledLabel">Cancelada</option>
              </select>
            </label>
          <div class="row-actions filter-actions">
            <button type="submit" [disabled]="loading()" i18n="@@filterButton">Filtrar</button>
            <button type="button" class="secondary" (click)="resetFilters()" [disabled]="loading()" i18n="@@clearFiltersButton">Limpiar filtros</button>
          </div>
          </div>
          <div class="active-filter-chips" *ngIf="filtersForm.controls.search.value || filtersForm.controls.status.value">
            <span *ngIf="filtersForm.controls.search.value">{{ filtersForm.controls.search.value }}</span>
            <span *ngIf="filtersForm.controls.status.value">{{ statusLabel(filtersForm.controls.status.value) }}</span>
          </div>
        </form>
      </section>

      <p class="form-error" *ngIf="error() && !integrityIssue()">{{ error() }}</p>
      <section class="status-banner warning" *ngIf="integrityIssue()" role="alert">
        <strong>{{ error() }}</strong>
        <button type="button" *ngIf="canRepairIntegrityIssue()" (click)="repairConfirmationOpen.set(true)" [disabled]="repairing()">
          <kaklen-icon name="refresh" />
          <span>{{ repairing() ? recalculatingTotalsLabel : recalculateTotalsLabel }}</span>
        </button>
      </section>

      <ng-container *ngIf="!integrityIssue()">
        <section class="list-panel" *ngIf="quotations().items.length > 0; else emptyState">
          <article class="item-row" *ngFor="let quotation of quotations().items">
            <div class="entity-heading">
              <span class="entity-avatar square" aria-hidden="true">Q</span>
              <div>
                <strong>{{ quotation.number }} v{{ quotation.version }} · {{ quotation.client.displayName }}</strong>
                <div class="entity-meta">
                  <kaklen-status-badge [status]="quotation.status" [label]="statusLabel(quotation.status)" />
                  <small>{{ dateLabel(quotation.issueDate) }}</small>
                  <small class="entity-price">{{ moneyLabel(quotation.total, quotation.currency) }}</small>
                </div>
              </div>
            </div>
            <div class="row-actions">
              <a [routerLink]="['/organizations', organizationId, 'quotations', quotation.id]" i18n="@@viewLink">Ver</a>
              <a *ngIf="canUpdate() && quotation.status === 'DRAFT'" [routerLink]="['/organizations', organizationId, 'quotations', quotation.id, 'edit']" i18n="@@editLink">Editar</a>
            </div>
          </article>
        </section>

        <ng-template #emptyState>
          <kaklen-empty-state icon="file-text" [title]="quotationsEmptyTitle" [description]="quotationsEmptyDescription">
            <a *ngIf="canCreate()" class="button-link" [routerLink]="['/organizations', organizationId, 'quotations', 'new']" i18n="@@newQuotationButton">Nueva cotización</a>
          </kaklen-empty-state>
        </ng-template>

        <section class="pagination-row" *ngIf="quotations().totalPages > 1">
          <button type="button" class="secondary" (click)="load(quotations().page - 1)" [disabled]="quotations().page <= 1" i18n="@@previousPageButton">Anterior</button>
          <span i18n="@@paginationLabel">Página {{ quotations().page }} de {{ quotations().totalPages }}</span>
          <button type="button" class="secondary" (click)="load(quotations().page + 1)" [disabled]="quotations().page >= quotations().totalPages" i18n="@@nextPageButton">Siguiente</button>
        </section>
      </ng-container>
      <kaklen-confirmation-dialog
        [open]="repairConfirmationOpen()"
        [busy]="repairing()"
        [title]="recalculateTotalsTitle"
        [description]="recalculateTotalsDescription"
        [confirmLabel]="recalculateTotalsLabel"
        tone="primary"
        icon="refresh"
        (confirm)="recalculateTotals()"
        (cancel)="repairConfirmationOpen.set(false)"
      />
    </main>
  `
})
export class QuotationListComponent implements OnInit {
  readonly loading = signal(false);
  readonly error = signal("");
  readonly integrityIssue = signal<BackendErrorDetails | null>(null);
  readonly repairing = signal(false);
  readonly repairConfirmationOpen = signal(false);
  readonly filtersOpen = signal(false);
  readonly quotationsEmptyTitle = $localize`:@@quotationsEmptyTitle:Crea tu primera cotización`;
  readonly quotationsEmptyDescription = $localize`:@@quotationsEmpty:Prepara una propuesta y conviértela en un evento cuando el cliente la apruebe.`;
  readonly recalculateTotalsLabel = $localize`:@@recalculateQuotationTotalsButton:Recalcular totales`;
  readonly recalculatingTotalsLabel = $localize`:@@recalculatingQuotationTotalsButton:Recalculando...`;
  readonly recalculateTotalsTitle = $localize`:@@recalculateQuotationTotalsTitle:Recalcular totales de la cotización`;
  readonly recalculateTotalsDescription = $localize`:@@recalculateQuotationTotalsDescription:Se recalcularán los importes desde los datos fuente de cada línea.`;
  readonly summary = signal<QuotationSummary | null>(null);
  readonly quotations = signal<PaginatedQuotations>({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
  readonly filtersForm = new FormGroup({
    search: new FormControl("", { nonNullable: true }),
    status: new FormControl<QuotationStatus | "">("", { nonNullable: true })
  });
  organizationId = "";

  constructor(
    private readonly route: ActivatedRoute,
    private readonly organizationService: OrganizationService,
    private readonly quotationsService: QuotationsService,
    private readonly notifications: NotificationService
  ) {}

  async ngOnInit(): Promise<void> {
    this.organizationId = this.route.snapshot.paramMap.get("organizationId") ?? "";
    await this.organizationService.setActiveOrganization(this.organizationId);
    await this.load(1);
  }

  canCreate(): boolean {
    return this.organizationService.hasPermission("quotations.create");
  }

  canUpdate(): boolean {
    return this.organizationService.hasPermission("quotations.update");
  }

  async load(page: number): Promise<void> {
    this.loading.set(true);
    this.error.set("");
    try {
      const [summary, quotations] = await Promise.all([
        this.quotationsService.summary(this.organizationId),
        this.quotationsService.list(this.organizationId, { ...this.filtersForm.getRawValue(), page })
      ]);
      this.summary.set(summary);
      this.quotations.set(quotations);
      this.integrityIssue.set(null);
      this.repairConfirmationOpen.set(false);
    } catch (error) {
      if (isBackendErrorCode(error, "QUOTATION_MONEY_MISMATCH")) {
        this.summary.set(null);
        this.quotations.set({ items: [], page, pageSize: 20, total: 0, totalPages: 0 });
        const issue = backendErrorDetails(error);
        this.integrityIssue.set(issue);
        this.error.set(quotationIntegrityMessage(issue.repairable === true && this.canUpdate()));
      } else {
        this.error.set($localize`:@@quotationsLoadError:No fue posible cargar las cotizaciones.`);
      }
    } finally {
      this.loading.set(false);
    }
  }

  canRepairIntegrityIssue(): boolean {
    const issue = this.integrityIssue();
    return issue?.repairable === true && Boolean(issue.resourceId) && this.canUpdate();
  }

  async recalculateTotals(): Promise<void> {
    const issue = this.integrityIssue();
    if (this.repairing() || !this.canRepairIntegrityIssue() || !issue?.resourceId) return;
    this.repairing.set(true);
    try {
      await this.quotationsService.recalculateTotals(this.organizationId, issue.resourceId);
      await this.load(this.quotations().page);
      if (this.integrityIssue()) return;
      this.notifications.success($localize`:@@quotationTotalsRecalculatedSuccess:Totales recalculados correctamente.`);
    } catch {
      const currentPage = this.quotations().page;
      this.summary.set(null);
      this.quotations.set({ items: [], page: currentPage, pageSize: 20, total: 0, totalPages: 0 });
      this.integrityIssue.update((current) => current ? { ...current, repairable: false } : current);
      this.error.set(quotationIntegrityMessage(false));
    } finally {
      this.repairConfirmationOpen.set(false);
      this.repairing.set(false);
    }
  }

  async resetFilters(): Promise<void> {
    this.filtersForm.reset({ search: "", status: "" });
    await this.load(1);
  }

  toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  statusLabel(status: QuotationStatus): string {
    const labels: Record<QuotationStatus, string> = {
      DRAFT: $localize`:@@draftLabel:Borrador`,
      SENT: $localize`:@@sentLabel:Enviada`,
      CHANGES_REQUESTED: $localize`:@@changesRequestedLabel:Cambios solicitados`,
      APPROVED: $localize`:@@approvedLabel:Aprobada`,
      REJECTED: $localize`:@@rejectedLabel:Rechazada`,
      EXPIRED: $localize`:@@expiredLabel:Expirada`,
      CANCELLED: $localize`:@@quotationCancelledLabel:Cancelada`
    };
    return labels[status];
  }

  moneyLabel(value: string, currency?: string): string {
    const organization = this.organizationService.activeOrganization();
    return formatRegionalCurrency(value, {
      currency: currency ?? organization?.currency ?? "CLP",
      numberFormat: organization?.numberFormat ?? "es"
    });
  }

  baseApprovedAmountLabel(summary: QuotationSummary): string {
    return `${this.moneyLabel(summary.baseCurrencyApprovedAmount, summary.baseCurrency)} ${summary.baseCurrency}`;
  }

  approvedAmountLabel(item: QuotationSummary["approvedAmounts"][number]): string {
    const organization = this.organizationService.activeOrganization();
    const value = formatRegionalMoneyValue(item.amount, {
      currency: item.currency,
      numberFormat: organization?.numberFormat ?? "es"
    });
    return `${item.currency} ${value}`;
  }

  otherApprovedAmounts(summary: QuotationSummary): QuotationSummary["approvedAmounts"] {
    return summary.approvedAmounts.filter((item) => item.currency !== summary.baseCurrency);
  }

  dateLabel(value: string): string {
    const organization = this.organizationService.activeOrganization();
    return formatRegionalDate(value, {
      dateFormat: organization?.dateFormat ?? "dd-MM-yyyy",
      numberFormat: organization?.numberFormat ?? "es"
    });
  }
}
