import { Directive, HostBinding, HostListener, Input } from "@angular/core";

export type KaklenButtonVariant = "primary" | "success" | "danger" | "secondary" | "ghost";

@Directive({
  selector: "button[kaklenButton], a[kaklenButton]",
  standalone: true
})
export class KaklenButtonDirective {
  @Input("kaklenButton") variant: KaklenButtonVariant = "primary";
  @Input() kaklenButtonLoading = false;

  @HostBinding("class.kaklen-button") readonly buttonClass = true;
  @HostBinding("class.primary") get primary(): boolean {
    return this.variant === "primary";
  }
  @HostBinding("class.success") get success(): boolean {
    return this.variant === "success";
  }
  @HostBinding("class.danger") get danger(): boolean {
    return this.variant === "danger";
  }
  @HostBinding("class.secondary") get secondary(): boolean {
    return this.variant === "secondary";
  }
  @HostBinding("class.ghost") get ghost(): boolean {
    return this.variant === "ghost";
  }
  @HostBinding("class.is-loading") get loadingClass(): boolean {
    return this.kaklenButtonLoading;
  }
  @HostBinding("attr.aria-busy") get ariaBusy(): string | null {
    return this.kaklenButtonLoading ? "true" : null;
  }
  @HostBinding("attr.aria-disabled") get ariaDisabled(): string | null {
    return this.kaklenButtonLoading ? "true" : null;
  }
  @HostBinding("attr.disabled") get loadingDisabled(): string | null {
    return this.kaklenButtonLoading ? "" : null;
  }

  @HostListener("click", ["$event"])
  stopRepeatedAction(event: Event): void {
    if (this.kaklenButtonLoading) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
}
