import { CommonModule } from "@angular/common";
import { Component, ElementRef, HostListener, Input, OnDestroy, ViewChild, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { GlobalSearchResult, GlobalSearchResponse } from "../assistant/assistant.models";
import { AssistantService } from "../assistant/assistant.service";
import { ProductAnalyticsService } from "../assistant/product-analytics.service";
import { OrganizationService } from "../organizations/organization.service";
import { Permission } from "../organizations/organization.models";
import { catalogStatusLabel, clientStatusLabel, eventStatusLabel, quotationStatusLabel } from "../i18n/display-labels";

interface CommandItem {
  id: string;
  label: string;
  help: string;
  route: string;
  icon: string;
  permission?: Permission;
}

@Component({
  selector: "kaklen-command-palette",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <button #trigger type="button" class="command-trigger secondary" (click)="open()" aria-haspopup="dialog" aria-keyshortcuts="Meta+K Control+K" [attr.aria-expanded]="visible()">
      <span class="command-trigger-icon" aria-hidden="true">⌕</span><span i18n="@@quickSearchLabel">Buscar o ir a...</span>
    </button>

    <div class="command-backdrop" *ngIf="visible()" (mousedown)="close(true)">
      <section #dialog class="command-palette assisted-command-palette" role="dialog" aria-modal="true" aria-labelledby="command-title" (mousedown)="$event.stopPropagation()">
        <header>
          <div><p class="eyebrow" i18n="@@commandPaletteEyebrow">Centro de acciones</p><h2 id="command-title" i18n="@@commandPaletteTitle">¿Qué necesitas hacer?</h2></div>
          <button type="button" class="icon-button" (click)="close(true)" aria-label="Cerrar" i18n-aria-label="@@closeButton">×</button>
        </header>
        <label class="command-search">
          <span class="sr-only" i18n="@@globalSearchLabel">Buscar clientes, catálogo, cotizaciones y eventos</span>
          <input #searchInput type="search" [(ngModel)]="query" (ngModelChange)="queueSearch($event)" (keydown)="handleListKeyboard($event)" placeholder="Buscar o escribir una acción" i18n-placeholder="@@commandSearchPlaceholder" autocomplete="off" />
          <kbd>⌘ K</kbd>
        </label>
        <p class="command-search-status" aria-live="polite">
          <span *ngIf="searching()" i18n="@@searchingLabel">Buscando...</span>
          <span *ngIf="!searching() && query.trim().length === 1" i18n="@@searchMinimumHelp">Escribe al menos 2 caracteres.</span>
          <span *ngIf="searchError()">{{ searchError() }}</span>
        </p>

        <div class="command-scroll" (keydown)="handleListKeyboard($event)">
          <ng-container *ngIf="query.trim().length < 2; else searchResults">
            <section *ngIf="recentItems().length" class="command-group"><h3 i18n="@@recentActionsTitle">Recientes</h3><button *ngFor="let item of recentItems()" type="button" class="command-option" [class.active]="isActive(item.id)" (click)="run(item)"><span aria-hidden="true">{{ item.icon }}</span><span><strong>{{ item.label }}</strong><small>{{ item.help }}</small></span></button></section>
            <section class="command-group"><h3 i18n="@@commandActionsTitle">Crear y gestionar</h3><button *ngFor="let item of actionItems()" type="button" class="command-option" [class.active]="isActive(item.id)" (click)="run(item)"><span aria-hidden="true">{{ item.icon }}</span><span><strong>{{ item.label }}</strong><small>{{ item.help }}</small></span></button></section>
            <section class="command-group"><h3 i18n="@@commandNavigationTitle">Navegación</h3><button *ngFor="let item of navigationItems()" type="button" class="command-option" [class.active]="isActive(item.id)" (click)="run(item)"><span aria-hidden="true">{{ item.icon }}</span><span><strong>{{ item.label }}</strong><small>{{ item.help }}</small></span></button></section>
          </ng-container>
          <ng-template #searchResults>
            <ng-container *ngIf="results() as response">
              <section class="command-group" *ngFor="let group of resultGroups(response)">
                <h3>{{ group.label }}</h3>
                <button *ngFor="let result of group.items" type="button" class="command-option search-result" [class.active]="isActive('result:' + result.id)" (click)="openResult(result)"><span aria-hidden="true">{{ resultIcon(result.type) }}</span><span><strong><mark>{{ result.title }}</mark></strong><small>{{ result.subtitle }}<span *ngIf="result.status"> · {{ resultStatus(result) }}</span></small></span></button>
              </section>
              <p class="command-empty" *ngIf="resultCount(response) === 0 && !searching()"><strong i18n="@@noSearchResultsTitle">No encontramos coincidencias.</strong><span i18n="@@noSearchResultsHelp">Prueba con un nombre, código o número diferente.</span></p>
            </ng-container>
          </ng-template>
        </div>
        <footer><span><kbd>↑</kbd><kbd>↓</kbd> <span i18n="@@commandNavigateHelp">para navegar</span></span><span><kbd>Enter</kbd> <span i18n="@@commandOpenHelp">para abrir</span></span><span><kbd>Esc</kbd> <span i18n="@@commandCloseHelp">para cerrar</span></span></footer>
      </section>
    </div>
  `
})
export class CommandPaletteComponent implements OnDestroy {
  @Input() organizationId: string | null = null;
  @ViewChild("trigger") private trigger?: ElementRef<HTMLButtonElement>;
  @ViewChild("dialog") private dialog?: ElementRef<HTMLElement>;
  @ViewChild("searchInput") private searchInput?: ElementRef<HTMLInputElement>;
  readonly visible = signal(false);
  readonly searching = signal(false);
  readonly searchError = signal("");
  readonly results = signal<GlobalSearchResponse | null>(null);
  readonly activeIndex = signal(0);
  readonly recentIds = signal<string[]>(this.readHistory());
  query = "";
  private searchTimer: number | null = null;

  constructor(
    private readonly organizationService: OrganizationService,
    private readonly assistantService: AssistantService,
    private readonly analytics: ProductAnalyticsService,
    private readonly router: Router
  ) {}

  @HostListener("document:keydown", ["$event"])
  handleKeyboard(event: KeyboardEvent): void {
    if (event.repeat) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      this.visible() ? this.close(true) : this.open();
      return;
    }
    if (event.key === "Escape" && this.visible()) {
      event.preventDefault();
      this.close(true);
    } else if (event.key === "Tab" && this.visible()) {
      this.trapFocus(event);
    }
  }

  open(): void {
    this.visible.set(true);
    this.activeIndex.set(0);
    this.analytics.track("command_palette_opened", { flow: "command_palette", source: "navigation" });
    window.setTimeout(() => this.searchInput?.nativeElement.focus(), 0);
  }

  close(returnFocus = false): void {
    this.visible.set(false);
    this.query = "";
    this.results.set(null);
    this.clearSearchTimer();
    if (returnFocus) window.setTimeout(() => this.trigger?.nativeElement.focus(), 0);
  }

  queueSearch(value: string): void {
    this.query = value;
    this.activeIndex.set(0);
    this.clearSearchTimer();
    if (value.trim().length < 2 || !this.organizationId) {
      this.results.set(null);
      this.searching.set(false);
      return;
    }
    this.searching.set(true);
    this.searchTimer = window.setTimeout(() => void this.search(value), 250);
  }

  handleListKeyboard(event: KeyboardEvent): void {
    const count = this.selectableIds().length;
    if (event.key === "ArrowDown" && count) {
      event.preventDefault();
      this.activeIndex.update((index) => (index + 1) % count);
    } else if (event.key === "ArrowUp" && count) {
      event.preventDefault();
      this.activeIndex.update((index) => (index - 1 + count) % count);
    } else if (event.key === "Enter" && count) {
      event.preventDefault();
      this.activateCurrent();
    }
  }

  actionItems(): CommandItem[] {
    const id = this.organizationId;
    if (!id) return [];
    return [
      this.command("create-client", $localize`:@@newClientButton:Nuevo cliente`, $localize`:@@newClientHelp:Registra una persona o empresa`, `/organizations/${id}/clients/new`, "+", "clients.create"),
      this.command("create-catalog", $localize`:@@addCatalogItemButton:Agregar producto o servicio`, $localize`:@@addCatalogItemHelp:Completa tu catálogo comercial`, `/organizations/${id}/catalog/new`, "+", "catalog.create"),
      this.command("create-quotation", $localize`:@@newQuotationButton:Nueva cotización`, $localize`:@@newQuotationHelp:Prepara una propuesta comercial`, `/organizations/${id}/quotations/new`, "+", "quotations.create"),
      this.command("create-event", $localize`:@@newEventButton:Nuevo evento`, $localize`:@@newEventHelp:Coordina fechas, tareas y recursos`, `/organizations/${id}/events/new`, "+", "events.create"),
      this.command("invite-member", $localize`:@@inviteUserButton:Invitar miembro`, $localize`:@@inviteUserHelp:Suma a alguien de tu equipo`, `/organizations/${id}/members`, "+", "organization.members.invite"),
      this.command("change-organization", $localize`:@@changeOrganizationButton:Cambiar organización`, $localize`:@@organizationsCommandHelp:Cambiar espacio de trabajo`, "/organizations", "⌂")
    ].filter((item) => !item.permission || this.can(item.permission));
  }

  navigationItems(): CommandItem[] {
    const id = this.organizationId;
    if (!id) return [this.command("organizations", $localize`:@@navOrganizations:Organizaciones`, $localize`:@@organizationsCommandHelp:Cambiar espacio de trabajo`, "/organizations", "⌂")];
    return [
      this.command("home", $localize`:@@navHome:Inicio`, $localize`:@@dashboardEyebrow:Resumen de hoy`, `/organizations/${id}`, "⌂", "organization.read"),
      this.command("clients", $localize`:@@navClients:Clientes`, $localize`:@@clientsCommandHelp:Buscar personas y empresas`, `/organizations/${id}/clients`, "◎", "clients.read"),
      this.command("catalog", $localize`:@@navCatalog:Productos y servicios`, $localize`:@@catalogCommandHelp:Revisar catálogo y precios`, `/organizations/${id}/catalog`, "◇", "catalog.read"),
      this.command("quotations", $localize`:@@navQuotations:Cotizaciones`, $localize`:@@quotationsCommandHelp:Continuar propuestas comerciales`, `/organizations/${id}/quotations`, "▤", "quotations.read"),
      this.command("events", $localize`:@@navEvents:Eventos`, $localize`:@@eventsCommandHelp:Coordinar operaciones`, `/organizations/${id}/events`, "□", "events.read"),
      this.command("members", $localize`:@@navMembers:Miembros`, $localize`:@@membersCommandHelp:Gestionar equipo y roles`, `/organizations/${id}/members`, "♙", "organization.members.read"),
      this.command("settings", $localize`:@@navSettings:Configuración`, $localize`:@@settingsCommandHelp:Configurar tu organización`, `/organizations/${id}/settings`, "⚙", "organization.update")
    ].filter((item) => !item.permission || this.can(item.permission));
  }

  recentItems(): CommandItem[] {
    const available = [...this.actionItems(), ...this.navigationItems()];
    return this.recentIds().flatMap((id) => available.find((item) => item.id === id) ?? []);
  }

  resultGroups(response: GlobalSearchResponse): Array<{ label: string; items: GlobalSearchResult[] }> {
    return [
      { label: $localize`:@@navClients:Clientes`, items: response.groups.clients },
      { label: $localize`:@@navCatalog:Productos y servicios`, items: response.groups.catalogItems },
      { label: $localize`:@@navQuotations:Cotizaciones`, items: response.groups.quotations },
      { label: $localize`:@@navEvents:Eventos`, items: response.groups.events }
    ].filter((group) => group.items.length > 0);
  }

  resultCount(response: GlobalSearchResponse): number {
    return Object.values(response.groups).reduce((sum, items) => sum + items.length, 0);
  }

  resultIcon(type: GlobalSearchResult["type"]): string {
    return { client: "◎", catalog_item: "◇", quotation: "▤", event: "□" }[type];
  }

  resultStatus(result: GlobalSearchResult): string {
    if (result.type === "client") return clientStatusLabel(result.status as Parameters<typeof clientStatusLabel>[0]);
    if (result.type === "catalog_item") return catalogStatusLabel(result.status as Parameters<typeof catalogStatusLabel>[0]);
    if (result.type === "quotation") return quotationStatusLabel(result.status as Parameters<typeof quotationStatusLabel>[0]);
    return eventStatusLabel(result.status as Parameters<typeof eventStatusLabel>[0]);
  }

  isActive(id: string): boolean {
    return this.selectableIds()[this.activeIndex()] === id;
  }

  run(item: CommandItem): void {
    this.remember(item.id);
    this.close();
    void this.router.navigateByUrl(item.route);
  }

  openResult(result: GlobalSearchResult): void {
    this.close();
    void this.router.navigateByUrl(result.route);
  }

  can(permission: Permission): boolean {
    return this.organizationService.hasPermission(permission);
  }

  ngOnDestroy(): void {
    this.clearSearchTimer();
  }

  private async search(value: string): Promise<void> {
    const organizationId = this.organizationId;
    if (!organizationId || value.trim().length < 2) return;
    this.searchError.set("");
    try {
      const response = await this.assistantService.search(organizationId, value.trim());
      if (this.query.trim() === response.query) {
        this.results.set(response);
        this.analytics.track("global_search_used", { flow: "command_palette" });
      }
    } catch {
      this.searchError.set($localize`:@@globalSearchError:No pudimos completar la búsqueda. Intenta nuevamente.`);
    } finally {
      this.searching.set(false);
    }
  }

  private command(id: string, label: string, help: string, route: string, icon: string, permission?: Permission): CommandItem {
    return { id, label, help, route, icon, permission };
  }

  private selectableIds(): string[] {
    const response = this.results();
    if (this.query.trim().length >= 2 && response) {
      return this.resultGroups(response).flatMap((group) => group.items.map((item) => `result:${item.id}`));
    }
    return [...this.recentItems(), ...this.actionItems(), ...this.navigationItems()].map((item) => item.id);
  }

  private activateCurrent(): void {
    const id = this.selectableIds()[this.activeIndex()];
    if (!id) return;
    if (id.startsWith("result:")) {
      const resultId = id.slice(7);
      const response = this.results();
      const result = response ? Object.values(response.groups).flat().find((item) => item.id === resultId) : undefined;
      if (result) this.openResult(result);
      return;
    }
    const item = [...this.recentItems(), ...this.actionItems(), ...this.navigationItems()].find((candidate) => candidate.id === id);
    if (item) this.run(item);
  }

  private remember(id: string): void {
    const next = [id, ...this.recentIds().filter((item) => item !== id)].slice(0, 5);
    this.recentIds.set(next);
    localStorage.setItem("kaklen.commandHistory", JSON.stringify(next));
  }

  private readHistory(): string[] {
    try {
      const value = JSON.parse(localStorage.getItem("kaklen.commandHistory") ?? "[]") as unknown;
      return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 5) : [];
    } catch {
      return [];
    }
  }

  private clearSearchTimer(): void {
    if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
    this.searchTimer = null;
  }

  private trapFocus(event: KeyboardEvent): void {
    const elements = Array.from(this.dialog?.nativeElement.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') ?? []);
    if (elements.length === 0) return;
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
