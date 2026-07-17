import { CommonModule } from "@angular/common";
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { QuotationEmailPayload } from "./quotation.models";
import { emailValidator, normalizeEmail, trimmedRequired } from "../shared/forms/form-validators";
import {
  FieldErrorComponent,
  FormControlA11yDirective,
  FormErrorSummaryComponent,
    FormFieldComponent
} from "../shared/forms/form-feedback.components";
import { UiIconComponent } from "../shared/ui-icon.component";

@Component({
  selector: "kaklen-quotation-email-dialog",
  standalone: true,
  imports: [FormFieldComponent,
    CommonModule,
    ReactiveFormsModule,
    FieldErrorComponent,
    FormControlA11yDirective,
    FormErrorSummaryComponent,
        UiIconComponent
  ],
  template: `
    <div class="confirmation-backdrop" *ngIf="open" (mousedown)="requestClose()">
      <section #dialog class="confirmation-dialog quotation-email-dialog" role="dialog" aria-modal="true" aria-labelledby="quotation-email-title" (mousedown)="$event.stopPropagation()">
        <header class="section-heading compact">
          <div><p class="eyebrow" i18n="@@sendQuotationEmailEyebrow">Correo de cotización</p><h2 id="quotation-email-title" i18n="@@sendQuotationEmailTitle">Enviar por email</h2></div>
          <button type="button" class="icon-button" (click)="requestClose()" [disabled]="busy" aria-label="Cerrar" i18n-aria-label="@@closeButton"><kaklen-icon name="x" /></button>
        </header>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <kaklen-form-error-summary [form]="form" [attempted]="submitted" [labels]="fieldLabels" />
          <label kaklen-form-field label="Destinatario" i18n-label="@@recipientEmailLabel" controlId="quotation-email-dialog-to" required="auto" invalid="auto">
            <input kaklenControl #recipientInput type="email" formControlName="to" maxlength="254" inputmode="email" autocomplete="email" aria-describedby="quotation-email-to-error" />
            <kaklen-field-error id="quotation-email-to-error" [control]="form.controls.to" [attempted]="submitted" />
          </label>
          <label kaklen-form-field label="Asunto" i18n-label="@@subjectLabel" controlId="quotation-email-dialog-subject" required="auto" invalid="auto">
            <input kaklenControl formControlName="subject" maxlength="200" aria-describedby="quotation-email-subject-error" />
            <kaklen-field-error id="quotation-email-subject-error" [control]="form.controls.subject" [attempted]="submitted" />
          </label>
          <label kaklen-form-field label="Mensaje" i18n-label="@@messageLabel" controlId="quotation-email-dialog-message" required="auto" invalid="auto">
            <textarea kaklenControl formControlName="message" maxlength="5000" rows="6" aria-describedby="quotation-email-message-error"></textarea>
            <kaklen-field-error id="quotation-email-message-error" [control]="form.controls.message" [attempted]="submitted" />
          </label>
          <p class="verification-note"><kaklen-icon name="file-text" /><span i18n="@@quotationPdfAttachmentHelp">Se adjuntará automáticamente el PDF actualizado de la cotización.</span></p>
          <div class="row-actions">
            <button type="button" class="secondary" (click)="requestClose()" [disabled]="busy" i18n="@@cancelButton">Cancelar</button>
            <button type="submit" [disabled]="busy"><kaklen-icon name="mail" /><span>{{ busy ? sendingLabel : sendLabel }}</span></button>
          </div>
        </form>
      </section>
    </div>
  `
})
export class QuotationEmailDialogComponent implements OnChanges, OnDestroy {
  @Input() open = false;
  @Input() busy = false;
  @Input() recipient = "";
  @Input() quotationNumber = "";
  @Input() locale: QuotationEmailPayload["locale"] = "es";
  @Output() readonly sendRequested = new EventEmitter<QuotationEmailPayload>();
  @Output() readonly cancelled = new EventEmitter<void>();
  @ViewChild("dialog") private dialog?: ElementRef<HTMLElement>;
  @ViewChild("recipientInput") private recipientInput?: ElementRef<HTMLInputElement>;
  submitted = false;
  readonly sendLabel = $localize`:@@sendEmailButton:Enviar email`;
  readonly sendingLabel = $localize`:@@sendingEmailButton:Enviando...`;
  readonly fieldLabels = {
    to: $localize`:@@recipientEmailLabel:Destinatario`,
    subject: $localize`:@@subjectLabel:Asunto`,
    message: $localize`:@@messageLabel:Mensaje`
  };
  readonly form = new FormGroup({
    to: new FormControl("", { nonNullable: true, validators: [emailValidator(true)] }),
    subject: new FormControl("", { nonNullable: true, validators: [Validators.required, trimmedRequired(), Validators.maxLength(200)] }),
    message: new FormControl("", { nonNullable: true, validators: [Validators.required, trimmedRequired(), Validators.maxLength(5000)] })
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["open"] && this.open) {
      this.submitted = false;
      this.form.reset({
        to: this.recipient,
        subject: $localize`:@@quotationEmailDefaultSubject:Cotización ${this.quotationNumber}:quotationNumber:`,
        message: $localize`:@@quotationEmailDefaultMessage:Adjuntamos nuestra propuesta comercial para tu revisión.`
      });
      document.body.classList.add("modal-open");
      window.setTimeout(() => this.recipientInput?.nativeElement.focus(), 0);
    } else if (changes["open"] && !this.open) {
      document.body.classList.remove("modal-open");
    }
  }

  submit(): void {
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.busy || this.form.invalid) {
      this.focusFirstInvalid();
      return;
    }
    const value = this.form.getRawValue();
    this.sendRequested.emit({
      to: normalizeEmail(value.to),
      subject: value.subject.trim(),
      message: value.message.trim(),
      locale: this.locale
    });
  }

  requestClose(): void {
    if (!this.busy) this.cancelled.emit();
  }

  @HostListener("document:keydown", ["$event"])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.open) return;
    if (event.key === "Escape" && !this.busy) {
      event.preventDefault();
      this.cancelled.emit();
    } else if (event.key === "Tab") {
      this.trapFocus(event);
    }
  }

  ngOnDestroy(): void {
    document.body.classList.remove("modal-open");
  }

  private focusFirstInvalid(): void {
    window.setTimeout(() => this.dialog?.nativeElement.querySelector<HTMLElement>(".ng-invalid")?.focus(), 0);
  }

  private trapFocus(event: KeyboardEvent): void {
    const focusable = Array.from(this.dialog?.nativeElement.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
