import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter, Routes, RouterOutlet, RouterLink, Router, RouterLinkActive } from "@angular/router";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import {
  Component,
  DEFAULT_CURRENCY_CODE,
  ElementRef,
  HostListener,
  LOCALE_ID,
  OnDestroy,
  ViewChild,
  signal
} from "@angular/core";
import { CommonModule, registerLocaleData } from "@angular/common";
import localeEs from "@angular/common/locales/es";
import localeEn from "@angular/common/locales/en";
import localePtBr from "@angular/common/locales/pt";
import { authGuard } from "./app/auth/auth.guard";
import { authInterceptor } from "./app/auth/auth.interceptor";
import { DashboardComponent } from "./app/pages/dashboard.component";
import { LoginComponent } from "./app/pages/login.component";
import { RegisterComponent } from "./app/pages/register.component";
import { ForgotPasswordComponent } from "./app/pages/forgot-password.component";
import { ResetPasswordComponent } from "./app/pages/reset-password.component";
import { AcceptInvitationComponent } from "./app/pages/accept-invitation.component";
import { OrganizationMembersComponent } from "./app/pages/organization-members.component";
import { OrganizationNewComponent } from "./app/pages/organization-new.component";
import { OrganizationSettingsComponent } from "./app/pages/organization-settings.component";
import { OrganizationsListComponent } from "./app/pages/organizations-list.component";
import { ClientDetailComponent } from "./app/pages/client-detail.component";
import { ClientFormComponent } from "./app/pages/client-form.component";
import { ClientsListComponent } from "./app/pages/clients-list.component";
import { CatalogDetailComponent } from "./app/pages/catalog-detail.component";
import { CatalogFormComponent } from "./app/pages/catalog-form.component";
import { CatalogListComponent } from "./app/pages/catalog-list.component";
import { QuotationDetailComponent } from "./app/pages/quotation-detail.component";
import { QuotationFormComponent } from "./app/pages/quotation-form.component";
import { QuotationListComponent } from "./app/pages/quotation-list.component";
import { EventCalendarComponent } from "./app/pages/event-calendar.component";
import { EventDetailComponent } from "./app/pages/event-detail.component";
import { EventFormComponent } from "./app/pages/event-form.component";
import { EventListComponent } from "./app/pages/event-list.component";
import { LocaleSelectorComponent } from "./app/i18n/locale-selector.component";
import { SupportedLocale } from "./app/i18n/locale.service";
import { AuthService } from "./app/auth/auth.service";
import { OrganizationService } from "./app/organizations/organization.service";
import { Permission } from "./app/organizations/organization.models";
import { NotificationContainerComponent } from "./app/shared/notifications/notification-container.component";
import { BrandLogoComponent } from "./app/shared/brand-logo.component";
import { CommandPaletteComponent } from "./app/shared/command-palette.component";

registerLocaleData(localeEs, "es");
registerLocaleData(localeEn, "en");
registerLocaleData(localePtBr, "pt-BR");

const supportedLocales: readonly SupportedLocale[] = ["es", "en", "pt-BR"];

function resolveBootstrapLocale(): SupportedLocale {
  const storedLocale = localStorage.getItem("kaklen.locale");
  const exactStoredLocale = supportedLocales.find((locale) => locale === storedLocale);
  if (exactStoredLocale) {
    return exactStoredLocale;
  }

  const browserLanguage = navigator.language;
  const exactBrowserLocale = supportedLocales.find((locale) => locale === browserLanguage);
  if (exactBrowserLocale) {
    return exactBrowserLocale;
  }

  return browserLanguage.startsWith("pt") ? "pt-BR" : browserLanguage.startsWith("en") ? "en" : "es";
}

