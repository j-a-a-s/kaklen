import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter, Routes, RouterOutlet, RouterLink, Router, RouterLinkActive } from "@angular/router";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { Component, DEFAULT_CURRENCY_CODE, LOCALE_ID, signal } from "@angular/core";
import { CommonModule, registerLocaleData } from "@angular/common";
import localeEs from "@angular/common/locales/es";
import localeEn from "@angular/common/locales/en";
import localePtBr from "@angular/common/locales/pt";
import { authGuard } from "./app/auth/auth.guard";
import { authInterceptor } from "./app/auth/auth.interceptor";
import { DashboardComponent } from "./app/pages/dashboard.component";
import { LoginComponent } from "./app/pages/login.component";
import { RegisterComponent } from "./app/pages/register.component";
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
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, LocaleSelectorComponent, NotificationContainerComponent],
  template: `
    <header class="topbar">
      <div class="topbar-left">
        <button
          *ngIf="isAuthenticated() && activeOrganizationId()"
          type="button"
          class="icon-button mobile-menu-button"
          (click)="toggleMenu()"
          [attr.aria-expanded]="menuOpen()"
          aria-controls="authenticated-navigation"
          aria-label="Abrir navegación"
          i18n-aria-label="@@openNavigationLabel"
        >
          ☰
        </button>
        <a class="brand" routerLink="/dashboard">Kaklen</a>
        <span class="organization-pill" *ngIf="activeOrganizationName()">{{ activeOrganizationName() }}</span>
      </div>

      <nav *ngIf="!isAuthenticated()" aria-label="Principal" i18n-aria-label="@@primaryNavigationAriaLabel">
        <a routerLink="/login" i18n="@@navLogin">Iniciar sesión</a>
        <a routerLink="/register" i18n="@@navRegister">Registro</a>
      </nav>

      <nav *ngIf="isAuthenticated()" class="topbar-actions" aria-label="Cuenta" i18n-aria-label="@@accountNavigationAriaLabel">
        <a routerLink="/organizations" i18n="@@navOrganizations">Organizaciones</a>
        <span class="user-chip" *ngIf="auth.user() as user">{{ user.firstName }} {{ user.lastName }}</span>
        <button type="button" class="secondary compact-button" (click)="logout()" i18n="@@logoutButton">Salir</button>
      </nav>
      <kaklen-locale-selector />
    </header>

    <div class="app-layout" [class.with-navigation]="isAuthenticated() && activeOrganizationId()">
      <aside
        id="authenticated-navigation"
        class="app-sidebar"
        *ngIf="isAuthenticated() && activeOrganizationId() as organizationId"
        [class.open]="menuOpen()"
      >
        <nav aria-label="Navegación de organización" i18n-aria-label="@@organizationNavigationAriaLabel">
          <a [routerLink]="['/organizations', organizationId]" routerLinkActive="active" (click)="closeMenu()" i18n="@@navHome">Inicio</a>
          <a *ngIf="can('clients.read')" [routerLink]="['/organizations', organizationId, 'clients']" routerLinkActive="active" (click)="closeMenu()" i18n="@@navClients">Clientes</a>
          <a *ngIf="can('catalog.read')" [routerLink]="['/organizations', organizationId, 'catalog']" routerLinkActive="active" (click)="closeMenu()" i18n="@@navCatalog">Productos y servicios</a>
          <a *ngIf="can('quotations.read')" [routerLink]="['/organizations', organizationId, 'quotations']" routerLinkActive="active" (click)="closeMenu()" i18n="@@navQuotations">Cotizaciones</a>
          <a *ngIf="can('events.read')" [routerLink]="['/organizations', organizationId, 'events']" routerLinkActive="active" (click)="closeMenu()" i18n="@@navEvents">Eventos</a>
          <a *ngIf="can('organization.members.read')" [routerLink]="['/organizations', organizationId, 'members']" routerLinkActive="active" (click)="closeMenu()" i18n="@@navMembers">Miembros</a>
          <a *ngIf="can('organization.update')" [routerLink]="['/organizations', organizationId, 'settings']" routerLinkActive="active" (click)="closeMenu()" i18n="@@navSettings">Configuración</a>
        </nav>
      </aside>

      <main class="app-content">
        <router-outlet />
      </main>
    </div>
    <kaklen-notification-container />
  `
})
class AppComponent {
  readonly menuOpen = signal(false);

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

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.closeMenu();
    await this.router.navigateByUrl("/login");
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
