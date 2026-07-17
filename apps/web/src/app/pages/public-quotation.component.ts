import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { LocaleService } from "../i18n/locale.service";
import { PublicQuotationStatus, PublicQuotationView } from "../portal/quotation-portal.models";
import { ProviderProfilePayload, QuotationPortalService } from "../portal/quotation-portal.service";
import { FieldErrorComponent, FormControlA11yDirective, FormErrorSummaryComponent, OptionalFieldLabelComponent, RequiredFieldIndicatorComponent } from "../shared/forms/form-feedback.components";
import { normalizePhone, trimmedRequired } from "../shared/forms/form-validators";
import { UiIconComponent } from "../shared/ui-icon.component";

@Component({
  selector: "kaklen-public-quotation",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FieldErrorComponent, FormControlA11yDirective, FormErrorSummaryComponent, OptionalFieldLabelComponent, RequiredFieldIndicatorComponent, UiIconComponent],
  template: `
    <main class="portal-shell">
      <section class="portal-hero" *ngIf="view() as data">
        <div>
          <p class="eyebrow">{{ data.organization.name }}</p>
          <h1><span i18n="@@publicQuotationTitle">Cotización</span> {{ data.quotation.number }}</h1>
          <p><span i18n="@@versionLabel">Versión</span> {{ data.quotation.version }} · {{ statusLabel(data.quotation.status) }}</p>
        </div>
        <div class="portal-total"><small i18n="@@totalLabel">Total</small><strong>{{ money(data.quotation.total, data.quotation.currency) }}</strong></div>
      </section>

      <section class="portal-alert warning" *ngIf="view() && !view()!.quotation.isLatestVersion" role="status">
        <kaklen-icon name="clock" />
        <span i18n="@@quotationObsoleteBanner">Esta versión es solo de lectura. Existe una versión más reciente.</span>
      </section>
      <section class="portal-alert danger" *ngIf="error()" role="alert">{{ error() }}</section>
      <section class="portal-loading" *ngIf="loading()" role="status" i18n="@@loadingQuotationPortal">Cargando cotización...</section>

      <ng-container *ngIf="view() as data">
        <section class="portal-band portal-summary-grid">
          <div><small i18n="@@clientLabel">Cliente</small><strong>{{ data.client.legalName || data.client.displayName }}</strong><span>{{ data.client.taxId || '' }}</span></div>
          <div><small i18n="@@issueDateLabel">Fecha de emisión</small><strong>{{ date(data.quotation.issueDate) }}</strong></div>
          <div><small i18n="@@validUntilLabel">Válida hasta</small><strong>{{ date(data.quotation.validUntil) }}</strong></div>
          <div><small i18n="@@publicLinkExpiresLabel">Enlace disponible hasta</small><strong>{{ date(data.link.expiresAt) }}</strong></div>
        </section>

        <section class="portal-band">
          <h2 i18n="@@quotationItemsTitle">Productos y servicios</h2>
          <div class="portal-item-table" role="table">
            <article class="portal-item" [class.portal-item-with-select]="data.actions.canRequestChanges" *ngFor="let item of data.quotation.items" role="row">
              <label *ngIf="data.actions.canRequestChanges" class="portal-item-select">
                <input type="checkbox" [checked]="selectedItems().has(item.index)" (change)="toggleItem(item.index)" />
                <span class="sr-only" i18n="@@selectItemForChanges">Seleccionar para solicitar cambios</span>
              </label>
              <div><strong>{{ item.name }}</strong><small>{{ item.code || '' }} · {{ item.quantity }} {{ item.unit }}</small><p *ngIf="item.description">{{ item.description }}</p></div>
              <div class="portal-item-money"><small>{{ money(item.unitPrice, data.quotation.currency) }}</small><strong>{{ money(item.total, data.quotation.currency) }}</strong></div>
            </article>
          </div>
          <dl class="portal-totals">
            <div><dt i18n="@@subtotalLabel">Subtotal</dt><dd>{{ money(data.quotation.subtotal, data.quotation.currency) }}</dd></div>
            <div><dt i18n="@@discountsTotalLabel">Descuentos</dt><dd>{{ money(data.quotation.discountTotal, data.quotation.currency) }}</dd></div>
            <div><dt i18n="@@taxesTotalLabel">Impuestos</dt><dd>{{ money(data.quotation.taxTotal, data.quotation.currency) }}</dd></div>
            <div class="total"><dt i18n="@@totalLabel">Total</dt><dd>{{ money(data.quotation.total, data.quotation.currency) }}</dd></div>
          </dl>
        </section>

        <section class="portal-band portal-copy" *ngIf="data.quotation.notes || data.quotation.terms">
          <div *ngIf="data.quotation.notes"><h2 i18n="@@notesLabel">Notas</h2><p>{{ data.quotation.notes }}</p></div>
          <div *ngIf="data.quotation.terms"><h2 i18n="@@termsLabel">Términos</h2><p>{{ data.quotation.terms }}</p></div>
        </section>

        <section class="portal-band portal-actions" *ngIf="data.actions.canRequestChanges || data.actions.canApproveAndPay">
          <div>
            <h2 i18n="@@quotationDecisionTitle">Responde la cotización</h2>
            <p i18n="@@quotationDecisionDescription">Puedes solicitar ajustes o continuar con la aprobación y el pago seguro.</p>
          </div>
          <button *ngIf="data.actions.canRequestChanges" type="button" class="secondary" (click)="changesOpen.set(!changesOpen())"><kaklen-icon name="message-circle" /><span i18n="@@requestChangesButton">Solicitar cambios</span></button>
          <button *ngIf="data.actions.canApproveAndPay" type="button" class="success" [disabled]="processing()" (click)="approveAndPay()"><kaklen-icon name="check-circle" /><span i18n="@@approveAndPayButton">Aprobar y pagar</span></button>
        </section>

        <section class="portal-band" *ngIf="changesOpen() && data.actions.canRequestChanges">
          <form [formGroup]="changesForm" (ngSubmit)="submitChanges()">
            <h2 i18n="@@requestChangesTitle">Cuéntanos qué debemos ajustar</h2>
            <kaklen-form-error-summary [form]="changesForm" [submitted]="changesSubmitted()" [labels]="changesLabels" />
            <label>
              <span><span i18n="@@changeRequestCommentLabel">Comentario</span><kaklen-required /></span>
              <textarea formControlName="comment" rows="5" minlength="5" maxlength="2000" aria-describedby="change-comment-error"></textarea>
              <kaklen-field-error id="change-comment-error" [control]="changesForm.controls.comment" [submitted]="changesSubmitted()" />
            </label>
            <div class="row-actions"><button type="button" class="ghost" (click)="changesOpen.set(false)" i18n="@@cancelButton">Cancelar</button><button type="submit" [disabled]="processing()" i18n="@@sendRequestButton">Enviar solicitud</button></div>
          </form>
        </section>

        <section class="portal-band provider-invitation" *ngIf="data.actions.canOfferServices && !providerOpen() && !providerSuccess()">
          <div><h2 i18n="@@providerRecommendationTitle">¿También prestas servicios?</h2><p i18n="@@providerRecommendationBody">Publica tu perfil profesional en Kaklen y permite que nuevos clientes encuentren tu trabajo.</p></div>
          <button type="button" class="secondary" (click)="openProvider()"><kaklen-icon name="user-plus" /><span i18n="@@createProviderProfileButton">Crear perfil profesional</span></button>
        </section>

        <section class="portal-band" *ngIf="providerOpen()">
          <form [formGroup]="providerForm" (ngSubmit)="submitProvider()">
            <h2 i18n="@@providerProfileTitle">Perfil profesional</h2>
            <kaklen-form-error-summary [form]="providerForm" [submitted]="providerSubmitted()" [labels]="providerLabels" />
            <div class="form-grid two-columns">
              <label><span><span i18n="@@providerCategoryLabel">Categoría</span><kaklen-required /></span><input formControlName="category" maxlength="80" /><kaklen-field-error [control]="providerForm.controls.category" [submitted]="providerSubmitted()" /></label>
              <label><span><span i18n="@@countryLabel">País</span><kaklen-required /></span><select formControlName="country"><option value="CL" i18n="@@countryChileLabel">Chile</option><option value="AR" i18n="@@countryArgentinaLabel">Argentina</option><option value="BR" i18n="@@countryBrazilLabel">Brasil</option><option value="MX" i18n="@@countryMexicoLabel">México</option><option value="US" i18n="@@countryUnitedStatesLabel">Estados Unidos</option></select></label>
              <label><span><span i18n="@@regionLabel">Región</span><kaklen-optional /></span><input formControlName="region" maxlength="120" /></label>
              <label><span><span i18n="@@cityLabel">Ciudad</span><kaklen-optional /></span><input formControlName="city" maxlength="120" /></label>
              <label><span><span i18n="@@whatsappLabel">WhatsApp</span><kaklen-required /></span><input type="tel" inputmode="tel" formControlName="whatsapp" maxlength="24" /><kaklen-field-error [control]="providerForm.controls.whatsapp" [submitted]="providerSubmitted()" /></label>
              <label><span><span i18n="@@providerPriceLabel">Precio referencial</span><kaklen-optional /></span><input type="number" inputmode="decimal" min="0" formControlName="price" /></label>
              <label><span><span i18n="@@portfolioUrlLabel">Portfolio</span><kaklen-optional /></span><input type="url" formControlName="portfolioUrl" maxlength="500" /></label>
            </div>
            <label><span><span i18n="@@providerDescriptionLabel">Descripción</span><kaklen-required /></span><textarea formControlName="description" rows="5" minlength="20" maxlength="2000"></textarea><kaklen-field-error [control]="providerForm.controls.description" [submitted]="providerSubmitted()" /></label>
            <label class="checkbox-row"><input type="checkbox" formControlName="consent" (change)="applyConsentPrefill()" /><span i18n="@@providerConsentLabel">Autorizo usar los datos confirmados de esta cotización para crear mi perfil.</span></label>
            <div class="row-actions"><button type="button" class="ghost" (click)="providerOpen.set(false)" i18n="@@cancelButton">Cancelar</button><button type="submit" [disabled]="processing()" i18n="@@submitForReviewButton">Enviar a revisión</button></div>
          </form>
        </section>

        <section class="portal-band portal-alert success" *ngIf="providerSuccess()" role="status">
          <kaklen-icon name="check-circle" />
          <div><strong i18n="@@providerProfileSubmittedTitle">Perfil enviado a revisión</strong><p i18n="@@providerProfileSubmittedBody">Recibimos tus datos. La publicación requiere una revisión antes de quedar visible.</p></div>
        </section>

        <section class="portal-band portal-history">
          <h2 i18n="@@statusHistoryTitle">Historial</h2>
          <ol><li *ngFor="let event of data.quotation.history"><strong>{{ statusLabel(event.status) }}</strong><time>{{ date(event.createdAt) }}</time></li></ol>
        </section>
      </ng-container>
    </main>
  `
})
export class PublicQuotationComponent implements OnInit {
  readonly view = signal<PublicQuotationView | null>(null);
  readonly loading = signal(true);
  readonly processing = signal(false);
  readonly error = signal("");
  readonly changesOpen = signal(false);
  readonly providerOpen = signal(false);
  readonly providerSuccess = signal(false);
  readonly selectedItems = signal(new Set<number>());
  readonly changesSubmitted = signal(false);
  readonly providerSubmitted = signal(false);
  readonly changesLabels = { comment: $localize`:@@changeRequestCommentLabel:Comentario` };
  readonly providerLabels = {
    category: $localize`:@@providerCategoryLabel:Categoría`,
    description: $localize`:@@providerDescriptionLabel:Descripción`,
    whatsapp: $localize`:@@whatsappLabel:WhatsApp`,
    consent: $localize`:@@providerConsentShortLabel:Consentimiento`
  };
  readonly changesForm = new FormGroup({
    comment: new FormControl("", { nonNullable: true, validators: [Validators.required, trimmedRequired(), Validators.minLength(5), Validators.maxLength(2000)] })
  });
  readonly providerForm = new FormGroup({
    category: new FormControl("", { nonNullable: true, validators: [Validators.required, trimmedRequired(), Validators.minLength(2), Validators.maxLength(80)] }),
    description: new FormControl("", { nonNullable: true, validators: [Validators.required, trimmedRequired(), Validators.minLength(20), Validators.maxLength(2000)] }),
    country: new FormControl<"CL" | "AR" | "BR" | "MX" | "US">("CL", { nonNullable: true, validators: [Validators.required] }),
    region: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(120)] }),
    city: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(120)] }),
    whatsapp: new FormControl("", { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\+[1-9]\d{7,14}$/), Validators.maxLength(24)] }),
    price: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
    portfolioUrl: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(500), Validators.pattern(/^https?:\/\/.+/)] }),
    consent: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] })
  });
  private publicToken = "";
  private paymentKey = crypto.randomUUID();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly portal: QuotationPortalService,
    private readonly locale: LocaleService
  ) {}

  async ngOnInit(): Promise<void> {
    this.publicToken = this.route.snapshot.paramMap.get("publicToken") ?? "";
    await this.load();
  }

  toggleItem(index: number): void {
    const next = new Set(this.selectedItems());
    next.has(index) ? next.delete(index) : next.add(index);
    this.selectedItems.set(next);
  }

  async submitChanges(): Promise<void> {
    this.changesSubmitted.set(true);
    this.changesForm.markAllAsTouched();
    if (this.changesForm.invalid || this.processing()) return;
    this.processing.set(true);
    this.error.set("");
    try {
      await this.portal.requestChanges(
        this.publicToken,
        this.changesForm.controls.comment.value.trim(),
        [...this.selectedItems()]
      );
      this.changesOpen.set(false);
      await this.load();
    } catch {
      this.error.set($localize`:@@changeRequestError:No fue posible enviar la solicitud de cambios.`);
    } finally {
      this.processing.set(false);
    }
  }

  async approveAndPay(): Promise<void> {
    if (this.processing()) return;
    this.processing.set(true);
    this.error.set("");
    try {
      const intent = await this.portal.createPayment(this.publicToken, this.paymentKey, this.locale.getLocale());
      window.location.assign(intent.checkoutUrl);
    } catch {
      this.error.set($localize`:@@paymentStartError:No fue posible iniciar el pago. Intenta nuevamente.`);
      this.paymentKey = crypto.randomUUID();
      this.processing.set(false);
    }
  }

  async openProvider(): Promise<void> {
    this.providerOpen.set(true);
    try {
      await this.portal.recommendationShown(this.publicToken);
    } catch {
      this.error.set($localize`:@@providerRecommendationError:No fue posible abrir el registro profesional.`);
    }
  }

  applyConsentPrefill(): void {
    const data = this.view();
    if (this.providerForm.controls.consent.value && data) {
      this.providerForm.patchValue({
        country: supportedCountry(data.organization.country),
        whatsapp: normalizePhone(data.client.whatsapp ?? "")
      });
    }
  }

  async submitProvider(): Promise<void> {
    this.providerSubmitted.set(true);
    this.providerForm.markAllAsTouched();
    if (this.providerForm.invalid || this.processing()) return;
    this.processing.set(true);
    try {
      const value = this.providerForm.getRawValue();
      const payload: ProviderProfilePayload = {
        consent: true,
        category: value.category.trim(),
        description: value.description.trim(),
        country: value.country,
        whatsapp: normalizePhone(value.whatsapp),
        currency: this.view()?.quotation.currency ?? "CLP",
        ...(value.region.trim() ? { region: value.region.trim() } : {}),
        ...(value.city.trim() ? { city: value.city.trim() } : {}),
        ...(value.price !== null ? { price: value.price } : {}),
        ...(value.portfolioUrl.trim() ? { portfolioUrl: value.portfolioUrl.trim() } : {})
      };
      await this.portal.createProviderProfile(this.publicToken, payload);
      this.providerOpen.set(false);
      this.providerSuccess.set(true);
      this.error.set("");
    } catch {
      this.error.set($localize`:@@providerProfileError:No fue posible enviar el perfil a revisión.`);
    } finally {
      this.processing.set(false);
    }
  }

  money(value: string, currency: string): string {
    return new Intl.NumberFormat(this.locale.getLocale() === "es" ? "es-CL" : this.locale.getLocale(), {
      style: "currency", currency, maximumFractionDigits: currency === "CLP" ? 0 : 2
    }).format(Number(value));
  }

  date(value: string): string {
    return new Intl.DateTimeFormat(this.locale.getLocale() === "es" ? "es-CL" : this.locale.getLocale(), { dateStyle: "medium" }).format(new Date(value));
  }

  statusLabel(status: PublicQuotationStatus): string {
    const labels: Record<PublicQuotationStatus, string> = {
      DRAFT: $localize`:@@draftLabel:Borrador`, SENT: $localize`:@@sentLabel:Enviada`,
      CHANGES_REQUESTED: $localize`:@@changesRequestedLabel:Cambios solicitados`, APPROVED: $localize`:@@approvedLabel:Aprobada`,
      REJECTED: $localize`:@@rejectedLabel:Rechazada`, EXPIRED: $localize`:@@expiredLabel:Expirada`, CANCELLED: $localize`:@@quotationCancelledLabel:Cancelada`
    };
    return labels[status];
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set("");
    try {
      const data = await this.portal.view(this.publicToken);
      this.view.set(data);
      this.providerForm.controls.country.setValue(supportedCountry(data.organization.country));
    } catch {
      this.error.set($localize`:@@quotationLinkUnavailable:El enlace no es válido, venció o fue revocado.`);
    } finally {
      this.loading.set(false);
    }
  }
}

function supportedCountry(value: string): "CL" | "AR" | "BR" | "MX" | "US" {
  return value === "AR" || value === "BR" || value === "MX" || value === "US" ? value : "CL";
}
