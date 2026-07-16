import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { ActionMenuComponent, ActionMenuItemDirective } from "./action-menu.component";

@Component({
  standalone: true,
  imports: [ActionMenuComponent, ActionMenuItemDirective],
  template: `
    <kaklen-action-menu [contextKey]="context">
      <button kaklenMenuItem type="button">Edit</button>
      <button kaklenMenuItem type="button">Archive</button>
    </kaklen-action-menu>
  `
})
class MenuHostComponent {
  context = "organization-1";
}

describe("ActionMenuComponent", () => {
  let fixture: ComponentFixture<MenuHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuHostComponent],
      providers: [provideRouter([])]
    }).compileComponents();
    fixture = TestBed.createComponent(MenuHostComponent);
    fixture.detectChanges();
  });

  it("closes on outside click and organization context changes", () => {
    trigger().click();
    fixture.detectChanges();
    expect(panel()).not.toBeNull();

    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    fixture.detectChanges();
    expect(panel()).toBeNull();

    trigger().click();
    fixture.detectChanges();
    fixture.componentInstance.context = "organization-2";
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  it("supports arrow navigation, Escape, and focus return", async () => {
    const button = trigger();
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    fixture.detectChanges();
    expect(document.activeElement?.textContent).toContain("Edit");

    panel()?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(document.activeElement?.textContent).toContain("Archive");
    panel()?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    fixture.detectChanges();
    await Promise.resolve();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("closes when navigation starts", async () => {
    trigger().click();
    fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl("/");
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  function trigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector(".action-menu-trigger") as HTMLButtonElement;
  }

  function panel(): HTMLElement | null {
    return fixture.nativeElement.querySelector(".shared-action-menu-panel") as HTMLElement | null;
  }
});
