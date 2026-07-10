import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AuthService } from "../auth/auth.service";
import { LocaleService, SupportedLocale } from "./locale.service";

@Component({
  selector: "kaklen-locale-selector",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <label class="locale-selector">
      <span i18n="@@languageSelectorLabel">Idioma</span>
      <select
        [attr.aria-label]="ariaLabel"
        [ngModel]="currentLocale"
        (ngModelChange)="changeLocale($event)"
      >
        <option value="es" i18n="@@localeSpanish">Español</option>
        <option value="en" i18n="@@localeEnglish">English</option>
        <option value="pt-BR" i18n="@@localePortuguese">Português</option>
      </select>
    </label>
  `
})
export class LocaleSelectorComponent {
  currentLocale: SupportedLocale;
  readonly ariaLabel = $localize`:@@languageSelectorAriaLabel:Seleccionar idioma`;

  constructor(
    private readonly localeService: LocaleService,
    private readonly authService: AuthService
  ) {
    this.currentLocale = this.localeService.getLocale();
  }

  async changeLocale(locale: SupportedLocale): Promise<void> {
    this.currentLocale = locale;
    if (this.authService.user()) {
      await this.authService.updatePreferences({ locale }).catch(() => undefined);
    }
    this.localeService.setLocale(locale);
  }
}
