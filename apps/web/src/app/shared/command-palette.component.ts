import { CommonModule } from "@angular/common";
import {
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  signal
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NavigationStart, Router } from "@angular/router";
import { Subscription } from "rxjs";
import { GlobalSearchResult, GlobalSearchResponse } from "../assistant/assistant.models";
import { AssistantService } from "../assistant/assistant.service";
import { ProductAnalyticsService } from "../assistant/product-analytics.service";
import { catalogStatusLabel, clientStatusLabel, eventStatusLabel, quotationStatusLabel } from "../i18n/display-labels";
import { Permission } from "../organizations/organization.models";
import { OrganizationService } from "../organizations/organization.service";
import { UiIconComponent, UiIconName } from "./ui-icon.component";

interface CommandItem {
  id: string;
  label: string;
  help: string;
  route: string;
  icon: UiIconName;
  aliases: readonly string[];
  permission?: Permission;
}

@Component({
  selector: "kaklen-command-palette",
  standalone: true,
  imports: [CommonModule, FormsModule, UiIconComponent],
  template: `
    <button #trigger type="button" class="command-trigger secondary" (click)="open()" aria-haspopup="dialog" aria-keyshortcuts="Meta+K Control+K" [attr.aria-expanded]="visible()">
      <kaklen-icon name="search" /><span i18n="@@quickSearchLabel">Buscar o ir a...</span>
    </button>

    <div class="command-backdrop" *ngIf="visible()" (mousedown)="close(true)">
      <section #dialog class="command-palette assisted-command-palette" role="dialog" aria-modal="true" aria-labelledby="command-title" (mousedown)="$event.stopPropagation()">
        <header>
          <div><p class="eyebrow" i18n="@@commandPaletteEyebrow">Centro de acciones</p><h2 id="command-title" i18n="@@commandPaletteTitle">¿Qué necesitas hacer?</h2></div>
          <button type="button" class="icon-button" (click)="close(true)" aria-label="Cerrar" i18n-aria-label="@@closeButton"><kaklen-icon name="x" /></button>
        </header>
        <label class="command-search">
          <span class="sr-only" i18n="@@globalSearchLabel">Buscar clientes, catálogo, cotizaciones y eventos</span>
          <input #searchInput type="search" [(ngModel)]="query" (ngModelChange)="queueSearch($event)" placeholder="Buscar o escribir una acción" i18n-placeholder="@@commandSearchPlaceholder" autocomplete="off" />
          <kbd>⌘ K</kbd>
        </label>
        <p class="command-search-status" aria-live="polite">
          <span *ngIf="searching()" i18n="@@searchingLabel">Buscando...</span>
          <span *ngIf="!searching() && query.trim().length === 1" i18n="@@searchMinimumHelp">Las acciones se filtran ahora. Escribe 2 caracteres para buscar también en tus datos.</span>
          <span *ngIf="searchError()">{{ searchError() }}</span>
        </p>

        <div class="command-scroll">
          <section *ngIf="recentItems().length" class="command-group">
            <h3 i18n="@@recentActionsTitle">Recientes</h3>
            <button *ngFor="let item of recentItems(); trackBy: trackCommand" type="button" class="command-option" [attr.data-command-id]="item.id" [class.active]="isActive(item.id)" (click)="run(item)">
              <kaklen-icon [name]="item.icon" /><span><strong>{{ item.label }}</strong><small>{{ item.help }}</small></span>
            </button>
          </section>
          <section *ngIf="filteredActionItems().length" class="command-group">
            <h3 i18n="@@commandActionsTitle">Crear y gestionar</h3>
            <button *ngFor="let item of filteredActionItems(); trackBy: trackCommand" type="button" class="command-option" [attr.data-command-id]="item.id" [class.active]="isActive(item.id)" (click)="run(item)">
              <kaklen-icon [name]="item.icon" /><span><strong>{{ item.label }}</strong><small>{{ item.help }}</small></span>
            </button>
          </section>
          <section *ngIf="filteredNavigationItems().length" class="command-group">
            <h3 i18n="@@commandNavigationTitle">Navegación</h3>
            <button *ngFor="let item of filteredNavigationItems(); trackBy: trackCommand" type="button" class="command-option" [attr.data-command-id]="item.id" [class.active]="isActive(item.id)" (click)="run(item)">
              <kaklen-icon [name]="item.icon" /><span><strong>{{ item.label }}</strong><small>{{ item.help }}</small></span>
            </button>
          </section>

          <ng-container *ngIf="query.trim().length >= 2 && results() as response">
            <section class="command-group" *ngFor="let group of resultGroups(response)">
              <h3>{{ group.label }}</h3>
              <button *ngFor="let result of group.items; trackBy: trackSearchResult" type="button" class="command-option search-result" [attr.data-command-id]="'result:' + result.id" [class.active]="isActive('result:' + result.id)" (click)="openResult(result)">
                <kaklen-icon [name]="resultIcon(result.type)" /><span><strong><mark>{{ result.title }}</mark></strong><small>{{ result.subtitle }}<span *ngIf="result.status"> · {{ resultStatus(result) }}</span></small></span>
              </button>
            </section>
          </ng-container>

          <p class="command-empty" *ngIf="showEmptyState()"><strong i18n="@@noSearchResultsTitle">No encontramos coincidencias.</strong><span i18n="@@noSearchResultsHelp">Prueba con un nombre, código, SKU, cliente o número diferente.</span></p>
        </div>
        <footer><span><kbd>↑</kbd><kbd>↓</kbd> <span i18n="@@commandNavigateHelp">para navegar</span></span><span><kbd>Enter</kbd> <span i18n="@@commandOpenHelp">para abrir</span></span><span><kbd>Esc</kbd> <span i18n="@@commandCloseHelp">para cerrar</span></span></footer>
      </section>
    </div>
  `
})
export class CommandPaletteComponent implements OnChanges, OnDestroy {
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
  private focusTimer: number | null = null;
  private searchTimer: number | null = null;
  private searchSequence = 0;
  private readonly routeSubscription: Subscription;

