import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { KaklenButtonDirective } from "./button.directive";

@Component({
  standalone: true,
  imports: [KaklenButtonDirective],
  template: `<button kaklenButton="success" [kaklenButtonLoading]="loading" (click)="calls = calls + 1">Approve</button>`
})
class ButtonHostComponent {
  loading = false;
  calls = 0;
}

describe("KaklenButtonDirective", () => {
  let fixture: ComponentFixture<ButtonHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ButtonHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(ButtonHostComponent);
    fixture.detectChanges();
  });

  it("applies semantic variants and blocks repeated loading clicks", () => {
    const button = fixture.nativeElement.querySelector("button") as HTMLButtonElement;
    expect(button.classList.contains("success")).toBeTrue();
    button.click();
    expect(fixture.componentInstance.calls).toBe(1);
    fixture.componentInstance.loading = true;
    fixture.detectChanges();
    button.click();
    expect(fixture.componentInstance.calls).toBe(1);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });
});
