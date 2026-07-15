import { CommonModule } from "@angular/common";
import { Component, HostListener, Input, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { OrganizationService } from "../organizations/organization.service";
import { Permission } from "../organizations/organization.models";

@Component({
  selector: "kaklen-command-palette",
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <button
      type="button"
      class="command-trigger secondary"
      (click)="open()"
      aria-haspopup="dialog"
      aria-keyshortcuts="Meta+K Control+K"
      [attr.aria-expanded]="visible()"
    >
      <span class="command-trigger-icon" aria-hidden="true">⌕</span>
      <span i18n="@@quickSearchLabel">Buscar o ir a...</span>
    </button>

    <div class="command-backdrop" *ngIf="visible()" (click)="close()">
      <section
        class="command-palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-title"
        (click)="$event.stopPropagation()"
      >
        <header>
          <div>
            <p class="eyebrow" i18n="@@quickActionsEyebrow">Acciones rápidas</p>
            <h2 id="command-title" i18n="@@commandPaletteTitle">¿A dónde quieres ir?</h2>
          </div>
          <button type="button" class="icon-button" (click)="close()" aria-label="Cerrar" i18n-aria-label="@@closeButton">×</button>
        </header>

        <nav class="command-list" aria-label="Accesos rápidos" i18n-aria-label="@@quickLinksAriaLabel">
          <a routerLink="/organizations" (click)="close()">
            <span aria-hidden="true">⌂</span>
            <span><strong i18n="@@navOrganizations">Organizaciones</strong><small i18n="@@organizationsCommandHelp">Cambiar espacio de trabajo</small></span>
          </a>
          <a *ngIf="organizationId && can('clients.read')" [routerLink]="['/organizations', organizationId, 'clients']" (click)="close()">
            <span aria-hidden="true">◎</span>
            <span><strong i18n="@@navClients">Clientes</strong><small i18n="@@clientsCommandHelp">Buscar personas y empresas</small></span>
          </a>
          <a *ngIf="organizationId && can('catalog.read')" [routerLink]="['/organizations', organizationId, 'catalog']" (click)="close()">
            <span aria-hidden="true">◇</span>
            <span><strong i18n="@@navCatalog">Productos y servicios</strong><small i18n="@@catalogCommandHelp">Revisar catálogo y precios</small></span>
          </a>
          <a *ngIf="organizationId && can('quotations.read')" [routerLink]="['/organizations', organizationId, 'quotations']" (click)="close()">
            <span aria-hidden="true">▤</span>
            <span><strong i18n="@@navQuotations">Cotizaciones</strong><small i18n="@@quotationsCommandHelp">Continuar propuestas comerciales</small></span>
          </a>
          <a *ngIf="organizationId && can('events.read')" [routerLink]="['/organizations', organizationId, 'events']" (click)="close()">
            <span aria-hidden="true">□</span>
            <span><strong i18n="@@navEvents">Eventos</strong><small i18n="@@eventsCommandHelp">Coordinar operaciones</small></span>
          </a>
        </nav>
      </section>
    </div>
  `
})
export class CommandPaletteComponent {
  @Input() organizationId: string | null = null;
  readonly visible = signal(false);

  constructor(private readonly organizationService: OrganizationService) {}

  @HostListener("document:keydown", ["$event"])
  handleKeyboard(event: KeyboardEvent): void {
    if (event.repeat) {
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      this.visible.update((current) => !current);
      return;
    }
    if (event.key === "Escape" && this.visible()) {
      event.preventDefault();
      this.close();
    }
  }

  open(): void {
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  can(permission: Permission): boolean {
    return this.organizationService.hasPermission(permission);
  }
}
