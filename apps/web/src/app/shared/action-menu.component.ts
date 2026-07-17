import { CommonModule } from "@angular/common";
import {
  AfterContentInit,
  Component,
  ContentChildren,
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  QueryList,
  SimpleChanges,
  ViewChild,
  signal
} from "@angular/core";
import { NavigationStart, Router } from "@angular/router";
import { Subscription } from "rxjs";
import { UiIconComponent, UiIconName } from "./ui-icon.component";
import { OverlayCoordinatorService } from "./overlay-coordinator.service";
import { KaklenTooltipDirective } from "./ui/tooltip.directive";

let actionMenuSequence = 0;

@Directive({
  selector: "[kaklenMenuItem]",
  standalone: true,
  host: {
    role: "menuitem",
    tabindex: "-1"
  }
})
export class ActionMenuItemDirective {
  constructor(readonly elementRef: ElementRef<HTMLElement>) {}
}

@Component({
  selector: "kaklen-action-menu",
  standalone: true,
  imports: [CommonModule, UiIconComponent, KaklenTooltipDirective],
  template: `
    <div class="shared-action-menu">
      <button
        #trigger
        type="button"
        class="secondary action-menu-trigger"
        aria-haspopup="menu"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="panelId"
        [attr.aria-label]="label"
        [kaklenTooltip]="label"
        (click)="toggle()"
        (keydown)="onTriggerKeydown($event)"
      >
        <span class="user-avatar" *ngIf="triggerText; else triggerIcon" aria-hidden="true">{{ triggerText }}</span>
        <ng-template #triggerIcon><kaklen-icon [name]="icon" /></ng-template>
        <span class="action-menu-badge" *ngIf="badge" aria-hidden="true">{{ badge }}</span>
        <span *ngIf="showLabel">{{ label }}</span>
      </button>
      <div
        #panel
        *ngIf="open()"
        class="shared-action-menu-panel"
        [class.open-above]="openAbove()"
        [class.align-start]="alignStart()"
        [id]="panelId"
        role="menu"
        [attr.aria-label]="label"
        (click)="onPanelClick($event)"
        (keydown)="onPanelKeydown($event)"
      >
        <ng-content />
      </div>
    </div>
  `
})
export class ActionMenuComponent implements AfterContentInit, OnChanges, OnDestroy {
  @Input() label = $localize`:@@moreActionsLabel:Más acciones`;
  @Input() icon: UiIconName = "ellipsis";
  @Input() showLabel = true;
  @Input() triggerText = "";
  @Input() badge = "";
  @Input() contextKey: string | null = null;
  @ViewChild("trigger") private trigger?: ElementRef<HTMLButtonElement>;
  @ViewChild("panel") private panel?: ElementRef<HTMLElement>;
  @ContentChildren(ActionMenuItemDirective, { descendants: true }) private menuItems?: QueryList<ActionMenuItemDirective>;
  readonly panelId = `kaklen-action-menu-${++actionMenuSequence}`;
  readonly open = signal(false);
  readonly openAbove = signal(false);
  readonly alignStart = signal(false);
  private activeIndex = 0;
  private readonly routeSubscription: Subscription;
  private itemsSubscription?: Subscription;

  constructor(
    private readonly host: ElementRef<HTMLElement>,
    private readonly overlays: OverlayCoordinatorService,
    router: Router
  ) {
    this.routeSubscription = router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.close(false);
      }
    });
  }

  ngAfterContentInit(): void {
    this.itemsSubscription = this.menuItems?.changes.subscribe(() => this.prepareItems());
    this.prepareItems();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["contextKey"] && !changes["contextKey"].firstChange) {
      this.close(false);
    }
  }

  toggle(): void {
    this.open() ? this.close(true) : this.show();
  }

  show(focus: "first" | "last" | null = null): void {
    this.overlays.open(this, (returnFocus) => this.close(returnFocus));
    this.open.set(true);
    this.activeIndex = focus === "last" ? Math.max(0, this.items().length - 1) : 0;
    queueMicrotask(() => {
      this.updatePlacement();
      if (focus) {
        this.focusItem(this.activeIndex);
      }
    });
  }

  close(returnFocus = true): void {
    if (!this.open()) return;
    this.open.set(false);
    this.overlays.closed(this);
    if (returnFocus) {
      queueMicrotask(() => this.trigger?.nativeElement.focus());
    }
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.show("first");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      this.show("last");
    }
  }

  onPanelKeydown(event: KeyboardEvent): void {
    const items = this.items();
    if (items.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      this.activeIndex = (this.activeIndex + delta + items.length) % items.length;
      this.focusItem(this.activeIndex);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      this.activeIndex = event.key === "Home" ? 0 : items.length - 1;
      this.focusItem(this.activeIndex);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.close(true);
    } else if (event.key === "Tab") {
      this.close(false);
    }
  }

  onPanelClick(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target.closest("[kaklenMenuItem]") : null;
    if (target) {
      this.close(true);
    }
  }

  @HostListener("document:pointerdown", ["$event"])
  onDocumentPointerDown(event: PointerEvent): void {
    if (this.open() && event.target instanceof Node && !this.host.nativeElement.contains(event.target)) {
      this.close(false);
    }
  }

  @HostListener("window:resize")
  onViewportChange(): void {
    if (this.open()) this.updatePlacement();
  }

  @HostListener("window:scroll")
  onWindowScroll(): void {
    if (this.open()) this.updatePlacement();
  }

  ngOnDestroy(): void {
    this.close(false);
    this.routeSubscription.unsubscribe();
    this.itemsSubscription?.unsubscribe();
  }

  private items(): HTMLElement[] {
    return (this.menuItems?.toArray() ?? [])
      .map((item) => item.elementRef.nativeElement)
      .filter((item) => !item.hasAttribute("disabled") && item.getAttribute("aria-disabled") !== "true");
  }

  private prepareItems(): void {
    this.menuItems?.forEach((item) => item.elementRef.nativeElement.setAttribute("tabindex", "-1"));
  }

  private focusItem(index: number): void {
    this.items()[index]?.focus();
  }

  private updatePlacement(): void {
    const trigger = this.trigger?.nativeElement;
    const panel = this.panel?.nativeElement;
    if (!trigger || !panel) return;
    const margin = 8;
    const gap = 6;
    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const roomBelow = window.innerHeight - triggerRect.bottom - gap - margin;
    const roomAbove = triggerRect.top - gap - margin;
    this.openAbove.set(roomBelow < panelRect.height && roomAbove > roomBelow);
    this.alignStart.set(triggerRect.right - panelRect.width < margin);
  }
}
