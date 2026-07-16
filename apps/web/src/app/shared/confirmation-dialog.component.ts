import { CommonModule } from "@angular/common";
import { Component, EventEmitter, HostListener, Input, Output } from "@angular/core";
import { UiIconComponent, UiIconName } from "./ui-icon.component";

@Component({
  selector: "kaklen-confirmation-dialog",
  standalone: true,
  imports: [CommonModule, UiIconComponent],
  template: `
    <div class="confirmation-backdrop" *ngIf="open" (click)="cancel.emit()">
      <section
        class="confirmation-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
        aria-describedby="confirmation-description"
        (click)="$event.stopPropagation()"
      >
        <h2 id="confirmation-title">{{ title }}</h2>
        <p id="confirmation-description">{{ description }}</p>
        <div class="row-actions">
          <button type="button" class="secondary" (click)="cancel.emit()" [disabled]="busy" i18n="@@keepButton">Conservar</button>
          <button type="button" [class.danger]="tone === 'danger'" [class.success]="tone === 'success'" (click)="confirm.emit()" [disabled]="busy">
            <kaklen-icon [name]="icon" /><span>{{ busy ? processingLabel : confirmLabel }}</span>
          </button>
        </div>
      </section>
    </div>
  `
})
export class ConfirmationDialogComponent {
  @Input() open = false;
  @Input() busy = false;
  @Input() title = "";
  @Input() description = "";
  @Input() confirmLabel = "";
  @Input() tone: "primary" | "success" | "danger" = "danger";
  @Input() icon: UiIconName = "check";
  @Output() readonly confirm = new EventEmitter<void>();
  @Output() readonly cancel = new EventEmitter<void>();
  readonly processingLabel = $localize`:@@processingButton:Procesando...`;

  @HostListener("document:keydown.escape", ["$event"])
  closeOnEscape(event: Event): void {
    if (this.open && !this.busy) {
      event.preventDefault();
      this.cancel.emit();
    }
  }
}
