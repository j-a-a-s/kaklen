export type NotificationLocale = "es" | "en" | "pt-BR";

export const NOTIFICATION_TEMPLATES: Record<NotificationLocale, Record<string, string>> = {
  es: {
    organizationInvitationSubject: "Invitación a organización"
  },
  en: {
    organizationInvitationSubject: "Organization invitation"
  },
  "pt-BR": {
    organizationInvitationSubject: "Convite para organização"
  }
};
