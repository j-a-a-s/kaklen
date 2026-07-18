import { Directive, ElementRef, HostBinding, HostListener, Input } from "@angular/core";
import { currencyFractionDigits, currencyStep, parseMoney, validateMoneyPrecision } from "@kaklen/shared";

@Directive({
  selector: "input[kaklenMoneyInput]",
  standalone: true
})
export class MoneyInputDirective {
  @Input() kaklenMoneyInput: boolean | "" = "";
  @Input({ required: true }) currency = "CLP";

  constructor(private readonly element: ElementRef<HTMLInputElement>) {}

  @HostBinding("attr.inputmode")
  get inputMode(): "numeric" | "decimal" {
    return this.moneyMode && currencyFractionDigits(this.currency) === 0 ? "numeric" : "decimal";
  }

  @HostBinding("attr.step")
  get step(): string {
    return this.moneyMode ? currencyStep(this.currency) : "0.01";
  }

  @HostListener("blur")
  normalizeScaleOnlyFraction(): void {
    const input = this.element.nativeElement;
    const source = input.value.trim();
    const decimalSource = source.replace(",", ".");
    if (!this.moneyMode || !/^[-+]?\d+(?:\.\d+)?$/.test(decimalSource) ||
      !validateMoneyPrecision(decimalSource, this.currency)) return;
    const normalized = parseMoney(decimalSource, this.currency);
    if (normalized === source) return;
    input.value = normalized;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  private get moneyMode(): boolean {
    return this.kaklenMoneyInput !== false;
  }
}