const routes: Routes = [
  { path: "login", component: LoginComponent },
  { path: "register", component: RegisterComponent },
  { path: "forgot-password", component: ForgotPasswordComponent },
  { path: "reset-password", component: ResetPasswordComponent },
  { path: "dashboard", component: DashboardComponent, canActivate: [authGuard] },
  { path: "organizations", component: OrganizationsListComponent, canActivate: [authGuard] },
  { path: "organizations/new", component: OrganizationNewComponent, canActivate: [authGuard] },
  { path: "organizations/:organizationId", component: DashboardComponent, canActivate: [authGuard] },
  {
    path: "organizations/:organizationId/settings",
    component: OrganizationSettingsComponent,
    canActivate: [authGuard]
  },
  {
    path: "organizations/:organizationId/members",
    component: OrganizationMembersComponent,
    canActivate: [authGuard]
  },
  {
    path: "organizations/:organizationId/clients",
    component: ClientsListComponent,
    canActivate: [authGuard]
  },
  {
    path: "organizations/:organizationId/clients/new",
    component: ClientFormComponent,
    canActivate: [authGuard]
  },
  {
    path: "organizations/:organizationId/clients/:clientId",
    component: ClientDetailComponent,
    canActivate: [authGuard]
  },
  {
    path: "organizations/:organizationId/clients/:clientId/edit",
    component: ClientFormComponent,
    canActivate: [authGuard]
  },
  {
    path: "organizations/:organizationId/catalog",
    component: CatalogListComponent,
    canActivate: [authGuard]
  },
  {
    path: "organizations/:organizationId/catalog/new",
    component: CatalogFormComponent,
    canActivate: [authGuard]
  },
  {
    path: "organizations/:organizationId/catalog/:itemId",
    component: CatalogDetailComponent,
    canActivate: [authGuard]
  },
  {
    path: "organizations/:organizationId/catalog/:itemId/edit",
    component: CatalogFormComponent,
    canActivate: [authGuard]
  },
  {
    path: "organizations/:organizationId/quotations",
    component: QuotationListComponent,
    canActivate: [authGuard]
  },
  {
    path: "organizations/:organizationId/quotations/new",
    component: QuotationFormComponent,
    canActivate: [authGuard]
  },
  {
    path: "organizations/:organizationId/quotations/:quotationId",
    component: QuotationDetailComponent,
    canActivate: [authGuard]
  },
  {
    path: "organizations/:organizationId/quotations/:quotationId/edit",
    component: QuotationFormComponent,
    canActivate: [authGuard]
  },
  {
    path: "organizations/:organizationId/events",
    component: EventListComponent,
    canActivate: [authGuard]
  },
  {
    path: "organizations/:organizationId/events/new",
    component: EventFormComponent,
    canActivate: [authGuard]
  },
  {
    path: "organizations/:organizationId/events/calendar",
    component: EventCalendarComponent,
    canActivate: [authGuard]
  },
  {
    path: "organizations/:organizationId/events/:eventId",
    component: EventDetailComponent,
    canActivate: [authGuard]
  },
  {
    path: "organizations/:organizationId/events/:eventId/edit",
    component: EventFormComponent,
    canActivate: [authGuard]
  },
  { path: "accept-invitation", component: AcceptInvitationComponent, canActivate: [authGuard] },
  { path: "", pathMatch: "full", redirectTo: "login" },
  { path: "**", redirectTo: "login" }
];

