import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit, computed, signal } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { formatRegionalCurrency, formatRegionalDate } from "../i18n/formatting";
import { LocaleService } from "../i18n/locale.service";
import { OrganizationService } from "../organizations/organization.service";
import { Quotation, QuotationChangeRequest, QuotationEmailPayload, QuotationStatus, QuotationStatusHistory } from "../quotations/quotation.models";
import { QuotationPublicLink, QuotationsService } from "../quotations/quotations.service";
import {
  backendErrorDetails,
  BackendErrorDetails,
  isBackendErrorCode,
  messageForError,
  NotificationService,
  quotationIntegrityMessage,
  quotationRepairConflictMessage
} from "../shared/notifications/notification.service";
import { AssistantService } from "../assistant/assistant.service";
import { ProductAnalyticsService } from "../assistant/product-analytics.service";
import { RUNTIME_CONFIG } from "../config/runtime-config";
import { ConfirmationDialogComponent } from "../shared/confirmation-dialog.component";
import { ActionMenuComponent, ActionMenuItemDirective } from "../shared/action-menu.component";
import { UiIconComponent, UiIconName } from "../shared/ui-icon.component";
import { QuotationEmailDialogComponent } from "../quotations/quotation-email-dialog.component";
import { calculateQuotationMoney } from "@kaklen/shared";
import type { QuotationMoneyAmounts } from "@kaklen/shared";
import { Subscription } from "rxjs";

