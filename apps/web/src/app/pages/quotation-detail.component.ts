import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { formatRegionalCurrency, formatRegionalDate } from "../i18n/formatting";
import { LocaleService } from "../i18n/locale.service";
import { OrganizationService } from "../organizations/organization.service";
import { Quotation, QuotationStatus, QuotationStatusHistory } from "../quotations/quotation.models";
import { QuotationsService } from "../quotations/quotations.service";

@Component({
  selector: "kaklen-quotation-detail",
  standalone: true,
  imports: [CommonModule, RouterLink],
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
          <button type="button" *ngIf="canApprove() && currentQuotation.status === 'SENT'" (click)="changeStatus('approve')" i18n="@@approveQuotationButton">Aprobar</button>
          <button type="button" class="secondary" *ngIf="canReject() && currentQuotation.status === 'SENT'" (click)="changeStatus('reject')" i18n="@@rejectQuotationButton">Rechazar</button>
          <button type="button" class="secondary" *ngIf="canSend() && (currentQuotation.status === 'SENT' || currentQuotation.status === 'DRAFT')" (click)="changeStatus('cancel')" i18n="@@cancelQuotationButton">Cancelar</button>
          <button type="button" class="secondary" *ngIf="canUpdate() && currentQuotation.status !== 'DRAFT'" (click)="newVersion()" i18n="@@newVersionButton">Nueva versión</button>
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
    </main>
  `
})
export class QuotationDetailComponent implements OnInit {
  readonly quotation = signal<Quotation | null>(null);
  readonly history = signal<QuotationStatusHistory[]>([]);
  readonly error = signal("");
  readonly emptyNoteLabel = $localize`:@@emptyNoteLabel:Sin nota`;
  organizationId = "";
  quotationId = "";

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly organizationService: OrganizationService,
    private readonly quotationsService: QuotationsService,
    private readonly localeService: LocaleService
  ) {}

  async ngOnInit(): Promise<void> {
    this.organizationId = this.route.snapshot.paramMap.get("organizationId") ?? "";
    this.quotationId = this.route.snapshot.paramMap.get("quotationId") ?? "";
    await this.organizationService.setActiveOrganization(this.organizationId);
    await this.load();
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
    try {
      this.quotation.set(await this.quotationsService.changeStatus(this.organizationId, this.quotationId, action));
      this.history.set(await this.quotationsService.history(this.organizationId, this.quotationId));
    } catch {
      this.error.set($localize`:@@quotationStatusError:No fue posible cambiar el estado.`);
    }
  }

  async newVersion(): Promise<void> {
    try {
      const quotation = await this.quotationsService.newVersion(this.organizationId, this.quotationId);
      await this.router.navigate(["/organizations", this.organizationId, "quotations", quotation.id, "edit"]);
    } catch {
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
}
