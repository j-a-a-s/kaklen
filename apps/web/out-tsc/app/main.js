import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter, RouterOutlet, RouterLink } from "@angular/router";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { Component } from "@angular/core";
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
import * as i0 from "@angular/core";
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
    static ɵcmp = /*@__PURE__*/ i0.ɵɵdefineComponent({ type: AppComponent, selectors: [["kaklen-root"]], decls: 11, vars: 0, consts: [[1, "topbar"], ["routerLink", "/dashboard", 1, "brand"], ["aria-label", "Primary"], ["routerLink", "/login"], ["routerLink", "/register"], ["routerLink", "/organizations"]], template: function AppComponent_Template(rf, ctx) { if (rf & 1) {
            i0.ɵɵelementStart(0, "header", 0)(1, "a", 1);
            i0.ɵɵtext(2, "Kaklen");
            i0.ɵɵelementEnd();
            i0.ɵɵelementStart(3, "nav", 2)(4, "a", 3);
            i0.ɵɵtext(5, "Login");
            i0.ɵɵelementEnd();
            i0.ɵɵelementStart(6, "a", 4);
            i0.ɵɵtext(7, "Register");
            i0.ɵɵelementEnd();
            i0.ɵɵelementStart(8, "a", 5);
            i0.ɵɵtext(9, "Organizaciones");
            i0.ɵɵelementEnd()()();
            i0.ɵɵelement(10, "router-outlet");
        } }, dependencies: [RouterOutlet, RouterLink], encapsulation: 2 });
}
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.ɵsetClassMetadata(AppComponent, [{
        type: Component,
        args: [{
                selector: "kaklen-root",
                standalone: true,
                imports: [RouterOutlet, RouterLink],
                template: `
    <header class="topbar">
      <a class="brand" routerLink="/dashboard">Kaklen</a>
      <nav aria-label="Primary">
        <a routerLink="/login">Login</a>
        <a routerLink="/register">Register</a>
        <a routerLink="/organizations">Organizaciones</a>
      </nav>
    </header>
    <router-outlet />
  `
            }]
    }], null, null); })();
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.ɵsetClassDebugInfo(AppComponent, { className: "AppComponent", filePath: "src/main.ts", lineNumber: 99 }); })();
bootstrapApplication(AppComponent, {
    providers: [provideRouter(routes), provideHttpClient(withInterceptors([authInterceptor]))]
}).catch((error) => {
    console.error(error);
});
//# sourceMappingURL=main.js.map