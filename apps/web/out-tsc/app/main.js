import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter, RouterOutlet, RouterLink } from "@angular/router";
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
import * as i0 from "@angular/core";
registerLocaleData(localeEs, "es");
registerLocaleData(localeEn, "en");
registerLocaleData(localePtBr, "pt-BR");
const supportedLocales = ["es", "en", "pt-BR"];
function resolveBootstrapLocale() {
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
const routes = [
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
class AppComponent {
    static ɵfac = function AppComponent_Factory(__ngFactoryType__) { return new (__ngFactoryType__ || AppComponent)(); };
    static ɵcmp = /*@__PURE__*/ i0.ɵɵdefineComponent({ type: AppComponent, selectors: [["kaklen-root"]], decls: 12, vars: 0, consts: () => { let i18n_0; if (typeof ngI18nClosureMode !== "undefined" && ngI18nClosureMode) {
            /**
             * @suppress {msgDescriptions}
             */
            const MSG_EXTERNAL_primaryNavigationAriaLabel$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_0 = goog.getMsg("Principal");
            i18n_0 = MSG_EXTERNAL_primaryNavigationAriaLabel$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_0;
        }
        else {
            i18n_0 = $localize `:@@primaryNavigationAriaLabel␟732705569e07059ff6e4ffccc4157a2faaa031f4␟6333053818705726495:Principal`;
        } let i18n_1; if (typeof ngI18nClosureMode !== "undefined" && ngI18nClosureMode) {
            /**
             * @suppress {msgDescriptions}
             */
            const MSG_EXTERNAL_navLogin$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_1 = goog.getMsg("Iniciar sesi\u00F3n");
            i18n_1 = MSG_EXTERNAL_navLogin$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_1;
        }
        else {
            i18n_1 = $localize `:@@navLogin␟178aa14d8ee687d41b9be03758b6983fcf628e4e␟4311569858228721961:Iniciar sesión`;
        } let i18n_2; if (typeof ngI18nClosureMode !== "undefined" && ngI18nClosureMode) {
            /**
             * @suppress {msgDescriptions}
             */
            const MSG_EXTERNAL_navRegister$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_2 = goog.getMsg("Registro");
            i18n_2 = MSG_EXTERNAL_navRegister$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_2;
        }
        else {
            i18n_2 = $localize `:@@navRegister␟cf04f7c4d68523426a322308a940acf7a2d09b29␟1824343322741992092:Registro`;
        } let i18n_3; if (typeof ngI18nClosureMode !== "undefined" && ngI18nClosureMode) {
            /**
             * @suppress {msgDescriptions}
             */
            const MSG_EXTERNAL_navOrganizations$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_3 = goog.getMsg("Organizaciones");
            i18n_3 = MSG_EXTERNAL_navOrganizations$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_3;
        }
        else {
            i18n_3 = $localize `:@@navOrganizations␟7c33a8fff49f39a37d1df77923d50bcd18cd82ca␟8644265843256937014:Organizaciones`;
        } return [i18n_1, i18n_2, i18n_3, [1, "topbar"], ["routerLink", "/dashboard", 1, "brand"], ["aria-label", i18n_0], ["routerLink", "/login"], ["routerLink", "/register"], ["routerLink", "/organizations"]]; }, template: function AppComponent_Template(rf, ctx) { if (rf & 1) {
            i0.ɵɵelementStart(0, "header", 3)(1, "a", 4);
            i0.ɵɵtext(2, "Kaklen");
            i0.ɵɵelementEnd();
            i0.ɵɵelementStart(3, "nav", 5)(4, "a", 6);
            i0.ɵɵi18n(5, 0);
            i0.ɵɵelementEnd();
            i0.ɵɵelementStart(6, "a", 7);
            i0.ɵɵi18n(7, 1);
            i0.ɵɵelementEnd();
            i0.ɵɵelementStart(8, "a", 8);
            i0.ɵɵi18n(9, 2);
            i0.ɵɵelementEnd()();
            i0.ɵɵelement(10, "kaklen-locale-selector");
            i0.ɵɵelementEnd();
            i0.ɵɵelement(11, "router-outlet");
        } }, dependencies: [RouterOutlet, RouterLink, LocaleSelectorComponent], encapsulation: 2 });
}
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.ɵsetClassMetadata(AppComponent, [{
        type: Component,
        args: [{
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
            }]
    }], null, null); })();
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.ɵsetClassDebugInfo(AppComponent, { className: "AppComponent", filePath: "src/main.ts", lineNumber: 128 }); })();
bootstrapApplication(AppComponent, {
    providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor])),
        { provide: LOCALE_ID, useFactory: resolveBootstrapLocale },
        { provide: DEFAULT_CURRENCY_CODE, useValue: "CLP" }
    ]
}).catch((error) => {
    console.error(error);
});
//# sourceMappingURL=main.js.map