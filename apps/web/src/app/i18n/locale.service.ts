import { Injectable, LOCALE_ID, inject, signal } from "@angular/core";

export type SupportedLocale = "es" | "en" | "pt-BR";

export interface LocaleOption {
  code: SupportedLocale;
  label: string;
  shortLabel: string;
}

const LOCALE_STORAGE_KEY = "kaklen.locale";
const DEFAULT_LOCALE: SupportedLocale = "es";
const SUPPORTED_LOCALES: readonly SupportedLocale[] = ["es", "en", "pt-BR"];
const LOCALE_OPTIONS: readonly LocaleOption[] = [
  { code: "es", label: "Español", shortLabel: "ES" },
  { code: "en", label: "English", shortLabel: "EN" },
  { code: "pt-BR", label: "Português", shortLabel: "PT" }
];

@Injectable({ providedIn: "root" })
export class LocaleService {
  readonly options = LOCALE_OPTIONS;
  readonly currentLocale = signal<SupportedLocale>(DEFAULT_LOCALE);
  private readonly runtimeLocale = inject(LOCALE_ID);

  constructor() {
    this.currentLocale.set(this.resolveInitialLocale());
  }

  getLocale(): SupportedLocale {
    return this.currentLocale();
  }

  applyUserLocale(locale: string | null | undefined): void {
    const nextLocale = this.normalize(locale);
    if (nextLocale) {
      this.persist(nextLocale);
      this.currentLocale.set(nextLocale);
    }
  }

  applyOrganizationDefault(locale: string | null | undefined): void {
    if (this.normalize(localStorage.getItem(LOCALE_STORAGE_KEY))) {
      return;
    }

    const nextLocale = this.normalize(locale);
    if (nextLocale) {
      this.currentLocale.set(nextLocale);
    }
  }

  setLocale(locale: SupportedLocale, reload = true): void {
    this.persist(locale);
    this.currentLocale.set(locale);

    if (reload) {
      window.location.reload();
    }
  }

  normalize(locale: string | null | undefined): SupportedLocale | null {
    if (!locale) {
      return null;
    }

    const exactLocale = SUPPORTED_LOCALES.find((supportedLocale) => supportedLocale === locale);
    if (exactLocale) {
      return exactLocale;
    }

    const language = locale.split("-")[0];
    if (language === "pt") {
      return "pt-BR";
    }

    return SUPPORTED_LOCALES.find((supportedLocale) => supportedLocale === language) ?? null;
  }

  private resolveInitialLocale(): SupportedLocale {
    return (
      this.normalize(localStorage.getItem(LOCALE_STORAGE_KEY)) ??
      this.normalize(this.runtimeLocale) ??
      this.normalize(navigator.language) ??
      DEFAULT_LOCALE
    );
  }

  private persist(locale: SupportedLocale): void {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
}