  constructor(
    private readonly organizationService: OrganizationService,
    private readonly assistantService: AssistantService,
    private readonly analytics: ProductAnalyticsService,
    private readonly router: Router
  ) {
    this.routeSubscription = router.events.subscribe((event) => {
      if (event instanceof NavigationStart && this.visible()) {
        this.close(false);
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["organizationId"] && !changes["organizationId"].firstChange && this.visible()) {
      this.close(false);
    }
  }

  @HostListener("document:keydown", ["$event"])
  handleKeyboard(event: KeyboardEvent): void {
    if (event.repeat) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      event.stopPropagation();
      this.visible() ? this.close(true) : this.open();
      return;
    }
    if (!this.visible()) return;

    if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", "Escape"].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (event.key === "Escape") {
      this.close(true);
    } else if (event.key === "Tab") {
      this.trapFocus(event);
    } else {
      this.handleListKeyboard(event);
    }
  }

  open(): void {
    if (this.visible()) return;
    this.visible.set(true);
    this.activeIndex.set(0);
    document.body.classList.add("command-palette-open");
    this.analytics.track("command_palette_opened", { flow: "command_palette", source: "navigation" });
    this.focusTimer = window.setTimeout(() => {
      this.focusTimer = null;
      const activeElement = document.activeElement;
      const dialog = this.dialog?.nativeElement;
      if (!this.visible() || (activeElement instanceof HTMLElement && dialog?.contains(activeElement))) {
        return;
      }
      this.searchInput?.nativeElement.focus();
    }, 0);
  }

  close(returnFocus = false): void {
    if (!this.visible()) return;
    this.visible.set(false);
    this.query = "";
    this.results.set(null);
    this.searchError.set("");
    this.searching.set(false);
    this.searchSequence += 1;
    this.clearFocusTimer();
    this.clearSearchTimer();
    document.body.classList.remove("command-palette-open");
    if (returnFocus) window.setTimeout(() => this.trigger?.nativeElement.focus(), 0);
  }

  queueSearch(value: string): void {
    this.query = value;
    this.activeIndex.set(0);
    this.searchError.set("");
    this.clearSearchTimer();
    this.searchSequence += 1;
    if (value.trim().length < 2 || !this.organizationId) {
      this.results.set(null);
      this.searching.set(false);
      return;
    }
    this.searching.set(true);
    const sequence = this.searchSequence;
    this.searchTimer = window.setTimeout(() => void this.search(value, sequence), 250);
  }

  handleListKeyboard(event: KeyboardEvent): void {
    const count = this.selectableIds().length;
    if (!count) return;
    if (event.key === "ArrowDown") {
      this.activeIndex.update((index) => (index + 1) % count);
      this.scrollActiveOptionIntoView();
    } else if (event.key === "ArrowUp") {
      this.activeIndex.update((index) => (index - 1 + count) % count);
      this.scrollActiveOptionIntoView();
    } else if (event.key === "Home") {
      this.activeIndex.set(0);
      this.scrollActiveOptionIntoView();
    } else if (event.key === "End") {
      this.activeIndex.set(count - 1);
      this.scrollActiveOptionIntoView();
    } else if (event.key === "Enter") {
      this.activateCurrent();
    }
  }

