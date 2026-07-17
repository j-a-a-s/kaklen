import { Directive, ElementRef, HostListener, Input, OnDestroy } from "@angular/core";

let tooltipSequence = 0;

@Directive({
  selector: "[kaklenTooltip]",
  standalone: true
})
export class KaklenTooltipDirective implements OnDestroy {
  @Input({ required: true }) kaklenTooltip = "";
  private tooltip: HTMLElement | null = null;
  private previousDescribedBy = "";

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  @HostListener("mouseenter")
  @HostListener("focusin")
  show(): void {
    if (!this.kaklenTooltip.trim() || this.tooltip) {
      return;
    }
    const tooltip = document.createElement("span");
    tooltip.id = `kaklen-tooltip-${++tooltipSequence}`;
    tooltip.className = "kaklen-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.textContent = this.kaklenTooltip;
    document.body.appendChild(tooltip);
    this.tooltip = tooltip;

    const element = this.host.nativeElement;
    this.previousDescribedBy = element.getAttribute("aria-describedby") ?? "";
    element.setAttribute(
      "aria-describedby",
      [this.previousDescribedBy, tooltip.id].filter(Boolean).join(" ")
    );
    this.position();
  }

  @HostListener("mouseleave")
  @HostListener("focusout")
  @HostListener("document:keydown.escape")
  hide(): void {
    if (!this.tooltip) {
      return;
    }
    this.tooltip.remove();
    this.tooltip = null;
    if (this.previousDescribedBy) {
      this.host.nativeElement.setAttribute("aria-describedby", this.previousDescribedBy);
    } else {
      this.host.nativeElement.removeAttribute("aria-describedby");
    }
  }

  @HostListener("window:resize")
  @HostListener("window:scroll")
  position(): void {
    if (!this.tooltip) {
      return;
    }
    const margin = 8;
    const gap = 8;
    const hostRect = this.host.nativeElement.getBoundingClientRect();
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const centered = hostRect.left + hostRect.width / 2 - tooltipRect.width / 2;
    const left = Math.min(
      Math.max(margin, centered),
      Math.max(margin, window.innerWidth - tooltipRect.width - margin)
    );
    const top = hostRect.top - tooltipRect.height - gap >= margin
      ? hostRect.top - tooltipRect.height - gap
      : hostRect.bottom + gap;
    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${Math.min(top, window.innerHeight - tooltipRect.height - margin)}px`;
  }

  ngOnDestroy(): void {
    this.hide();
  }
}
