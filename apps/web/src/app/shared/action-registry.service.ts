import { Injectable } from "@angular/core";
import { Permission } from "../organizations/organization.models";
import { UiIconName } from "./ui-icon.component";

export type ActionGroup = "create" | "navigation";

export interface ActionContext {
  organizationId: string | null;
}

export interface ActionDefinition {
  id: string;
  label: string;
  description: string;
  icon: UiIconName;
  permissions: readonly Permission[];
  route?: (context: ActionContext) => string;
  callback?: (context: ActionContext) => void | Promise<void>;
  keywords: readonly string[];
  group: ActionGroup;
}

export interface ResolvedAction extends Omit<ActionDefinition, "route"> {
  route?: string;
}

@Injectable({ providedIn: "root" })
export class ActionRegistryService {
  definitions(): readonly ActionDefinition[] {
    return [
      action("create-client", $localize`:@@newClientButton:Nuevo cliente`, $localize`:@@newClientHelp:Registra una persona o empresa`, "plus", ["clients.create"], ["persona", "empresa", "cliente", "prospecto"], "create", ({ organizationId }) => organizationRoute(organizationId, "clients/new")),
      action("create-catalog", $localize`:@@addCatalogItemButton:Agregar producto o servicio`, $localize`:@@addCatalogItemHelp:Completa tu catálogo comercial`, "plus", ["catalog.create"], ["producto", "servicio", "sku", "catalogo"], "create", ({ organizationId }) => organizationRoute(organizationId, "catalog/new")),
      action("create-quotation", $localize`:@@newQuotationButton:Nueva cotización`, $localize`:@@newQuotationHelp:Prepara una propuesta comercial`, "plus", ["quotations.create"], ["cotizacion", "presupuesto", "propuesta"], "create", ({ organizationId }) => organizationRoute(organizationId, "quotations/new")),
      action("create-event", $localize`:@@newEventButton:Nuevo evento`, $localize`:@@newEventHelp:Coordina fechas, tareas y recursos`, "plus", ["events.create"], ["evento", "calendario", "agenda"], "create", ({ organizationId }) => organizationRoute(organizationId, "events/new")),
      action("invite-member", $localize`:@@inviteUserButton:Invitar miembro`, $localize`:@@inviteUserHelp:Suma a alguien de tu equipo`, "users", ["organization.members.invite"], ["usuario", "equipo", "rol", "miembro"], "create", ({ organizationId }) => organizationRoute(organizationId, "members")),
      action("change-organization", $localize`:@@changeOrganizationButton:Cambiar organización`, $localize`:@@organizationsCommandHelp:Cambiar espacio de trabajo`, "building", [], ["workspace", "empresa", "organizacion"], "create", () => "/organizations"),
      action("home", $localize`:@@navHome:Inicio`, $localize`:@@dashboardEyebrow:Resumen de hoy`, "home", ["organization.read"], ["dashboard", "resumen", "inicio"], "navigation", ({ organizationId }) => organizationId ? `/organizations/${organizationId}` : "/organizations"),
      action("clients", $localize`:@@navClients:Clientes`, $localize`:@@clientsCommandHelp:Buscar personas y empresas`, "users", ["clients.read"], ["personas", "empresas", "rut"], "navigation", ({ organizationId }) => organizationRoute(organizationId, "clients")),
      action("catalog", $localize`:@@navCatalog:Productos y servicios`, $localize`:@@catalogCommandHelp:Revisar catálogo y precios`, "package", ["catalog.read"], ["catalogo", "sku", "precios"], "navigation", ({ organizationId }) => organizationRoute(organizationId, "catalog")),
      action("quotations", $localize`:@@navQuotations:Cotizaciones`, $localize`:@@quotationsCommandHelp:Continuar propuestas comerciales`, "file-text", ["quotations.read"], ["presupuestos", "propuestas", "numero"], "navigation", ({ organizationId }) => organizationRoute(organizationId, "quotations")),
      action("events", $localize`:@@navEvents:Eventos`, $localize`:@@eventsCommandHelp:Coordinar operaciones`, "calendar", ["events.read"], ["agenda", "calendario", "operacion"], "navigation", ({ organizationId }) => organizationRoute(organizationId, "events")),
      action("members", $localize`:@@navMembers:Miembros`, $localize`:@@membersCommandHelp:Gestionar equipo y roles`, "users", ["organization.members.read"], ["usuarios", "equipo", "roles"], "navigation", ({ organizationId }) => organizationRoute(organizationId, "members")),
      action("settings", $localize`:@@navSettings:Configuración`, $localize`:@@settingsCommandHelp:Configurar tu organización`, "settings", ["organization.update"], ["ajustes", "preferencias", "configuracion"], "navigation", ({ organizationId }) => organizationRoute(organizationId, "settings"))
    ];
  }

  resolve(
    context: ActionContext,
    hasPermission: (permission: Permission) => boolean
  ): ResolvedAction[] {
    return this.definitions()
      .filter((definition) =>
        definition.permissions.every((permission) => hasPermission(permission))
      )
      .filter((definition) =>
        context.organizationId !== null || definition.id === "change-organization"
      )
      .map(({ route, ...definition }) => ({
        ...definition,
        ...(route ? { route: route(context) } : {})
      }));
  }
}

function action(
  id: string,
  label: string,
  description: string,
  icon: UiIconName,
  permissions: readonly Permission[],
  keywords: readonly string[],
  group: ActionGroup,
  route: (context: ActionContext) => string
): ActionDefinition {
  return { id, label, description, icon, permissions, keywords, group, route };
}

function organizationRoute(organizationId: string | null, suffix: string): string {
  return organizationId ? `/organizations/${organizationId}/${suffix}` : "/organizations";
}