@Component({
  selector: "kaklen-root",
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LocaleSelectorComponent,
    NotificationContainerComponent,
    BrandLogoComponent,
    CommandPaletteComponent
  ],
  template: `
    <header class="topbar" [class.public-topbar]="!isAuthenticated()">
      <div class="topbar-left">
        <button
          *ngIf="isAuthenticated() && activeOrganizationId()"
          #mobileMenuButton
          type="button"
          class="icon-button mobile-menu-button"
          (click)="openMenu()"
          [attr.aria-expanded]="menuOpen()"
          aria-controls="authenticated-navigation"
          aria-label="Abrir navegación"
          i18n-aria-label="@@openNavigationLabel"
        >
          ☰
        </button>
        <a class="brand" [routerLink]="isAuthenticated() ? '/dashboard' : '/login'" aria-label="Kaklen">
          <kaklen-brand-logo />
        </a>
        <div class="organization-context" *ngIf="isAuthenticated() && activeOrganizationName()">
          <small i18n="@@activeOrganizationLabel">Organización activa</small>
          <strong>{{ activeOrganizationName() }}</strong>
        </div>
      </div>

      <nav *ngIf="!isAuthenticated()" class="public-navigation" aria-label="Principal" i18n-aria-label="@@primaryNavigationAriaLabel">
        <a routerLink="/login" i18n="@@navLogin">Iniciar sesión</a>
        <a routerLink="/register" i18n="@@navRegister">Registro</a>
      </nav>

      <div *ngIf="isAuthenticated()" class="authenticated-actions">
        <kaklen-command-palette #commandPalette [organizationId]="activeOrganizationId()" />
        <button
          #mobileProfileButton
          type="button"
          class="icon-button mobile-profile-button"
          (click)="toggleProfile()"
          [attr.aria-expanded]="profileOpen()"
          aria-controls="account-menu"
          aria-label="Abrir perfil"
          i18n-aria-label="@@openProfileLabel"
        >
          <span class="user-avatar" *ngIf="auth.user() as user" aria-hidden="true">{{ user.firstName.charAt(0) }}{{ user.lastName.charAt(0) }}</span>
        </button>
        <nav
          #profileMenu
          id="account-menu"
          class="topbar-actions account-menu"
          [class.open]="profileOpen()"
          aria-label="Cuenta"
          i18n-aria-label="@@accountNavigationAriaLabel"
        >
          <div class="mobile-account-summary" *ngIf="auth.user() as user">
            <span class="user-avatar" aria-hidden="true">{{ user.firstName.charAt(0) }}{{ user.lastName.charAt(0) }}</span>
            <span><strong>{{ user.firstName }} {{ user.lastName }}</strong><small>{{ activeOrganizationName() }}</small></span>
          </div>
          <button type="button" class="secondary mobile-account-action" (click)="openCommandPalette()" i18n="@@quickSearchLabel">Buscar o ir a...</button>
          <a class="icon-link organizations-link" routerLink="/organizations" aria-label="Organizaciones" i18n-aria-label="@@navOrganizations" (click)="closeProfile()">
            <span aria-hidden="true">⌂</span><span class="mobile-account-action" i18n="@@navOrganizations">Organizaciones</span>
          </a>
          <a
            *ngIf="activeOrganizationId() && can('organization.update')"
            class="secondary-link mobile-account-action"
            [routerLink]="['/organizations', activeOrganizationId(), 'settings']"
            (click)="closeProfile()"
            i18n="@@navSettings"
          >Configuración</a>
          <span class="user-chip" *ngIf="auth.user() as user" [title]="user.firstName + ' ' + user.lastName">
            <span class="user-avatar" aria-hidden="true">{{ user.firstName.charAt(0) }}{{ user.lastName.charAt(0) }}</span>
            <span class="user-name">{{ user.firstName }} {{ user.lastName }}</span>
          </span>
          <kaklen-locale-selector />
          <button type="button" class="secondary compact-button" (click)="logout()" i18n="@@logoutButton">Salir</button>
        </nav>
      </div>
      <kaklen-locale-selector *ngIf="!isAuthenticated()" />
    </header>

    <div class="app-layout" [class.with-navigation]="isAuthenticated() && activeOrganizationId()">
      <button
        *ngIf="menuOpen()"
        type="button"
        class="drawer-overlay"
        (click)="closeMenu(true)"
        aria-label="Cerrar navegación"
        i18n-aria-label="@@closeNavigationLabel"
      ></button>
      <aside
        #mobileDrawer
        id="authenticated-navigation"
        class="app-sidebar"
        *ngIf="isAuthenticated() && activeOrganizationId() as organizationId"
        [class.open]="menuOpen()"
        [attr.aria-modal]="menuOpen() ? 'true' : null"
        [attr.role]="menuOpen() ? 'dialog' : null"
        aria-label="Navegación de organización"
        i18n-aria-label="@@organizationNavigationAriaLabel"
      >
        <div class="sidebar-heading">
          <span i18n="@@workspaceNavigationLabel">Espacio de trabajo</span>
        </div>
        <nav aria-label="Navegación de organización" i18n-aria-label="@@organizationNavigationAriaLabel">
          <a [routerLink]="['/organizations', organizationId]" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page" (click)="closeMenu()"><span aria-hidden="true">⌂</span><span i18n="@@navHome">Inicio</span></a>
          <a *ngIf="can('clients.read')" [routerLink]="['/organizations', organizationId, 'clients']" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: false }" ariaCurrentWhenActive="page" (click)="closeMenu()"><span aria-hidden="true">◎</span><span i18n="@@navClients">Clientes</span></a>
          <a *ngIf="can('catalog.read')" [routerLink]="['/organizations', organizationId, 'catalog']" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: false }" ariaCurrentWhenActive="page" (click)="closeMenu()"><span aria-hidden="true">◇</span><span i18n="@@navCatalog">Productos y servicios</span></a>
          <a *ngIf="can('quotations.read')" [routerLink]="['/organizations', organizationId, 'quotations']" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: false }" ariaCurrentWhenActive="page" (click)="closeMenu()"><span aria-hidden="true">▤</span><span i18n="@@navQuotations">Cotizaciones</span></a>
          <a *ngIf="can('events.read')" [routerLink]="['/organizations', organizationId, 'events']" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: false }" ariaCurrentWhenActive="page" (click)="closeMenu()"><span aria-hidden="true">□</span><span i18n="@@navEvents">Eventos</span></a>
          <span class="sidebar-divider" aria-hidden="true"></span>
          <a *ngIf="can('organization.members.read')" [routerLink]="['/organizations', organizationId, 'members']" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: false }" ariaCurrentWhenActive="page" (click)="closeMenu()"><span aria-hidden="true">♙</span><span i18n="@@navMembers">Miembros</span></a>
          <a class="sidebar-settings-link" *ngIf="can('organization.update')" [routerLink]="['/organizations', organizationId, 'settings']" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: false }" ariaCurrentWhenActive="page" (click)="closeMenu()"><span aria-hidden="true">⚙</span><span i18n="@@navSettings">Configuración</span></a>
        </nav>
        <div class="sidebar-help">
          <span class="help-icon" aria-hidden="true">?</span>
          <span><strong i18n="@@needHelpTitle">¿Necesitas ayuda?</strong><small i18n="@@helpComingSoon">Centro de ayuda próximamente</small></span>
        </div>
      </aside>

      <main class="app-content">
        <router-outlet />
      </main>
    </div>
    <kaklen-notification-container />
  `
})
class AppComponent implements OnDestroy {
  @ViewChild("mobileMenuButton") private mobileMenuButton?: ElementRef<HTMLButtonElement>;
  @ViewChild("mobileDrawer") private mobileDrawer?: ElementRef<HTMLElement>;
  @ViewChild("mobileProfileButton") private mobileProfileButton?: ElementRef<HTMLButtonElement>;
  @ViewChild("profileMenu") private profileMenu?: ElementRef<HTMLElement>;
  @ViewChild("commandPalette") private commandPalette?: CommandPaletteComponent;
  readonly menuOpen = signal(false);
  readonly profileOpen = signal(false);

