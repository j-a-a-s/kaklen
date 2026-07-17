import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { LocaleService } from "../i18n/locale.service";
import { PublicPaymentCheckout } from "../portal/quotation-portal.models";
import { QuotationPortalService } from "../portal/quotation-portal.service";
import { UiIconComponent } from "../shared/ui-icon.component";

@Component({
  selector: "kaklen-payment-checkout",
  standalone: true,
  imports: [CommonModule, UiIconComponent],
  template: `
    <main class="checkout-shell">
      <section class="checkout-panel" *ngIf="checkout() as data">
        <p class="eyebrow">{{ data.organization.name }}</p>
        <h1 i18n="@@sandboxPaymentTitle">Pago seguro de prueba</h1>
        <p><span i18n="@@quotationLabel">Cotización</span> {{ data.quotation.number }} v{{ data.quotation.version }}</p>
        <div class="checkout-amount"><small i18n="@@amountToPayLabel">Monto a pagar</small><strong>{{ money(data.payment.amount, data.payment.currency) }}</strong></div>
        <div class="sandbox-notice" role="note"><kaklen-icon name="settings" /><span i18n="@@sandboxPaymentNotice">Entorno sandbox. No se realizará ningún cargo real.</span></div>
        <p class="form-error" *ngIf="error()">{{ error() }}</p>
        <div class="checkout-result success" *ngIf="result() === 'PAID'" role="status"><kaklen-icon name="check-circle" /><div><strong i18n="@@paymentConfirmedTitle">Pago confirmado</strong><p i18n="@@paymentConfirmedBody">El webhook sandbox confirmó el pago y generó el recibo.</p></div></div>
        <div class="checkout-result danger" *ngIf="result() === 'FAILED'" role="status"><kaklen-icon name="x-circle" /><div><strong i18n="@@paymentFailedTitle">Pago no completado</strong><p i18n="@@paymentFailedBody">Puedes volver a intentarlo de forma segura.</p></div></div>
        <div class="row-actions" *ngIf="result() !== 'PAID'">
          <button type="button" class="success" [disabled]="processing()" (click)="complete('PAID')"><kaklen-icon name="check" /><span i18n="@@sandboxApprovePaymentButton">Confirmar pago sandbox</span></button>
          <button type="button" class="secondary" [disabled]="processing()" (click)="complete('FAILED')"><kaklen-icon name="x-circle" /><span i18n="@@sandboxFailPaymentButton">Simular rechazo</span></button>
        </div>
        <button type="button" class="ghost" (click)="back()"><kaklen-icon name="arrow-left" /><span i18n="@@backToQuotationButton">Volver a la cotización</span></button>
      </section>
      <p *ngIf="loading()" role="status" i18n="@@loadingPayment">Cargando pago...</p>
    </main>
  `
})
export class PaymentCheckoutComponent implements OnInit {
  readonly checkout = signal<PublicPaymentCheckout | null>(null);
  readonly loading = signal(true);
  readonly processing = signal(false);
  readonly result = signal<"PAID" | "FAILED" | null>(null);
  readonly error = signal("");
  private checkoutToken = "";

  constructor(
    private readonly route: ActivatedRoute,
    private readonly portal: QuotationPortalService,
    private readonly locale: LocaleService
  ) {}

  async ngOnInit(): Promise<void> {
    this.checkoutToken = this.route.snapshot.paramMap.get("checkoutToken") ?? "";
    try {
      const checkout = await this.portal.checkout(this.checkoutToken);
      this.checkout.set(checkout);
      if (checkout.payment.status === "PAID") this.result.set("PAID");
    } catch {
      this.error.set($localize`:@@paymentUnavailableError:Este pago no está disponible.`);
    } finally {
      this.loading.set(false);
    }
  }

  async complete(outcome: "PAID" | "FAILED"): Promise<void> {
    if (this.processing()) return;
    this.processing.set(true);
    this.error.set("");
    try {
      const response = await this.portal.completePayment(this.checkoutToken, outcome);
      this.result.set(response.status === "PAID" ? "PAID" : "FAILED");
    } catch {
      this.error.set($localize`:@@paymentProcessingError:No fue posible procesar el pago sandbox.`);
    } finally {
      this.processing.set(false);
    }
  }

  back(): void {
    history.back();
  }

  money(value: string, currency: string): string {
    return new Intl.NumberFormat(this.locale.getLocale() === "es" ? "es-CL" : this.locale.getLocale(), {
      style: "currency", currency, maximumFractionDigits: currency === "CLP" ? 0 : 2
    }).format(Number(value));
  }
}
