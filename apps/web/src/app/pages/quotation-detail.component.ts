import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { formatRegionalCurrency, formatRegionalDate } from "../i18n/formatting";
import { LocaleService } from "../i18n/locale.service";
import { OrganizationService } from "../organizations/organization.service";
import { Quotation, QuotationStatus, QuotationStatusHistory } from "../quotations/quotation.models";
import { QuotationsService } from "../quotations/quotations.service";
import { NotificationService } from "../shared/notifications/notification.service";
import { AssistantService } from "../assistant/assistant.service";
import { ProductAnalyticsService } from "../assistant/product-analytics.service";
import { ConfirmationDialogComponent } from "../shared/confirmation-dialog.component";

@Component({
  selector: "kaklen-quotation-detail",
  standalone: true,
  imports: [CommonModule, RouterLink, ConfirmationDialogComponent],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header" *ngIf="quotation() as currentQuotation">
        <div>
          <p class="eyebrow" i18n="@@quotationsEyebrow">Cotizaciones</p>
          <h1>{{ currentQuotation.number }} v{{ currentQuotation.version }}</h1>
          <p>{{ currentQuotation.client.displayName }} · {{ statusLabel(currentQuotation.status) }} · {{ moneyLabel(currentQuotation.total, currentQuotation.currency) }}</p>
        </div>
        <div class="row-actions">
          <a [routerLink]="['/organizations', organizationId, 'quotations']" i18n="@@backLink">Volver</a>
          <a *ngIf="canUpdate() && currentQuotation.status === 'DRAFT'" class="button-link" [routerLink]="['/organizations', organizationId, 'quotations', currentQuotation.id, 'edit']" i18n="@@editLink">Editar</a>
          <button type="button" *ngIf="canSend() && currentQuotation.status === 'DRAFT'" (click)="changeStatus('send')" i18n="@@sendQuotationButton">Enviar</button>
          <button type="button" class="success" *ngIf="canApprove() && currentQuotation.status === 'SENT'" (click)="changeStatus('approve')" i18n="@@approveQuotationButton">Aprobar</button>
          <button type="button" class="secondary" *ngIf="canReject() && currentQuotation.status === 'SENT'" (click)="changeStatus('reject')" i18n="@@rejectQuotationButton">Rechazar</button>
          <details class="action-menu" *ngIf="canSend() && (currentQuotation.status === 'SENT' || currentQuotation.status === 'DRAFT')">
            <summary i18n="@@moreActionsLabel">Más acciones</summary>
            <div class="action-menu-panel">
              <button type="button" class="danger" (click)="cancelRequested.set(true)" [disabled]="processing()" i18n="@@cancelDefinitelyButton">Cancelar definitivamente</button>
            </div>
          </details>
          <button type="button" class="secondary" *ngIf="canUpdate() && currentQuotation.status !== 'DRAFT'" (click)="newVersion()" i18n="@@newVersionButton">Nueva versión</button>
          <a *ngIf="currentQuotation.status === 'APPROVED'" class="button-link" [routerLink]="['/organizations', organizationId, 'events', 'new']" [queryParams]="{ quotationId: currentQuotation.id }" i18n="@@createEventButton">Crear evento</a>
          <a class="secondary-link" [href]="pdfUrl(currentQuotation)" target="_blank" i18n="@@downloadPdfButton">Descargar PDF</a>
        </div>
      </section>

      <p class="form-error" *ngIf="error()">{{ error() }}</p>

      <section class="dashboard-panel" *ngIf="quotation() as currentQuotation">
        <h2 i18n="@@dataTitle">Datos</h2>
        <dl class="detail-grid">
          <div><dt i18n="@@issueDateLabel">Fecha de emisión</dt><dd>{{ dateLabel(currentQuotation.issueDate) }}</dd></div>
          <div><dt i18n="@@validUntilLabel">Válida hasta</dt><dd>{{ dateLabel(currentQuotation.validUntil) }}</dd></div>
          <div><dt i18n="@@subtotalLabel">Subtotal</dt><dd>{{ moneyLabel(currentQuotation.subtotal, currentQuotation.currency) }}</dd></div>
          <div><dt i18n="@@discountTotalLabel">Descuentos</dt><dd>{{ moneyLabel(currentQuotation.discountTotal, currentQuotation.currency) }}</dd></div>
          <div><dt i18n="@@taxTotalLabel">Impuestos</dt><dd>{{ moneyLabel(currentQuotation.taxTotal, currentQuotation.currency) }}</dd></div>
          <div><dt i18n="@@totalLabel">Total</dt><dd>{{ moneyLabel(currentQuotation.total, currentQuotation.currency) }}</dd></div>
        </dl>
      </section>

      <section class="list-panel" *ngIf="quotation() as currentQuotation">
        <article class="item-row" *ngFor="let item of currentQuotation.items">
          <div>
            <strong>{{ item.name }}</strong>
            <small>{{ item.quantity }} {{ item.unit }} · {{ moneyLabel(item.unitPrice, currentQuotation.currency) }} · {{ moneyLabel(item.total, currentQuotation.currency) }}</small>
            <p *ngIf="item.description">{{ item.description }}</p>
          </div>
        </article>
      </section>

      <section class="dashboard-panel">
        <h2 i18n="@@statusHistoryTitle">Historial</h2>
        <article class="item-row" *ngFor="let item of history()">
          <strong>{{ statusLabel(item.newStatus) }}</strong>
          <small>{{ dateLabel(item.createdAt) }} · {{ item.note || emptyNoteLabel }}</small>
        </article>
      </section>
      <kaklen-confirmation-dialog
        [open]="cancelRequested()"
        [busy]="processing()"
        [title]="cancelDialogTitle"
        [description]="cancelDialogDescription"
        [confirmLabel]="cancelDialogAction"
        (confirm)="changeStatus('cancel')"
        (cancel)="cancelRequested.set(false)"
      />
    </main>
  `
})
export class QuotationDetailComponent implements OnInit {
  readonly quotation = signal<Quotation | null>(null);
  readonly history = signal<QuotationStatusHistory[]>([]);
  readonly error = signal("");
  readonly processing = signal(false);
  readonly cancelRequested = signal(false);
  readonly emptyNoteLabel = $localize`:@@emptyNoteLabel:Sin nota`;
  readonly cancelDialogTitle = $localize`:@@cancelQuotationDialogTitle:Cancelar cotización`;
  readonly cancelDialogDescription = $localize`:@@cancelQuotationDialogDescription:La cotización dejará de estar disponible para aprobación y conservará el estado cancelado en su historial.`;
  readonly cancelDialogAction = $localize`:@@cancelDefinitelyButton:Cancelar definitivamente`;
  organizationId = "";
  quotationId = "";
  private initialQuotationApproved = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly organizationService: OrganizationService,
    private readonly quotationsService: QuotationsService,
    private readonly localeService: LocaleService,
    private readonly notifications: NotificationService,
    private readonly assistantService: AssistantService,
    private readonly analytics: ProductAnalyticsService
  ) {}

  async ngOnInit(): Promise<void> {
    this.organizationId = this.route.snapshot.paramMap.get("organizationId") ?? "";
    this.quotationId = this.route.snapshot.paramMap.get("quotationId") ?? "";
    await this.organizationService.setActiveOrganization(this.organizationId);
    await Promise.all([
      this.load(),
      this.assistantService.activation(this.organizationId).then((activation) => {
        this.initialQuotationApproved = activation.completedSteps.includes("first_quotation_approved");
      })
    ]);
  }

  canUpdate(): boolean {
    return this.organizationService.hasPermission("quotations.update");
  }

  canSend(): boolean {
    return this.organizationService.hasPermission("quotations.send");
  }

  canApprove(): boolean {
    return this.organizationService.hasPermission("quotations.approve");
  }

  canReject(): boolean {
    return this.organizationService.hasPermission("quotations.reject");
  }

  async changeStatus(action: "send" | "approve" | "reject" | "cancel"): Promise<void> {
    if (this.processing() || (action !== "cancel" && !this.confirmStatusChange(action))) {
      return;
    }
    this.processing.set(true);
    try {
      this.quotation.set(await this.quotationsService.changeStatus(this.organizationId, this.quotationId, action));
      this.history.set(await this.quotationsService.history(this.organizationId, this.quotationId));
      this.notifications.success(this.statusSuccessMessage(action));
      if (action === "approve" && !this.initialQuotationApproved) {
        this.analytics.track("first_quotation_approved", { flow: "quotation", source: "detail" });
        this.initialQuotationApproved = true;
      }
      this.cancelRequested.set(false);
    } catch (error) {
      this.notifications.fromError(error);
      this.error.set($localize`:@@quotationStatusError:No fue posible cambiar el estado.`);
    } finally {
      this.processing.set(false);
    }
  }

  async newVersion(): Promise<void> {
    try {
      const quotation = await this.quotationsService.newVersion(this.organizationId, this.quotationId);
      this.notifications.success($localize`:@@quotationNewVersionSuccess:Nueva versión creada.`);
      await this.router.navigate(["/organizations", this.organizationId, "quotations", quotation.id, "edit"]);
    } catch (error) {
      this.notifications.fromError(error);
      this.error.set($localize`:@@quotationVersionError:No fue posible crear una nueva versión.`);
    }
  }

  pdfUrl(quotation: Quotation): string {
    return this.quotationsService.pdfUrl(this.organizationId, quotation.id, this.localeService.getLocale());
  }

  statusLabel(status: QuotationStatus): string {
    const labels: Record<QuotationStatus, string> = {
      DRAFT: $localize`:@@draftLabel:Borrador`,
      SENT: $localize`:@@sentLabel:Enviada`,
      APPROVED: $localize`:@@approvedLabel:Aprobada`,
      REJECTED: $localize`:@@rejectedLabel:Rechazada`,
      EXPIRED: $localize`:@@expiredLabel:Expirada`,
      CANCELLED: $localize`:@@cancelledLabel:Cancelada`
    };
    return labels[status];
  }

  moneyLabel(value: string, currency: string): string {
    const organization = this.organizationService.activeOrganization();
    return formatRegionalCurrency(value, { currency, numberFormat: organization?.numberFormat ?? "es" });
  }

  dateLabel(value: string): string {
    const organization = this.organizationService.activeOrganization();
    return formatRegionalDate(value, {
      dateFormat: organization?.dateFormat ?? "dd-MM-yyyy",
      numberFormat: organization?.numberFormat ?? "es"
    });
  }

  private async load(): Promise<void> {
    try {
      this.quotation.set(await this.quotationsService.get(this.organizationId, this.quotationId));
      this.history.set(await this.quotationsService.history(this.organizationId, this.quotationId));
    } catch {
      this.error.set($localize`:@@quotationLoadError:No fue posible cargar la cotización.`);
    }
  }

  private confirmStatusChange(action: "send" | "approve" | "reject" | "cancel"): boolean {
    if (action === "approve") {
      return confirm($localize`:@@approveQuotationConfirm:¿Aprobar esta cotización?`);
    }
    if (action === "reject") {
      return confirm($localize`:@@rejectQuotationConfirm:¿Rechazar esta cotización?`);
    }
    if (action === "cancel") {
      return confirm($localize`:@@cancelQuotationConfirm:¿Cancelar esta cotización?`);
    }
    return true;
  }

  private statusSuccessMessage(action: "send" | "approve" | "reject" | "cancel"): string {
    const messages: Record<typeof action, string> = {
      send: $localize`:@@quotationSentSuccess:Cotización enviada.`,
      approve: $localize`:@@quotationApprovedSuccess:Cotización aprobada.`,
      reject: $localize`:@@quotationRejectedSuccess:Cotización rechazada.`,
      cancel: $localize`:@@quotationCancelledSuccess:Cotización cancelada.`
    };
    return messages[action];
  }
}