  actionItems(): CommandItem[] {
    const id = this.organizationId;
    if (!id) return [];
    return [
      this.command("create-client", $localize`:@@newClientButton:Nuevo cliente`, $localize`:@@newClientHelp:Registra una persona o empresa`, `/organizations/${id}/clients/new`, "plus", ["persona", "empresa", "crm"], "clients.create"),
      this.command("create-catalog", $localize`:@@addCatalogItemButton:Agregar producto o servicio`, $localize`:@@addCatalogItemHelp:Completa tu catálogo comercial`, `/organizations/${id}/catalog/new`, "plus", ["producto", "servicio", "sku", "catalogo"], "catalog.create"),
      this.command("create-quotation", $localize`:@@newQuotationButton:Nueva cotización`, $localize`:@@newQuotationHelp:Prepara una propuesta comercial`, `/organizations/${id}/quotations/new`, "plus", ["presupuesto", "propuesta"], "quotations.create"),
      this.command("create-event", $localize`:@@newEventButton:Nuevo evento`, $localize`:@@newEventHelp:Coordina fechas, tareas y recursos`, `/organizations/${id}/events/new`, "plus", ["calendario", "agenda"], "events.create"),
      this.command("invite-member", $localize`:@@inviteUserButton:Invitar miembro`, $localize`:@@inviteUserHelp:Suma a alguien de tu equipo`, `/organizations/${id}/members`, "users", ["usuario", "equipo", "rol"], "organization.members.invite"),
      this.command("change-organization", $localize`:@@changeOrganizationButton:Cambiar organización`, $localize`:@@organizationsCommandHelp:Cambiar espacio de trabajo`, "/organizations", "building", ["workspace", "empresa"])
    ].filter((item) => !item.permission || this.can(item.permission));
  }

  navigationItems(): CommandItem[] {
    const id = this.organizationId;
    if (!id) return [this.command("organizations", $localize`:@@navOrganizations:Organizaciones`, $localize`:@@organizationsCommandHelp:Cambiar espacio de trabajo`, "/organizations", "building", ["workspace", "empresa"])];
    return [
      this.command("home", $localize`:@@navHome:Inicio`, $localize`:@@dashboardEyebrow:Resumen de hoy`, `/organizations/${id}`, "home", ["dashboard", "resumen"], "organization.read"),
      this.command("clients", $localize`:@@navClients:Clientes`, $localize`:@@clientsCommandHelp:Buscar personas y empresas`, `/organizations/${id}/clients`, "users", ["crm", "personas", "empresas"], "clients.read"),
      this.command("catalog", $localize`:@@navCatalog:Productos y servicios`, $localize`:@@catalogCommandHelp:Revisar catálogo y precios`, `/organizations/${id}/catalog`, "package", ["catalogo", "sku", "precios"], "catalog.read"),
      this.command("quotations", $localize`:@@navQuotations:Cotizaciones`, $localize`:@@quotationsCommandHelp:Continuar propuestas comerciales`, `/organizations/${id}/quotations`, "file-text", ["presupuestos", "propuestas"], "quotations.read"),
      this.command("events", $localize`:@@navEvents:Eventos`, $localize`:@@eventsCommandHelp:Coordinar operaciones`, `/organizations/${id}/events`, "calendar", ["agenda", "calendario"], "events.read"),
      this.command("members", $localize`:@@navMembers:Miembros`, $localize`:@@membersCommandHelp:Gestionar equipo y roles`, `/organizations/${id}/members`, "users", ["usuarios", "equipo", "roles"], "organization.members.read"),
      this.command("settings", $localize`:@@navSettings:Configuración`, $localize`:@@settingsCommandHelp:Configurar tu organización`, `/organizations/${id}/settings`, "settings", ["ajustes", "preferencias"], "organization.update")
    ].filter((item) => !item.permission || this.can(item.permission));
  }

  recentItems(): CommandItem[] {
    if (this.query.trim()) return [];
    const available = [...this.actionItems(), ...this.navigationItems()];
    return this.recentIds().flatMap((id) => available.find((item) => item.id === id) ?? []);
  }

  filteredActionItems(): CommandItem[] {
    return this.filterLocalItems(this.actionItems());
  }

