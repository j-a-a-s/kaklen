import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { KaklenTooltipDirective } from "./tooltip.directive";

@Component({
  standalone: true,
  imports: [KaklenTooltipDirective],
  template: `<button [kaklenTooltip]="label">Action</button>`
})
class TooltipHostComponent {
  label = "Complete action description";
}

describe("KaklenTooltipDirective", () => {
  let fixture: ComponentFixture<TooltipHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TooltipHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(TooltipHostComponent);
    fixture.detectChanges();
  });

  afterEach(() => document.querySelectorAll(".kaklen-tooltip").forEach((element) => element.remove()));

  it("is available on hover and keyboard focus", () => {
    const button = fixture.nativeElement.querySelector("button") as HTMLButtonElement;
    button.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    fixture.detectChanges();
    const tooltip = document.querySelector(".kaklen-tooltip");
    expect(tooltip?.textContent).toContain("Complete action description");
    expect(button.getAttribute("aria-describedby")).toContain(tooltip?.id ?? "missing");
    button.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    expect(document.querySelector(".kaklen-tooltip")).toBeNull();
  });
});