  constructor(
    readonly auth: AuthService,
    private readonly organizationService: OrganizationService,
    private readonly router: Router
  ) {}

  isAuthenticated(): boolean {
    return this.auth.user() !== null;
  }

  activeOrganizationId(): string | null {
    return this.organizationService.activeOrganizationId();
  }

  activeOrganizationName(): string {
    return this.organizationService.activeOrganization()?.name ?? "";
  }

  can(permission: Permission): boolean {
    return this.organizationService.hasPermission(permission);
  }

  openMenu(): void {
    this.closeProfile();
    this.menuOpen.set(true);
    document.body.classList.add("navigation-drawer-open");
    window.setTimeout(() => this.focusFirst(this.mobileDrawer?.nativeElement), 0);
  }

  closeMenu(returnFocus = false): void {
    this.menuOpen.set(false);
    document.body.classList.remove("navigation-drawer-open");
    if (returnFocus) {
      window.setTimeout(() => this.mobileMenuButton?.nativeElement.focus(), 0);
    }
  }

  toggleProfile(): void {
    const next = !this.profileOpen();
    this.closeMenu();
    this.profileOpen.set(next);
    if (next) {
      window.setTimeout(() => this.focusFirst(this.profileMenu?.nativeElement), 0);
    }
  }

  closeProfile(returnFocus = false): void {
    this.profileOpen.set(false);
    if (returnFocus) {
      window.setTimeout(() => this.mobileProfileButton?.nativeElement.focus(), 0);
    }
  }

  openCommandPalette(): void {
    this.closeProfile();
    this.commandPalette?.open();
  }

  @HostListener("document:keydown", ["$event"])
  handleDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      if (this.menuOpen()) {
        event.preventDefault();
        this.closeMenu(true);
      } else if (this.profileOpen()) {
        event.preventDefault();
        this.closeProfile(true);
      }
      return;
    }

    if (event.key === "Tab" && this.menuOpen()) {
      this.trapFocus(event, this.mobileDrawer?.nativeElement);
    } else if (event.key === "Tab" && this.profileOpen()) {
      this.trapFocus(event, this.profileMenu?.nativeElement);
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.closeMenu();
    this.closeProfile();
    await this.router.navigateByUrl("/login", { replaceUrl: true });
  }

  ngOnDestroy(): void {
    document.body.classList.remove("navigation-drawer-open");
  }

  private focusFirst(container?: HTMLElement): void {
    this.focusableElements(container)[0]?.focus();
  }

  private trapFocus(event: KeyboardEvent, container?: HTMLElement): void {
    const elements = this.focusableElements(container);
    if (elements.length === 0) {
      return;
    }
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

  private focusableElements(container?: HTMLElement): HTMLElement[] {
    if (!container) {
      return [];
    }
    return Array.from(
      container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => !element.hasAttribute("hidden"));
  }
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: LOCALE_ID, useFactory: resolveBootstrapLocale },
    { provide: DEFAULT_CURRENCY_CODE, useValue: "CLP" }
  ]
}).catch((error: unknown) => {
  console.error(error);
});
