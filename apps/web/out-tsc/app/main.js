import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter, RouterOutlet, RouterLink, RouterLinkActive } from "@angular/router";
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
import { NotificationContainerComponent } from "./app/shared/notifications/notification-container.component";
import { VersionBadgeComponent } from "./app/version/version-badge.component";
import * as i0 from "@angular/core";
import * as i1 from "./app/auth/auth.service";
import * as i2 from "./app/organizations/organization.service";
import * as i3 from "@angular/router";
import * as i4 from "./app/version/version.service";
import * as i5 from "@angular/common";
const _c0 = a0 => ["/organizations", a0];
const _c1 = a0 => ["/organizations", a0, "clients"];
const _c2 = a0 => ["/organizations", a0, "catalog"];
const _c3 = a0 => ["/organizations", a0, "quotations"];
const _c4 = a0 => ["/organizations", a0, "events"];
const _c5 = a0 => ["/organizations", a0, "members"];
const _c6 = a0 => ["/organizations", a0, "settings"];
function AppComponent_button_2_Template(rf, ctx) { if (rf & 1) {
    const _r1 = i0.ɵɵgetCurrentView();
    i0.ɵɵelementStart(0, "button", 22);
    i0.ɵɵlistener("click", function AppComponent_button_2_Template_button_click_0_listener() { i0.ɵɵrestoreView(_r1); const ctx_r1 = i0.ɵɵnextContext(); return i0.ɵɵresetView(ctx_r1.toggleMenu()); });
    i0.ɵɵtext(1, " \u2630 ");
    i0.ɵɵelementEnd();
} if (rf & 2) {
    const ctx_r1 = i0.ɵɵnextContext();
    i0.ɵɵattribute("aria-expanded", ctx_r1.menuOpen());
} }
function AppComponent_span_5_Template(rf, ctx) { if (rf & 1) {
    i0.ɵɵelementStart(0, "span", 23);
    i0.ɵɵtext(1);
    i0.ɵɵelementEnd();
} if (rf & 2) {
    const ctx_r1 = i0.ɵɵnextContext();
    i0.ɵɵadvance();
    i0.ɵɵtextInterpolate(ctx_r1.activeOrganizationName());
} }
function AppComponent_nav_6_Template(rf, ctx) { if (rf & 1) {
    i0.ɵɵelementStart(0, "nav", 24)(1, "a", 25);
    i0.ɵɵi18n(2, 0);
    i0.ɵɵelementEnd();
    i0.ɵɵelementStart(3, "a", 26);
    i0.ɵɵi18n(4, 1);
    i0.ɵɵelementEnd()();
} }
function AppComponent_nav_7_span_3_Template(rf, ctx) { if (rf & 1) {
    i0.ɵɵelementStart(0, "span", 31);
    i0.ɵɵtext(1);
    i0.ɵɵelementEnd();
} if (rf & 2) {
    const user_r4 = ctx.ngIf;
    i0.ɵɵadvance();
    i0.ɵɵtextInterpolate2("", user_r4.firstName, " ", user_r4.lastName);
} }
function AppComponent_nav_7_Template(rf, ctx) { if (rf & 1) {
    const _r3 = i0.ɵɵgetCurrentView();
    i0.ɵɵelementStart(0, "nav", 27)(1, "a", 28);
    i0.ɵɵi18n(2, 2);
    i0.ɵɵelementEnd();
    i0.ɵɵtemplate(3, AppComponent_nav_7_span_3_Template, 2, 2, "span", 29);
    i0.ɵɵelementStart(4, "button", 30);
    i0.ɵɵlistener("click", function AppComponent_nav_7_Template_button_click_4_listener() { i0.ɵɵrestoreView(_r3); const ctx_r1 = i0.ɵɵnextContext(); return i0.ɵɵresetView(ctx_r1.logout()); });
    i0.ɵɵi18n(5, 3);
    i0.ɵɵelementEnd()();
} if (rf & 2) {
    const ctx_r1 = i0.ɵɵnextContext();
    i0.ɵɵadvance(3);
    i0.ɵɵproperty("ngIf", ctx_r1.auth.user());
} }
function AppComponent_aside_10_a_4_Template(rf, ctx) { if (rf & 1) {
    const _r6 = i0.ɵɵgetCurrentView();
    i0.ɵɵelementStart(0, "a", 34);
    i0.ɵɵlistener("click", function AppComponent_aside_10_a_4_Template_a_click_0_listener() { i0.ɵɵrestoreView(_r6); const ctx_r1 = i0.ɵɵnextContext(2); return i0.ɵɵresetView(ctx_r1.closeMenu()); });
    i0.ɵɵi18n(1, 5);
    i0.ɵɵelementEnd();
} if (rf & 2) {
    const organizationId_r7 = i0.ɵɵnextContext().ngIf;
    i0.ɵɵproperty("routerLink", i0.ɵɵpureFunction1(1, _c1, organizationId_r7));
} }
function AppComponent_aside_10_a_5_Template(rf, ctx) { if (rf & 1) {
    const _r8 = i0.ɵɵgetCurrentView();
    i0.ɵɵelementStart(0, "a", 34);
    i0.ɵɵlistener("click", function AppComponent_aside_10_a_5_Template_a_click_0_listener() { i0.ɵɵrestoreView(_r8); const ctx_r1 = i0.ɵɵnextContext(2); return i0.ɵɵresetView(ctx_r1.closeMenu()); });
    i0.ɵɵi18n(1, 6);
    i0.ɵɵelementEnd();
} if (rf & 2) {
    const organizationId_r7 = i0.ɵɵnextContext().ngIf;
    i0.ɵɵproperty("routerLink", i0.ɵɵpureFunction1(1, _c2, organizationId_r7));
} }
function AppComponent_aside_10_a_6_Template(rf, ctx) { if (rf & 1) {
    const _r9 = i0.ɵɵgetCurrentView();
    i0.ɵɵelementStart(0, "a", 34);
    i0.ɵɵlistener("click", function AppComponent_aside_10_a_6_Template_a_click_0_listener() { i0.ɵɵrestoreView(_r9); const ctx_r1 = i0.ɵɵnextContext(2); return i0.ɵɵresetView(ctx_r1.closeMenu()); });
    i0.ɵɵi18n(1, 7);
    i0.ɵɵelementEnd();
} if (rf & 2) {
    const organizationId_r7 = i0.ɵɵnextContext().ngIf;
    i0.ɵɵproperty("routerLink", i0.ɵɵpureFunction1(1, _c3, organizationId_r7));
} }
function AppComponent_aside_10_a_7_Template(rf, ctx) { if (rf & 1) {
    const _r10 = i0.ɵɵgetCurrentView();
    i0.ɵɵelementStart(0, "a", 34);
    i0.ɵɵlistener("click", function AppComponent_aside_10_a_7_Template_a_click_0_listener() { i0.ɵɵrestoreView(_r10); const ctx_r1 = i0.ɵɵnextContext(2); return i0.ɵɵresetView(ctx_r1.closeMenu()); });
    i0.ɵɵi18n(1, 8);
    i0.ɵɵelementEnd();
} if (rf & 2) {
    const organizationId_r7 = i0.ɵɵnextContext().ngIf;
    i0.ɵɵproperty("routerLink", i0.ɵɵpureFunction1(1, _c4, organizationId_r7));
} }
function AppComponent_aside_10_a_8_Template(rf, ctx) { if (rf & 1) {
    const _r11 = i0.ɵɵgetCurrentView();
    i0.ɵɵelementStart(0, "a", 34);
    i0.ɵɵlistener("click", function AppComponent_aside_10_a_8_Template_a_click_0_listener() { i0.ɵɵrestoreView(_r11); const ctx_r1 = i0.ɵɵnextContext(2); return i0.ɵɵresetView(ctx_r1.closeMenu()); });
    i0.ɵɵi18n(1, 9);
    i0.ɵɵelementEnd();
} if (rf & 2) {
    const organizationId_r7 = i0.ɵɵnextContext().ngIf;
    i0.ɵɵproperty("routerLink", i0.ɵɵpureFunction1(1, _c5, organizationId_r7));
} }
function AppComponent_aside_10_a_9_Template(rf, ctx) { if (rf & 1) {
    const _r12 = i0.ɵɵgetCurrentView();
    i0.ɵɵelementStart(0, "a", 34);
    i0.ɵɵlistener("click", function AppComponent_aside_10_a_9_Template_a_click_0_listener() { i0.ɵɵrestoreView(_r12); const ctx_r1 = i0.ɵɵnextContext(2); return i0.ɵɵresetView(ctx_r1.closeMenu()); });
    i0.ɵɵi18n(1, 10);
    i0.ɵɵelementEnd();
} if (rf & 2) {
    const organizationId_r7 = i0.ɵɵnextContext().ngIf;
    i0.ɵɵproperty("routerLink", i0.ɵɵpureFunction1(1, _c6, organizationId_r7));
} }
function AppComponent_aside_10_Template(rf, ctx) { if (rf & 1) {
    const _r5 = i0.ɵɵgetCurrentView();
    i0.ɵɵelementStart(0, "aside", 32)(1, "nav", 33)(2, "a", 34);
    i0.ɵɵlistener("click", function AppComponent_aside_10_Template_a_click_2_listener() { i0.ɵɵrestoreView(_r5); const ctx_r1 = i0.ɵɵnextContext(); return i0.ɵɵresetView(ctx_r1.closeMenu()); });
    i0.ɵɵi18n(3, 4);
    i0.ɵɵelementEnd();
    i0.ɵɵtemplate(4, AppComponent_aside_10_a_4_Template, 2, 3, "a", 35)(5, AppComponent_aside_10_a_5_Template, 2, 3, "a", 35)(6, AppComponent_aside_10_a_6_Template, 2, 3, "a", 35)(7, AppComponent_aside_10_a_7_Template, 2, 3, "a", 35)(8, AppComponent_aside_10_a_8_Template, 2, 3, "a", 35)(9, AppComponent_aside_10_a_9_Template, 2, 3, "a", 35);
    i0.ɵɵelementEnd()();
} if (rf & 2) {
    const organizationId_r7 = ctx.ngIf;
    const ctx_r1 = i0.ɵɵnextContext();
    i0.ɵɵclassProp("open", ctx_r1.menuOpen());
    i0.ɵɵadvance(2);
    i0.ɵɵproperty("routerLink", i0.ɵɵpureFunction1(9, _c0, organizationId_r7));
    i0.ɵɵadvance(2);
    i0.ɵɵproperty("ngIf", ctx_r1.can("clients.read"));
    i0.ɵɵadvance();
    i0.ɵɵproperty("ngIf", ctx_r1.can("catalog.read"));
    i0.ɵɵadvance();
    i0.ɵɵproperty("ngIf", ctx_r1.can("quotations.read"));
    i0.ɵɵadvance();
    i0.ɵɵproperty("ngIf", ctx_r1.can("events.read"));
    i0.ɵɵadvance();
    i0.ɵɵproperty("ngIf", ctx_r1.can("organization.members.read"));
    i0.ɵɵadvance();
    i0.ɵɵproperty("ngIf", ctx_r1.can("organization.update"));
} }
function AppComponent_footer_13_Template(rf, ctx) { if (rf & 1) {
    i0.ɵɵelementStart(0, "footer", 36);
    i0.ɵɵelement(1, "kaklen-version-badge");
    i0.ɵɵelementEnd();
} }
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
class AppComponent {
    auth;
    organizationService;
    router;
    versionService;
    menuOpen = signal(false, ...(ngDevMode ? [{ debugName: "menuOpen" }] : []));
    constructor(auth, organizationService, router, versionService) {
        this.auth = auth;
        this.organizationService = organizationService;
        this.router = router;
        this.versionService = versionService;
        this.versionService.start();
    }
    isAuthenticated() {
        return this.auth.user() !== null;
    }
    activeOrganizationId() {
        return this.organizationService.activeOrganizationId();
    }
    activeOrganizationName() {
        return this.organizationService.activeOrganization()?.name ?? "";
    }
    can(permission) {
        return this.organizationService.hasPermission(permission);
    }
    toggleMenu() {
        this.menuOpen.update((open) => !open);
    }
    closeMenu() {
        this.menuOpen.set(false);
    }
    async logout() {
        await this.auth.logout();
        this.closeMenu();
        await this.router.navigateByUrl("/login");
    }
    static ɵfac = function AppComponent_Factory(__ngFactoryType__) { return new (__ngFactoryType__ || AppComponent)(i0.ɵɵdirectiveInject(i1.AuthService), i0.ɵɵdirectiveInject(i2.OrganizationService), i0.ɵɵdirectiveInject(i3.Router), i0.ɵɵdirectiveInject(i4.VersionService)); };
    static ɵcmp = /*@__PURE__*/ i0.ɵɵdefineComponent({ type: AppComponent, selectors: [["kaklen-root"]], decls: 15, vars: 8, consts: () => { let i18n_0; if (typeof ngI18nClosureMode !== "undefined" && ngI18nClosureMode) {
            /**
             * @suppress {msgDescriptions}
             */
            const MSG_EXTERNAL_openNavigationLabel$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_0 = goog.getMsg("Abrir navegaci\u00F3n");
            i18n_0 = MSG_EXTERNAL_openNavigationLabel$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_0;
        }
        else {
            i18n_0 = $localize `:@@openNavigationLabel␟379334a8678a3b655d0d32a88f2825e81450738d␟4927706264342420446:Abrir navegación`;
        } let i18n_1; if (typeof ngI18nClosureMode !== "undefined" && ngI18nClosureMode) {
            /**
             * @suppress {msgDescriptions}
             */
            const MSG_EXTERNAL_primaryNavigationAriaLabel$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_1 = goog.getMsg("Principal");
            i18n_1 = MSG_EXTERNAL_primaryNavigationAriaLabel$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_1;
        }
        else {
            i18n_1 = $localize `:@@primaryNavigationAriaLabel␟732705569e07059ff6e4ffccc4157a2faaa031f4␟6333053818705726495:Principal`;
        } let i18n_2; if (typeof ngI18nClosureMode !== "undefined" && ngI18nClosureMode) {
            /**
             * @suppress {msgDescriptions}
             */
            const MSG_EXTERNAL_accountNavigationAriaLabel$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_2 = goog.getMsg("Cuenta");
            i18n_2 = MSG_EXTERNAL_accountNavigationAriaLabel$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_2;
        }
        else {
            i18n_2 = $localize `:@@accountNavigationAriaLabel␟8d27a7ce7e934f40b5db8b2bab09e72e21200b0c␟6313734668493507850:Cuenta`;
        } let i18n_3; if (typeof ngI18nClosureMode !== "undefined" && ngI18nClosureMode) {
            /**
             * @suppress {msgDescriptions}
             */
            const MSG_EXTERNAL_navLogin$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_3 = goog.getMsg("Iniciar sesi\u00F3n");
            i18n_3 = MSG_EXTERNAL_navLogin$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_3;
        }
        else {
            i18n_3 = $localize `:@@navLogin␟178aa14d8ee687d41b9be03758b6983fcf628e4e␟4311569858228721961:Iniciar sesión`;
        } let i18n_4; if (typeof ngI18nClosureMode !== "undefined" && ngI18nClosureMode) {
            /**
             * @suppress {msgDescriptions}
             */
            const MSG_EXTERNAL_navRegister$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_4 = goog.getMsg("Registro");
            i18n_4 = MSG_EXTERNAL_navRegister$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_4;
        }
        else {
            i18n_4 = $localize `:@@navRegister␟cf04f7c4d68523426a322308a940acf7a2d09b29␟1824343322741992092:Registro`;
        } let i18n_5; if (typeof ngI18nClosureMode !== "undefined" && ngI18nClosureMode) {
            /**
             * @suppress {msgDescriptions}
             */
            const MSG_EXTERNAL_navOrganizations$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_5 = goog.getMsg("Organizaciones");
            i18n_5 = MSG_EXTERNAL_navOrganizations$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_5;
        }
        else {
            i18n_5 = $localize `:@@navOrganizations␟7c33a8fff49f39a37d1df77923d50bcd18cd82ca␟8644265843256937014:Organizaciones`;
        } let i18n_6; if (typeof ngI18nClosureMode !== "undefined" && ngI18nClosureMode) {
            /**
             * @suppress {msgDescriptions}
             */
            const MSG_EXTERNAL_logoutButton$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_6 = goog.getMsg("Salir");
            i18n_6 = MSG_EXTERNAL_logoutButton$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_6;
        }
        else {
            i18n_6 = $localize `:@@logoutButton␟da709f6bba85ab5f0cd70548fe404c34a8f15ffd␟7561060183100598492:Salir`;
        } let i18n_7; if (typeof ngI18nClosureMode !== "undefined" && ngI18nClosureMode) {
            /**
             * @suppress {msgDescriptions}
             */
            const MSG_EXTERNAL_organizationNavigationAriaLabel$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_7 = goog.getMsg("Navegaci\u00F3n de organizaci\u00F3n");
            i18n_7 = MSG_EXTERNAL_organizationNavigationAriaLabel$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_7;
        }
        else {
            i18n_7 = $localize `:@@organizationNavigationAriaLabel␟391ac3d920faaecf920656a98d296afdcbcf0e11␟5890762798942373043:Navegación de organización`;
        } let i18n_8; if (typeof ngI18nClosureMode !== "undefined" && ngI18nClosureMode) {
            /**
             * @suppress {msgDescriptions}
             */
            const MSG_EXTERNAL_navHome$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_8 = goog.getMsg("Inicio");
            i18n_8 = MSG_EXTERNAL_navHome$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_8;
        }
        else {
            i18n_8 = $localize `:@@navHome␟45a4b797ab6931fb10ed4ad33c49a77582db3db8␟1926157928707021468:Inicio`;
        } let i18n_9; if (typeof ngI18nClosureMode !== "undefined" && ngI18nClosureMode) {
            /**
             * @suppress {msgDescriptions}
             */
            const MSG_EXTERNAL_navClients$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_9 = goog.getMsg("Clientes");
            i18n_9 = MSG_EXTERNAL_navClients$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_9;
        }
        else {
            i18n_9 = $localize `:@@navClients␟1fbcdbc0de8d9a40365a542f7b469cf763992922␟7944595083423468556:Clientes`;
        } let i18n_10; if (typeof ngI18nClosureMode !== "undefined" && ngI18nClosureMode) {
            /**
             * @suppress {msgDescriptions}
             */
            const MSG_EXTERNAL_navCatalog$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_10 = goog.getMsg("Productos y servicios");
            i18n_10 = MSG_EXTERNAL_navCatalog$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_10;
        }
        else {
            i18n_10 = $localize `:@@navCatalog␟e18bd4186cc60686e56c840a69f4452e507f166e␟199485451377824171:Productos y servicios`;
        } let i18n_11; if (typeof ngI18nClosureMode !== "undefined" && ngI18nClosureMode) {
            /**
             * @suppress {msgDescriptions}
             */
            const MSG_EXTERNAL_navQuotations$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_11 = goog.getMsg("Cotizaciones");
            i18n_11 = MSG_EXTERNAL_navQuotations$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_11;
        }
        else {
            i18n_11 = $localize `:@@navQuotations␟618d648b5a3d185eeb98d2448b84b32cdff0de83␟638559301542157051:Cotizaciones`;
        } let i18n_12; if (typeof ngI18nClosureMode !== "undefined" && ngI18nClosureMode) {
            /**
             * @suppress {msgDescriptions}
             */
            const MSG_EXTERNAL_navEvents$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_12 = goog.getMsg("Eventos");
            i18n_12 = MSG_EXTERNAL_navEvents$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_12;
        }
        else {
            i18n_12 = $localize `:@@navEvents␟c99c3947f86cc6f4c8f855bce30719dcf7c9b75b␟4192143499889021312:Eventos`;
        } let i18n_13; if (typeof ngI18nClosureMode !== "undefined" && ngI18nClosureMode) {
            /**
             * @suppress {msgDescriptions}
             */
            const MSG_EXTERNAL_navMembers$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_13 = goog.getMsg("Miembros");
            i18n_13 = MSG_EXTERNAL_navMembers$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_13;
        }
        else {
            i18n_13 = $localize `:@@navMembers␟b9470fe61a8eaea0b5524014c89f4149c96e3401␟7362339307565743533:Miembros`;
        } let i18n_14; if (typeof ngI18nClosureMode !== "undefined" && ngI18nClosureMode) {
            /**
             * @suppress {msgDescriptions}
             */
            const MSG_EXTERNAL_navSettings$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_14 = goog.getMsg("Configuraci\u00F3n");
            i18n_14 = MSG_EXTERNAL_navSettings$$__________________USERS_JORGEALARCON_DESKTOP_KAKLEN_APPS_WEB_SRC_MAIN_TS_14;
        }
        else {
            i18n_14 = $localize `:@@navSettings␟59f3f6b3de471952371db79ea2da4defccd30d3f␟6076319951837431770:Configuración`;
        } return [i18n_3, i18n_4, i18n_5, i18n_6, i18n_8, i18n_9, i18n_10, i18n_11, i18n_12, i18n_13, i18n_14, [1, "topbar"], [1, "topbar-left"], ["type", "button", "class", "icon-button mobile-menu-button", "aria-controls", "authenticated-navigation", "aria-label", i18n_0, 3, "click", 4, "ngIf"], ["routerLink", "/dashboard", 1, "brand"], ["class", "organization-pill", 4, "ngIf"], ["aria-label", i18n_1, 4, "ngIf"], ["class", "topbar-actions", "aria-label", i18n_2, 4, "ngIf"], [1, "app-layout"], ["id", "authenticated-navigation", "class", "app-sidebar", 3, "open", 4, "ngIf"], [1, "app-content"], ["class", "app-footer", 4, "ngIf"], ["type", "button", "aria-controls", "authenticated-navigation", "aria-label", i18n_0, 1, "icon-button", "mobile-menu-button", 3, "click"], [1, "organization-pill"], ["aria-label", i18n_1], ["routerLink", "/login"], ["routerLink", "/register"], ["aria-label", i18n_2, 1, "topbar-actions"], ["routerLink", "/organizations"], ["class", "user-chip", 4, "ngIf"], ["type", "button", 1, "secondary", "compact-button", 3, "click"], [1, "user-chip"], ["id", "authenticated-navigation", 1, "app-sidebar"], ["aria-label", i18n_7], ["routerLinkActive", "active", 3, "click", "routerLink"], ["routerLinkActive", "active", 3, "routerLink", "click", 4, "ngIf"], [1, "app-footer"]]; }, template: function AppComponent_Template(rf, ctx) { if (rf & 1) {
            i0.ɵɵelementStart(0, "header", 11)(1, "div", 12);
            i0.ɵɵtemplate(2, AppComponent_button_2_Template, 2, 1, "button", 13);
            i0.ɵɵelementStart(3, "a", 14);
            i0.ɵɵtext(4, "Kaklen");
            i0.ɵɵelementEnd();
            i0.ɵɵtemplate(5, AppComponent_span_5_Template, 2, 1, "span", 15);
            i0.ɵɵelementEnd();
            i0.ɵɵtemplate(6, AppComponent_nav_6_Template, 5, 0, "nav", 16)(7, AppComponent_nav_7_Template, 6, 1, "nav", 17);
            i0.ɵɵelement(8, "kaklen-locale-selector");
            i0.ɵɵelementEnd();
            i0.ɵɵelementStart(9, "div", 18);
            i0.ɵɵtemplate(10, AppComponent_aside_10_Template, 10, 11, "aside", 19);
            i0.ɵɵelementStart(11, "main", 20);
            i0.ɵɵelement(12, "router-outlet");
            i0.ɵɵtemplate(13, AppComponent_footer_13_Template, 2, 0, "footer", 21);
            i0.ɵɵelementEnd()();
            i0.ɵɵelement(14, "kaklen-notification-container");
        } if (rf & 2) {
            i0.ɵɵadvance(2);
            i0.ɵɵproperty("ngIf", ctx.isAuthenticated() && ctx.activeOrganizationId());
            i0.ɵɵadvance(3);
            i0.ɵɵproperty("ngIf", ctx.activeOrganizationName());
            i0.ɵɵadvance();
            i0.ɵɵproperty("ngIf", !ctx.isAuthenticated());
            i0.ɵɵadvance();
            i0.ɵɵproperty("ngIf", ctx.isAuthenticated());
            i0.ɵɵadvance(2);
            i0.ɵɵclassProp("with-navigation", ctx.isAuthenticated() && ctx.activeOrganizationId());
            i0.ɵɵadvance();
            i0.ɵɵproperty("ngIf", ctx.isAuthenticated() && ctx.activeOrganizationId());
            i0.ɵɵadvance(3);
            i0.ɵɵproperty("ngIf", ctx.isAuthenticated());
        } }, dependencies: [CommonModule, i5.NgIf, RouterOutlet, RouterLink, RouterLinkActive, LocaleSelectorComponent, NotificationContainerComponent, VersionBadgeComponent], encapsulation: 2 });
}
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.ɵsetClassMetadata(AppComponent, [{
        type: Component,
        args: [{
                selector: "kaklen-root",
                standalone: true,
                imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, LocaleSelectorComponent, NotificationContainerComponent, VersionBadgeComponent],
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
        <footer class="app-footer" *ngIf="isAuthenticated()">
          <kaklen-version-badge />
        </footer>
      </main>
    </div>
    <kaklen-notification-container />
  `
            }]
    }], () => [{ type: i1.AuthService }, { type: i2.OrganizationService }, { type: i3.Router }, { type: i4.VersionService }], null); })();
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.ɵsetClassDebugInfo(AppComponent, { className: "AppComponent", filePath: "src/main.ts", lineNumber: 234 }); })();
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