@Component({
  selector: "kaklen-quotation-detail",
  standalone: true,
  imports: [CommonModule, RouterLink, ConfirmationDialogComponent, ActionMenuComponent, ActionMenuItemDirective, UiIconComponent, QuotationEmailDialogComponent],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header" *ngIf="quotation() as currentQuotation">
        <div>
          <p class="eyebrow" i18n="@@quotationsEyebrow">Cotizaciones</p>
          <h1>{{ currentQuotation.number }} v{{ currentQuotation.version }}</h1>
          <p>{{ currentQuotation.client.displayName }} · {{ statusLabel(currentQuotation.status) }} · {{ moneyLabel(currentQuotation.total, currentQuotation.currency) }}</p>
        </div>
        <div class="row-actions">
          <a class="ghost button-link" [routerLink]="['/organizations', organizationId, 'quotations']"><kaklen-icon name="arrow-left" /><span i18n="@@backLink">Volver</span></a>
          <a *ngIf="canUpdate() && currentQuotation.status === 'DRAFT'" class="secondary button-link" [routerLink]="['/organizations', organizationId, 'quotations', currentQuotation.id, 'edit']"><kaklen-icon name="pencil" /><span i18n="@@editLink">Editar</span></a>
          <button type="button" *ngIf="canSend() && (currentQuotation.status === 'DRAFT' || currentQuotation.status === 'SENT')" (click)="createPublicLink()" [disabled]="sharing()"><kaklen-icon name="message-circle" /><span i18n="@@shareSecurelyButton">Compartir de forma segura</span></button>
          <button type="button" *ngIf="commercialEmailEnabled && canSend() && currentQuotation.status === 'DRAFT'" (click)="openEmailDialog()" [disabled]="emailSending()"><kaklen-icon name="mail" /><span i18n="@@sendQuotationEmailTitle">Enviar por email</span></button>
          <button type="button" class="success" *ngIf="canApprove() && currentQuotation.status === 'SENT'" (click)="requestStatusChange('approve')" [disabled]="processing()"><kaklen-icon name="check" /><span i18n="@@approveQuotationButton">Aprobar</span></button>
          <button type="button" class="danger" *ngIf="canReject() && currentQuotation.status === 'SENT'" (click)="requestStatusChange('reject')" [disabled]="processing()"><kaklen-icon name="x-circle" /><span i18n="@@rejectQuotationButton">Rechazar</span></button>
          <a *ngIf="currentQuotation.status === 'APPROVED'" class="button-link" [routerLink]="['/organizations', organizationId, 'events', 'new']" [queryParams]="{ quotationId: currentQuotation.id }"><kaklen-icon name="calendar" /><span i18n="@@createEventButton">Crear evento</span></a>
          <kaklen-action-menu [contextKey]="organizationId">
            <button kaklenMenuItem type="button" class="secondary" (click)="downloadPdf()" [disabled]="downloadingPdf()"><kaklen-icon name="download" /><span>{{ downloadingPdf() ? preparingPdfLabel : downloadPdfLabel }}</span></button>
            <button *ngIf="commercialEmailEnabled && canSend() && currentQuotation.status === 'SENT'" kaklenMenuItem type="button" class="secondary" (click)="openEmailDialog()" [disabled]="emailSending()"><kaklen-icon name="mail" /><span i18n="@@resendQuotationEmailButton">Reenviar por email</span></button>
            <button *ngIf="canUpdate() && canCreateVersion(currentQuotation.status)" kaklenMenuItem type="button" class="secondary" (click)="newVersion()" [disabled]="processing()"><kaklen-icon name="copy" /><span i18n="@@newVersionButton">Crear nueva versión</span></button>
            <button *ngIf="canSend() && canCancel(currentQuotation.status)" kaklenMenuItem type="button" class="danger" (click)="requestStatusChange('cancel')" [disabled]="processing()"><kaklen-icon name="x-circle" /><span i18n="@@cancelDefinitelyButton">Cancelar definitivamente</span></button>
          </kaklen-action-menu>
        </div>
      </section>

      <p class="form-error" *ngIf="error() && !integrityIssue()">{{ error() }}</p>
      <section class="status-banner warning" *ngIf="integrityIssue()" role="alert">
        <strong>{{ error() }}</strong>
        <button type="button" *ngIf="canRepairIntegrityIssue()" (click)="repairConfirmationOpen.set(true)" [disabled]="repairing()">
          <kaklen-icon name="refresh" />
          <span>{{ repairing() ? recalculatingTotalsLabel : recalculateTotalsLabel }}</span>
        </button>
      </section>

      <section class="status-banner warning" *ngIf="quotation()?.status === 'CHANGES_REQUESTED'" role="status">
        <strong i18n="@@quotationChangesRequestedBanner">El cliente solicitó cambios. Revisa el comentario antes de crear una nueva versión.</strong>
      </section>

      <section class="dashboard-panel secure-share-panel" *ngIf="publicLink() as link">
        <div><h2 i18n="@@secureLinkReadyTitle">Enlace seguro listo</h2><p i18n="@@secureLinkReadyBody">Comparte este enlace con el cliente. Vence en siete días y puedes reemplazarlo generando uno nuevo.</p></div>
        <div class="secure-link-value"><code>{{ link.url }}</code><button type="button" class="secondary" (click)="copyPublicLink(link.url)"><kaklen-icon name="copy" /><span i18n="@@copyLinkButton">Copiar enlace</span></button></div>
        <button type="button" class="success" [disabled]="sharing()" (click)="openWhatsApp(link)"><kaklen-icon name="message-circle" /><span i18n="@@openWhatsAppButton">Abrir WhatsApp</span></button>
      </section>

      <section class="dashboard-panel" *ngIf="quotation() as currentQuotation">
        <h2 i18n="@@dataTitle">Datos</h2>
        <dl class="detail-grid">
          <div><dt i18n="@@issueDateLabel">Fecha de emisión</dt><dd>{{ dateLabel(currentQuotation.issueDate) }}</dd></div>
          <div><dt i18n="@@validUntilLabel">Válida hasta</dt><dd>{{ dateLabel(currentQuotation.validUntil) }}</dd></div>
          <div><dt i18n="@@netSubtotalLabel">Subtotal neto</dt><dd>{{ moneyLabel(calculatedAmounts()?.subtotal ?? currentQuotation.subtotal, currentQuotation.currency) }}</dd></div>
          <div><dt i18n="@@lineDiscountTotalLabel">Descuento por línea</dt><dd>{{ moneyLabel(calculatedAmounts()?.lineDiscountTotal ?? '0', currentQuotation.currency) }}</dd></div>
          <div><dt i18n="@@globalDiscountTotalLabel">Descuento global</dt><dd>{{ moneyLabel(calculatedAmounts()?.globalDiscountTotal ?? '0', currentQuotation.currency) }}</dd></div>
          <div><dt i18n="@@totalDiscountLabel">Descuento total</dt><dd>{{ moneyLabel(calculatedAmounts()?.discountTotal ?? currentQuotation.discountTotal, currentQuotation.currency) }}</dd></div>
          <div><dt i18n="@@taxableBaseLabel">Base imponible</dt><dd>{{ moneyLabel(calculatedAmounts()?.taxableBase ?? currentQuotation.subtotal, currentQuotation.currency) }}</dd></div>
          <div><dt i18n="@@taxTotalLabel">IVA</dt><dd>{{ moneyLabel(calculatedAmounts()?.taxTotal ?? currentQuotation.taxTotal, currentQuotation.currency) }}</dd></div>
          <div><dt i18n="@@totalLabel">Total</dt><dd>{{ moneyLabel(currentQuotation.total, currentQuotation.currency) }}</dd></div>
        </dl>
      </section>

      <section class="list-panel" *ngIf="quotation() as currentQuotation">
        <article class="item-row quotation-detail-item" *ngFor="let item of currentQuotation.items; let index = index">
          <div>
            <strong>{{ item.name }}</strong>
            <small>{{ item.code || '' }} · {{ item.unit }}</small>
            <p *ngIf="item.description">{{ item.description }}</p>
          </div>
          <dl class="quotation-line-financial" *ngIf="lineAmounts(index) as amounts">
            <div><dt i18n="@@quantityTimesPriceLabel">Cantidad × precio unitario</dt><dd>{{ item.quantity }} × {{ moneyLabel(item.unitPrice, currentQuotation.currency) }}</dd></div>
            <div><dt i18n="@@netSubtotalLabel">Subtotal neto</dt><dd>{{ moneyLabel(amounts.subtotal, currentQuotation.currency) }}</dd></div>
            <div><dt i18n="@@lineDiscountLabel">Descuento por línea</dt><dd>{{ moneyLabel(amounts.lineDiscountTotal, currentQuotation.currency) }}</dd></div>
            <div><dt i18n="@@allocatedGlobalDiscountLabel">Descuento global asignado</dt><dd>{{ moneyLabel(amounts.globalDiscountTotal, currentQuotation.currency) }}</dd></div>
            <div><dt i18n="@@totalDiscountLabel">Descuento total</dt><dd>{{ moneyLabel(amounts.discountTotal, currentQuotation.currency) }}</dd></div>
            <div><dt i18n="@@taxableBaseLabel">Base imponible</dt><dd>{{ moneyLabel(amounts.taxableBase, currentQuotation.currency) }}</dd></div>
            <div><dt i18n="@@lineTaxLabel">IVA</dt><dd>{{ moneyLabel(amounts.taxTotal, currentQuotation.currency) }}</dd></div>
            <div class="line-total"><dt i18n="@@lineTotalVatIncludedLabel">Total línea, IVA incluido</dt><dd>{{ moneyLabel(amounts.total, currentQuotation.currency) }}</dd></div>
          </dl>
        </article>
      </section>

      <section
        id="change-requests"
        class="dashboard-panel change-requests-panel"
        [class.change-requests-highlighted]="changeRequestsHighlighted()"
        (animationend)="changeRequestsHighlighted.set(false)"
        aria-labelledby="change-requests-title"
        *ngIf="changeRequests().length"
      >
        <div class="section-heading">
          <div>
            <p class="eyebrow" i18n="@@customerFeedbackEyebrow">Respuesta del cliente</p>
            <h2 id="change-requests-title" i18n="@@changeRequestsTitle">Solicitudes de cambios del cliente</h2>
          </div>
          <button type="button" *ngIf="canUpdate()" class="secondary" (click)="newVersion()" [disabled]="processing()">
            <kaklen-icon name="copy" /><span i18n="@@newVersionButton">Crear nueva versión</span>
          </button>
        </div>
        <article class="change-request" *ngFor="let request of changeRequests()">
          <strong i18n="@@changeRequestCardTitle">Solicitud de cambios</strong>
          <p>{{ request.comment }}</p>
          <strong *ngIf="request.items.length" i18n="@@changeRequestRelatedItems">Ítems relacionados:</strong>
          <ul *ngIf="request.items.length">
            <li *ngFor="let item of request.items">
              <strong>{{ item.name }}</strong><span *ngIf="item.code"> · {{ item.code }}</span>
            </li>
          </ul>
          <p *ngIf="!request.items.length" i18n="@@changeRequestNoItems">Sin ítems específicos</p>
          <small i18n="@@changeRequestMetadata">Versión v{{ request.quotationVersion }} · Enviada {{ historyDateLabel(request.createdAt) }}</small>
        </article>
      </section>

      <section class="dashboard-panel">
        <h2 i18n="@@statusHistoryTitle">Historial</h2>
        <ol class="quotation-history">
          <li *ngFor="let item of history()">
            <span class="timeline-marker" aria-hidden="true"><kaklen-icon [name]="historyIcon(item)" /></span>
            <div><strong>{{ historyTitle(item) }}</strong><p *ngIf="historyDescription(item)">{{ historyDescription(item) }}</p><small>{{ historyDateLabel(item.createdAt) }} · {{ actorName(item) }} · {{ statusLabel(item.newStatus) }}</small></div>
          </li>
        </ol>
      </section>
      <kaklen-confirmation-dialog
        [open]="pendingStatusAction() !== null"
        [busy]="processing()"
        [title]="statusDialogTitle()"
        [description]="statusDialogDescription()"
        [confirmLabel]="statusDialogAction()"
        [tone]="pendingStatusAction() === 'approve' ? 'success' : 'danger'"
        [icon]="pendingStatusAction() === 'approve' ? 'check' : 'x-circle'"
        (confirm)="confirmStatusChange()"
        (cancel)="pendingStatusAction.set(null)"
      />
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
      <kaklen-quotation-email-dialog *ngIf="commercialEmailEnabled"
        [open]="emailDialogOpen()"
        [busy]="emailSending()"
        [recipient]="quotation()?.client?.email || ''"
        [quotationNumber]="quotationNumberLabel()"
        [locale]="currentLocale()"
        (sendRequested)="sendQuotationEmail($event)"
        (cancelled)="emailDialogOpen.set(false)"
      />
    </main>
  `
})
export class QuotationDetailComponent implements OnInit, OnDestroy {
  readonly commercialEmailEnabled = RUNTIME_CONFIG.commercialEmailEnabled;
  readonly quotation = signal<Quotation | null>(null);
  readonly history = signal<QuotationStatusHistory[]>([]);
  readonly changeRequests = signal<QuotationChangeRequest[]>([]);
  readonly changeRequestsHighlighted = signal(false);
  readonly calculatedAmounts = computed(() => {
    const quotation = this.quotation();
    if (!quotation) return null;
    return calculateQuotationMoney(
      quotation.items.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountType: item.discountType,
        discountValue: item.discountValue,
        taxPercent: item.taxPercent
      })),
      quotation.globalDiscountPercent,
      { currency: quotation.currency }
    );
  });
  readonly error = signal("");
  readonly integrityIssue = signal<BackendErrorDetails | null>(null);
  readonly repairing = signal(false);
  readonly repairConfirmationOpen = signal(false);
  readonly processing = signal(false);
  readonly downloadingPdf = signal(false);
  readonly emailDialogOpen = signal(false);
  readonly emailSending = signal(false);
  readonly sharing = signal(false);
  readonly publicLink = signal<QuotationPublicLink | null>(null);
  readonly pendingStatusAction = signal<"approve" | "reject" | "cancel" | null>(null);
  readonly downloadPdfLabel = $localize`:@@downloadPdfButton:Descargar PDF`;
  readonly preparingPdfLabel = $localize`:@@preparingPdfMessage:Preparando PDF...`;
  readonly recalculateTotalsLabel = $localize`:@@recalculateQuotationTotalsButton:Recalcular totales`;
  readonly recalculatingTotalsLabel = $localize`:@@recalculatingQuotationTotalsButton:Recalculando...`;
  readonly recalculateTotalsTitle = $localize`:@@recalculateQuotationTotalsTitle:Recalcular totales de la cotización`;
  readonly recalculateTotalsDescription = $localize`:@@recalculateQuotationTotalsDescription:Se recalcularán los importes desde los datos fuente de cada línea.`;
  organizationId = "";
  quotationId = "";
  private initialQuotationApproved = false;
  private activeFragment: string | null = null;
  private fragmentSubscription: Subscription | null = null;
  private focusFrame: number | null = null;

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
    this.fragmentSubscription = this.route.fragment.subscribe((fragment) => {
      this.activeFragment = fragment;
      this.scheduleChangeRequestFocus();
    });
    await this.organizationService.setActiveOrganization(this.organizationId);
    await Promise.all([
      this.load(),
      this.assistantService.activation(this.organizationId).then((activation) => {
        this.initialQuotationApproved = activation.completedSteps.includes("first_quotation_approved");
      })
    ]);
  }

  ngOnDestroy(): void {
    this.fragmentSubscription?.unsubscribe();
    if (this.focusFrame !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(this.focusFrame);
    }
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

  async changeStatus(action: "approve" | "reject" | "cancel"): Promise<void> {
    if (this.processing()) {
      return;
    }
    this.processing.set(true);
    try {
      this.quotation.set(await this.quotationsService.changeStatus(this.organizationId, this.quotationId, action));
      await this.loadRelatedContext();
      this.notifications.success(this.statusSuccessMessage(action));
      if (action === "approve" && !this.initialQuotationApproved) {
        this.analytics.track("first_quotation_approved", { flow: "quotation", source: "detail" });
        this.initialQuotationApproved = true;
      }
      this.pendingStatusAction.set(null);
    } catch (error) {
      if (this.clearInconsistentFinancialData(error)) return;
      this.notifications.fromError(error);
      this.error.set($localize`:@@quotationStatusError:No fue posible cambiar el estado.`);
    } finally {
      this.processing.set(false);
    }
  }

  async newVersion(): Promise<void> {
    if (this.processing()) return;
    this.processing.set(true);
    try {
      const quotation = await this.quotationsService.newVersion(this.organizationId, this.quotationId);
      this.notifications.success($localize`:@@quotationNewVersionSuccess:Nueva versión creada.`);
      await this.router.navigate(["/organizations", this.organizationId, "quotations", quotation.id, "edit"]);
    } catch (error) {
      if (this.clearInconsistentFinancialData(error)) return;
      this.notifications.fromError(error);
      this.error.set($localize`:@@quotationVersionError:No fue posible crear una nueva versión.`);
    } finally {
      this.processing.set(false);
    }
  }

  async downloadPdf(): Promise<void> {
    if (this.downloadingPdf()) return;
    this.downloadingPdf.set(true);
    this.notifications.info($localize`:@@preparingPdfNotification:Estamos preparando tu PDF.`);
    try {
      const download = await this.quotationsService.downloadPdf(this.organizationId, this.quotationId, this.currentLocale());
      if (download.blob.type && download.blob.type !== "application/pdf") {
        throw new Error("Unexpected PDF content type");
      }
      const url = URL.createObjectURL(download.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = download.filename;
      anchor.hidden = true;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      this.notifications.success($localize`:@@pdfDownloadedSuccess:Cotización descargada.`);
    } catch (error) {
      if (this.clearInconsistentFinancialData(error)) return;
      this.notifications.fromError(error);
      this.error.set($localize`:@@pdfDownloadError:No pudimos generar el PDF. Intenta nuevamente.`);
    } finally {
      this.downloadingPdf.set(false);
    }
  }

  async createPublicLink(): Promise<void> {
    if (this.sharing()) return;
    this.sharing.set(true);
    this.error.set("");
    try {
      const link = await this.quotationsService.createPublicLink(
        this.organizationId,
        this.quotationId,
        this.currentLocale()
      );
      this.publicLink.set(link);
      await this.load();
      if (!this.quotation()) {
        this.publicLink.set(null);
        return;
      }
      this.notifications.success($localize`:@@secureLinkCreatedSuccess:Enlace seguro creado.`);
    } catch (error) {
      if (this.clearInconsistentFinancialData(error)) return;
      this.notifications.fromError(error);
      this.error.set($localize`:@@secureLinkCreateError:No fue posible crear el enlace seguro.`);
    } finally {
      this.sharing.set(false);
    }
  }

  async copyPublicLink(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      this.notifications.success($localize`:@@linkCopiedSuccess:Enlace copiado.`);
    } catch {
      this.notifications.error($localize`:@@linkCopyError:No fue posible copiar el enlace.`);
    }
  }

  async openWhatsApp(link: QuotationPublicLink): Promise<void> {
    if (this.sharing()) return;
    this.sharing.set(true);
    try {
      const prepared = await this.quotationsService.prepareWhatsApp(
        this.organizationId,
        this.quotationId,
        link.publicToken,
        this.currentLocale()
      );
      if (prepared.waUrl) {
        window.open(prepared.waUrl, "_blank", "noopener,noreferrer");
        this.notifications.info($localize`:@@whatsappPreparedInfo:Mensaje preparado. Confirma el envío en WhatsApp.`);
      }
    } catch (error) {
      if (this.clearInconsistentFinancialData(error)) return;
      this.notifications.fromError(error);
      this.error.set($localize`:@@whatsappPrepareError:No fue posible preparar el mensaje de WhatsApp.`);
    } finally {
      this.sharing.set(false);
    }
  }

  openEmailDialog(): void {
    this.emailDialogOpen.set(true);
  }

  async sendQuotationEmail(payload: QuotationEmailPayload): Promise<void> {
    if (this.emailSending()) return;
    this.emailSending.set(true);
    this.error.set("");
    try {
      this.quotation.set(await this.quotationsService.sendEmail(this.organizationId, this.quotationId, payload));
      await this.loadRelatedContext();
      this.emailDialogOpen.set(false);
      this.notifications.success($localize`:@@quotationEmailSentSuccess:Cotización enviada por email.`);
    } catch (error) {
      if (this.clearInconsistentFinancialData(error)) return;
      this.notifications.fromError(error);
      this.error.set($localize`:@@quotationEmailSendError:No pudimos enviar el correo. La cotización no cambió de estado.`);
    } finally {
      this.emailSending.set(false);
    }
  }

  currentLocale(): "es" | "en" | "pt-BR" {
    return this.localeService.getLocale();
  }

  quotationNumberLabel(): string {
    const current = this.quotation();
    return current ? `${current.number} v${current.version}` : "";
  }

  canCancel(status: QuotationStatus): boolean {
    return status === "DRAFT" || status === "SENT";
  }

  canCreateVersion(status: QuotationStatus): boolean {
    return status === "SENT" || status === "CHANGES_REQUESTED" || status === "APPROVED" || status === "REJECTED" || status === "CANCELLED";
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
      await this.load();
      if (this.integrityIssue() || !this.quotation()) return;
      this.notifications.success($localize`:@@quotationTotalsRecalculatedSuccess:Totales recalculados correctamente.`);
    } catch (error) {
      this.quotation.set(null);
      this.history.set([]);
      this.changeRequests.set([]);
      this.publicLink.set(null);
      if (isBackendErrorCode(error, "QUOTATION_MONEY_REPAIR_CONFLICT")) {
        this.integrityIssue.set({ ...backendErrorDetails(error), repairable: true });
        this.error.set(quotationRepairConflictMessage());
      } else {
        this.integrityIssue.update((current) => current ? { ...current, repairable: false } : current);
        this.error.set(quotationIntegrityMessage(false));
      }
    } finally {
      this.repairConfirmationOpen.set(false);
      this.repairing.set(false);
    }
  }

  requestStatusChange(action: "approve" | "reject" | "cancel"): void {
    this.pendingStatusAction.set(action);
  }

  confirmStatusChange(): void {
    const action = this.pendingStatusAction();
    if (action) void this.changeStatus(action);
  }

  statusDialogTitle(): string {
    const action = this.pendingStatusAction();
    if (action === "approve") return $localize`:@@approveQuotationDialogTitle:Aprobar cotización`;
    if (action === "reject") return $localize`:@@rejectQuotationDialogTitle:Rechazar cotización`;
    return $localize`:@@cancelQuotationDialogTitle:Cancelar cotización`;
  }

  statusDialogDescription(): string {
    const action = this.pendingStatusAction();
    if (action === "approve") return $localize`:@@approveQuotationDialogDescription:La cotización quedará aprobada y podrá originar un evento.`;
    if (action === "reject") return $localize`:@@rejectQuotationDialogDescription:La cotización quedará rechazada y esta decisión se registrará en el historial.`;
    return $localize`:@@cancelQuotationDialogDescription:La cotización dejará de estar disponible para aprobación y conservará el estado cancelado en su historial.`;
  }

  statusDialogAction(): string {
    const action = this.pendingStatusAction();
    if (action === "approve") return $localize`:@@approveQuotationButton:Aprobar`;
    if (action === "reject") return $localize`:@@rejectQuotationButton:Rechazar`;
    return $localize`:@@cancelDefinitelyButton:Cancelar definitivamente`;
  }

  historyTitle(item: QuotationStatusHistory): string {
    if (item.note?.startsWith("quotation.email.sent|")) return $localize`:@@historyQuotationEmailed:Cotización enviada por email`;
    if (item.note === "quotation.version.created") return $localize`:@@historyQuotationVersionCreated:Nueva versión creada`;
    if (item.previousStatus === null) return $localize`:@@historyQuotationCreated:Cotización creada`;
    const labels: Partial<Record<QuotationStatus, string>> = {
      SENT: $localize`:@@historyQuotationSent:Cotización enviada`,
      CHANGES_REQUESTED: $localize`:@@historyQuotationChangesRequested:Cambios solicitados por el cliente`,
      APPROVED: $localize`:@@historyQuotationApproved:Cotización aprobada`,
      REJECTED: $localize`:@@historyQuotationRejected:Cotización rechazada`,
      CANCELLED: $localize`:@@historyQuotationCancelled:Cotización cancelada`
    };
    return labels[item.newStatus] ?? $localize`:@@historyQuotationUpdated:Cotización actualizada`;
  }

  historyDescription(item: QuotationStatusHistory): string {
    if (item.note?.startsWith("quotation.email.sent|")) {
      const recipient = item.note.split("|")[1] ?? "";
      return $localize`:@@historyQuotationEmailedDescription:Enviada por correo a ${recipient}:recipientEmail:`;
    }
    return item.note && !item.note.startsWith("quotation.") ? item.note : "";
  }

  actorName(item: QuotationStatusHistory): string {
    return item.changedBy
      ? `${item.changedBy.firstName} ${item.changedBy.lastName}`.trim()
      : $localize`:@@systemActorLabel:Sistema`;
  }

  historyIcon(item: QuotationStatusHistory): UiIconName {
    if (item.note?.startsWith("quotation.email.sent|")) return "mail";
    if (item.note === "quotation.version.created") return "copy";
    if (item.newStatus === "APPROVED") return "check-circle";
    if (item.newStatus === "REJECTED" || item.newStatus === "CANCELLED") return "x-circle";
    return "file-text";
  }

  historyDateLabel(value: string): string {
    return new Date(value).toLocaleString(this.organizationService.activeOrganization()?.numberFormat ?? "es", {
      dateStyle: "medium",
      timeStyle: "short"
    });
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

  moneyLabel(value: string, currency: string): string {
    const organization = this.organizationService.activeOrganization();
    return formatRegionalCurrency(value, { currency, numberFormat: organization?.numberFormat ?? "es" });
  }

  lineAmounts(index: number): QuotationMoneyAmounts | null {
    return this.calculatedAmounts()?.lines[index] ?? null;
  }

  dateLabel(value: string): string {
    const organization = this.organizationService.activeOrganization();
    return formatRegionalDate(value, {
      dateFormat: organization?.dateFormat ?? "dd-MM-yyyy",
      numberFormat: organization?.numberFormat ?? "es"
    });
  }

  private async load(): Promise<void> {
    this.error.set("");
    try {
      const [quotation, history, changeRequests] = await Promise.all([
        this.quotationsService.get(this.organizationId, this.quotationId),
        this.quotationsService.history(this.organizationId, this.quotationId),
        this.quotationsService.changeRequests(this.organizationId, this.quotationId)
      ]);
      this.quotation.set(quotation);
      this.history.set(history);
      this.changeRequests.set(changeRequests);
      this.integrityIssue.set(null);
      this.repairConfirmationOpen.set(false);
      this.scheduleChangeRequestFocus();
    } catch (error) {
      this.quotation.set(null);
      this.history.set([]);
      this.changeRequests.set([]);
      if (!this.clearInconsistentFinancialData(error)) {
        this.error.set(messageForError(error));
      }
    }
  }

  private async loadRelatedContext(): Promise<void> {
    const [history, changeRequests] = await Promise.all([
      this.quotationsService.history(this.organizationId, this.quotationId),
      this.quotationsService.changeRequests(this.organizationId, this.quotationId)
    ]);
    this.history.set(history);
    this.changeRequests.set(changeRequests);
    this.scheduleChangeRequestFocus();
  }

  private clearInconsistentFinancialData(error: unknown): boolean {
    if (!isBackendErrorCode(error, "QUOTATION_MONEY_MISMATCH")) return false;
    const issue = backendErrorDetails(error);
    this.quotation.set(null);
    this.history.set([]);
    this.changeRequests.set([]);
    this.publicLink.set(null);
    this.pendingStatusAction.set(null);
    this.emailDialogOpen.set(false);
    this.integrityIssue.set(issue);
    this.error.set(quotationIntegrityMessage(issue.repairable === true && this.canUpdate()));
    return true;
  }

  private scheduleChangeRequestFocus(): void {
    if (this.activeFragment !== "change-requests" || this.changeRequests().length === 0) return;
    if (this.focusFrame !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(this.focusFrame);
    }
    if (typeof requestAnimationFrame !== "function") {
      this.focusChangeRequests();
      return;
    }
    this.focusFrame = requestAnimationFrame(() => {
      this.focusFrame = null;
      this.focusChangeRequests();
    });
  }

  private focusChangeRequests(): void {
    const section = document.getElementById("change-requests");
    if (!section) return;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    this.changeRequestsHighlighted.set(true);
  }

  private statusSuccessMessage(action: "approve" | "reject" | "cancel"): string {
    const messages: Record<typeof action, string> = {
      approve: $localize`:@@quotationApprovedSuccess:Cotización aprobada.`,
      reject: $localize`:@@quotationRejectedSuccess:Cotización rechazada.`,
      cancel: $localize`:@@quotationCancelledSuccess:Cotización cancelada.`
    };
    return messages[action];
  }
}
