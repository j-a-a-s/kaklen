import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormsModule } from "@angular/forms";
import { MoneyInputDirective } from "./money-input.directive";

@Component({
  standalone: true,
  imports: [FormsModule, MoneyInputDirective],
  template: `<input kaklenMoneyInput [currency]="currency" [(ngModel)]="value" />`
})
class MoneyInputHostComponent {
  currency = "CLP";
  value = "";
}

describe("MoneyInputDirective", () => {
  let fixture: ComponentFixture<MoneyInputHostComponent>;
  let input: HTMLInputElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MoneyInputHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(MoneyInputHostComponent);
    fixture.detectChanges();
    input = fixture.nativeElement.querySelector("input") as HTMLInputElement;
  });

  it("uses integer input semantics and normalizes zero CLP fractions", () => {
    input.value = "1000.00";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("blur"));
    fixture.detectChanges();

    expect(input.inputMode).toBe("numeric");
    expect(input.step).toBe("1");
    expect(input.value).toBe("1000");
  });

  it("preserves an economic CLP fraction so validation can reject it", () => {
    input.value = "1000.50";
    input.dispatchEvent(new Event("blur"));

    expect(input.value).toBe("1000.50");
  });

  it("uses decimal semantics for currencies with fractional units", () => {
    fixture.componentInstance.currency = "USD";
    fixture.detectChanges();

    expect(input.inputMode).toBe("decimal");
    expect(input.step).toBe("0.01");
  });
});