  filteredNavigationItems(): CommandItem[] {
    return this.filterLocalItems(this.navigationItems());
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

  resultIcon(type: GlobalSearchResult["type"]): UiIconName {
    return { client: "users", catalog_item: "package", quotation: "file-text", event: "calendar" }[type] as UiIconName;
  }

  resultStatus(result: GlobalSearchResult): string {
    if (result.type === "client") return clientStatusLabel(result.status as Parameters<typeof clientStatusLabel>[0]);
    if (result.type === "catalog_item") return catalogStatusLabel(result.status as Parameters<typeof catalogStatusLabel>[0]);
    if (result.type === "quotation") return quotationStatusLabel(result.status as Parameters<typeof quotationStatusLabel>[0]);
    return eventStatusLabel(result.status as Parameters<typeof eventStatusLabel>[0]);
  }

  showEmptyState(): boolean {
    if (!this.query.trim() || this.searching()) return false;
    const localCount = this.filteredActionItems().length + this.filteredNavigationItems().length;
    const remoteCount = this.results() ? this.resultCount(this.results() as GlobalSearchResponse) : 0;
    return localCount + remoteCount === 0 && this.query.trim().length >= 2;
  }

  isActive(id: string): boolean {
    return this.selectableIds()[this.activeIndex()] === id;
  }

  trackCommand(_index: number, item: CommandItem): string {
    return item.id;
  }

  trackSearchResult(_index: number, result: GlobalSearchResult): string {
    return result.id;
  }

  run(item: CommandItem): void {
    this.remember(item.id);
    this.analytics.track("command_action_executed", { flow: "command_palette", action: item.id });
    this.close(false);
    void this.router.navigateByUrl(item.route);
  }

  openResult(result: GlobalSearchResult): void {
    this.analytics.track("command_search_result_opened", { flow: "command_palette", resultType: result.type });
    this.close(false);
    void this.router.navigateByUrl(result.route);
  }

  can(permission: Permission): boolean {
    return this.organizationService.hasPermission(permission);
  }

  ngOnDestroy(): void {
    this.clearFocusTimer();
    this.clearSearchTimer();
    this.routeSubscription.unsubscribe();
    document.body.classList.remove("command-palette-open");
  }

  private async search(value: string, sequence: number): Promise<void> {
    const organizationId = this.organizationId;
    const query = value.trim();
    if (!organizationId || query.length < 2) return;
    try {
      const response = await this.assistantService.search(organizationId, query);
      if (sequence === this.searchSequence && this.normalize(this.query) === this.normalize(response.query)) {
        this.results.set(response);
        this.activeIndex.set(0);
        this.analytics.track("global_search_used", { flow: "command_palette" });
      }
    } catch {
      if (sequence === this.searchSequence) {
        this.searchError.set($localize`:@@globalSearchError:No pudimos completar la búsqueda. Intenta nuevamente.`);
      }
    } finally {
      if (sequence === this.searchSequence) {
        this.searching.set(false);
      }
    }
  }

  private command(
    id: string,
    label: string,
    help: string,
    route: string,
    icon: UiIconName,
    aliases: readonly string[],
    permission?: Permission
  ): CommandItem {
    return { id, label, help, route, icon, aliases, permission };
  }

  private filterLocalItems(items: CommandItem[]): CommandItem[] {
    const query = this.normalize(this.query);
    if (!query) {
      const recent = new Set(this.recentItems().map((item) => item.id));
      return items.filter((item) => !recent.has(item.id));
    }
    return items.filter((item) => this.normalize([item.label, item.help, item.id, ...item.aliases].join(" ")).includes(query));
  }

  private normalize(value: string): string {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
  }

  private selectableIds(): string[] {
    const local = [...this.recentItems(), ...this.filteredActionItems(), ...this.filteredNavigationItems()].map((item) => item.id);
    const response = this.results();
    const remote = this.query.trim().length >= 2 && response
      ? this.resultGroups(response).flatMap((group) => group.items.map((item) => `result:${item.id}`))
      : [];
    return [...new Set([...local, ...remote])];
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
    const item = [...this.recentItems(), ...this.filteredActionItems(), ...this.filteredNavigationItems()].find((candidate) => candidate.id === id);
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

  private clearFocusTimer(): void {
    if (this.focusTimer !== null) window.clearTimeout(this.focusTimer);
    this.focusTimer = null;
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

  private scrollActiveOptionIntoView(): void {
    queueMicrotask(() => {
      const activeId = this.selectableIds()[this.activeIndex()];
      const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(activeId ?? "") : activeId?.replace(/["\\]/g, "\\$&");
      this.dialog?.nativeElement.querySelector<HTMLElement>(`[data-command-id="${escaped}"]`)?.scrollIntoView({ block: "nearest" });
    });
  }
}
