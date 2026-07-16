import { CatalogItemStatus } from "../catalog/catalog.models";
import { ClientStatus } from "../clients/client.models";
import { EventParticipantRole, EventStatus, EventTaskPriority, EventTaskStatus } from "../events/event.models";
import { QuotationStatus } from "../quotations/quotation.models";
import { OrganizationRole } from "../organizations/organization.models";

export function clientStatusLabel(status: ClientStatus): string {
  const labels: Record<ClientStatus, string> = {
    LEAD: $localize`:@@leadLabel:Lead`,
    ACTIVE: $localize`:@@activeLabel:Activo`,
    INACTIVE: $localize`:@@inactiveLabel:Inactivo`,
    ARCHIVED: $localize`:@@archivedLabel:Archivado`
  };
  return labels[status];
}

export function catalogStatusLabel(status: CatalogItemStatus): string {
  const labels: Record<CatalogItemStatus, string> = {
    ACTIVE: $localize`:@@activeLabel:Activo`,
    INACTIVE: $localize`:@@inactiveLabel:Inactivo`,
    ARCHIVED: $localize`:@@archivedLabel:Archivado`
  };
  return labels[status];
}

export function quotationStatusLabel(status: QuotationStatus): string {
  const labels: Record<QuotationStatus, string> = {
    DRAFT: $localize`:@@draftLabel:Borrador`,
    SENT: $localize`:@@sentLabel:Enviada`,
    APPROVED: $localize`:@@approvedLabel:Aprobada`,
    REJECTED: $localize`:@@rejectedLabel:Rechazada`,
    EXPIRED: $localize`:@@expiredLabel:Expirada`,
    CANCELLED: $localize`:@@quotationCancelledLabel:Cancelada`
  };
  return labels[status];
}

export function eventStatusLabel(status: EventStatus): string {
  const labels: Record<EventStatus, string> = {
    DRAFT: $localize`:@@draftLabel:Borrador`,
    CONFIRMED: $localize`:@@confirmedLabel:Confirmado`,
    IN_PROGRESS: $localize`:@@inProgressLabel:En curso`,
    COMPLETED: $localize`:@@eventCompletedLabel:Completado`,
    CANCELLED: $localize`:@@eventCancelledLabel:Cancelado`,
    ARCHIVED: $localize`:@@archivedLabel:Archivado`
  };
  return labels[status];
}

export function eventTaskStatusLabel(status: EventTaskStatus): string {
  const labels: Record<EventTaskStatus, string> = {
    PENDING: $localize`:@@pendingLabel:Pendiente`,
    IN_PROGRESS: $localize`:@@inProgressLabel:En curso`,
    COMPLETED: $localize`:@@taskCompletedLabel:Completada`,
    CANCELLED: $localize`:@@taskCancelledLabel:Cancelada`
  };
  return labels[status];
}

export function eventTaskPriorityLabel(priority: EventTaskPriority): string {
  const labels: Record<EventTaskPriority, string> = {
    LOW: $localize`:@@lowPriorityLabel:Baja`,
    MEDIUM: $localize`:@@mediumPriorityLabel:Media`,
    HIGH: $localize`:@@highPriorityLabel:Alta`,
    URGENT: $localize`:@@urgentPriorityLabel:Urgente`
  };
  return labels[priority];
}

export function eventParticipantRoleLabel(role: EventParticipantRole): string {
  const labels: Record<EventParticipantRole, string> = {
    OWNER: $localize`:@@ownerRoleLabel:Responsable`,
    COORDINATOR: $localize`:@@coordinatorRoleLabel:Coordinador`,
    STAFF: $localize`:@@staffRoleLabel:Equipo`,
    SUPPLIER: $localize`:@@supplierRoleLabel:Proveedor`,
    CLIENT_CONTACT: $localize`:@@clientContactRoleLabel:Contacto del cliente`,
    GUEST: $localize`:@@guestRoleLabel:Invitado`
  };
  return labels[role];
}

export function countryLabel(country: string): string {
  const labels: Record<string, string> = {
    CL: $localize`:@@countryChileLabel:Chile`,
    AR: $localize`:@@countryArgentinaLabel:Argentina`,
    BR: $localize`:@@countryBrazilLabel:Brasil`,
    MX: $localize`:@@countryMexicoLabel:México`,
    US: $localize`:@@countryUnitedStatesLabel:Estados Unidos`
  };
  return labels[country] ?? country;
}

export function currencyLabel(currency: string): string {
  const labels: Record<string, string> = {
    CLP: $localize`:@@currencyClpLabel:Peso chileno (CLP)`,
    USD: $localize`:@@currencyUsdLabel:Dólar estadounidense (USD)`,
    BRL: $localize`:@@currencyBrlLabel:Real brasileño (BRL)`,
    EUR: $localize`:@@currencyEurLabel:Euro (EUR)`
  };
  return labels[currency] ?? currency;
}

export function timezoneLabel(timezone: string): string {
  const labels: Record<string, string> = {
    "America/Santiago": $localize`:@@timezoneSantiagoLabel:Santiago, Chile`,
    "America/Sao_Paulo": $localize`:@@timezoneSaoPauloLabel:São Paulo, Brasil`,
    "America/New_York": $localize`:@@timezoneNewYorkLabel:Nueva York, Estados Unidos`,
    UTC: $localize`:@@timezoneUtcLabel:Tiempo universal (UTC)`
  };
  return labels[timezone] ?? timezone;
}

export function organizationRoleLabel(role: OrganizationRole): string {
  const labels: Record<OrganizationRole, string> = {
    OWNER: $localize`:@@ownerOrganizationRole:Propietario`,
    ADMIN: $localize`:@@adminOrganizationRole:Administrador`,
    MANAGER: $localize`:@@managerOrganizationRole:Gestor`,
    MEMBER: $localize`:@@memberOrganizationRole:Miembro`,
    VIEWER: $localize`:@@viewerOrganizationRole:Solo lectura`
  };
  return labels[role];
}
