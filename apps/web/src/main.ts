import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter, Routes, RouterOutlet, RouterLink, Router } from "@angular/router";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { Component, DEFAULT_CURRENCY_CODE, LOCALE_ID } from "@angular/core";
import { registerLocaleData } from "@angular/common";
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
import { LocaleSelectorComponent } from "./app/i18n/locale-selector.component";
import { SupportedLocale } from "./app/i18n/locale.service";

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
  { path: "accept-invitation", component: AcceptInvitationComponent, canActivate: [authGuard] },
  { path: "", pathMatch: "full", redirectTo: "login" },
  { path: "**", redirectTo: "login" }
];

@Component({
  selector: "kaklen-root",
  standalone: true,
  imports: [RouterOutlet, RouterLink, LocaleSelectorComponent],
  template: `
    <header class="topbar">
      <a class="brand" routerLink="/dashboard">Kaklen</a>
      <nav aria-label="Principal" i18n-aria-label="@@primaryNavigationAriaLabel">
        <a routerLink="/login" i18n="@@navLogin">Iniciar sesión</a>
        <a routerLink="/register" i18n="@@navRegister">Registro</a>
        <a routerLink="/organizations" i18n="@@navOrganizations">Organizaciones</a>
      </nav>
      <kaklen-locale-selector />
    </header>
    <router-outlet />
  `
})
class AppComponent {}

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
