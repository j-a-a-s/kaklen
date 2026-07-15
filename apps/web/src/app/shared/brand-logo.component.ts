import { Component, Input } from "@angular/core";

export type BrandLogoVariant = "compact" | "signature";

@Component({
  selector: "kaklen-brand-logo",
  standalone: true,
  template: `
    <span class="brand-lockup" [class.brand-lockup-signature]="variant === 'signature'">
      <img
        [src]="variant === 'signature' ? 'brand/logo-texto.png' : 'brand/logo-kaklen.png'"
        [width]="variant === 'signature' ? 1536 : 1494"
        [height]="variant === 'signature' ? 1024 : 988"
        alt=""
        decoding="async"
      />
      <span class="sr-only">Kaklen</span>
    </span>
  `
})
export class BrandLogoComponent {
  @Input() variant: BrandLogoVariant = "compact";
}
