import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter, Routes, RouterOutlet, RouterLink, Router } from "@angular/router";
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
})
class AppComponent {}

bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes), provideHttpClient(withInterceptors([authInterceptor]))]
}).catch((error: unknown) => {
  console.error(error);
});
