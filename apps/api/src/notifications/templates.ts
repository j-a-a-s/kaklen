export type NotificationLocale = "es" | "en" | "pt-BR";

export interface PasswordResetEmail {
  subject: string;
  text: string;
  html: string;
}

interface PasswordResetTemplateInput {
  resetUrl: string;
  expiresMinutes: number;
}

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

export function normalizeNotificationLocale(locale: string | null | undefined): NotificationLocale {
  return locale === "en" || locale === "pt-BR" ? locale : "es";
}

export function renderPasswordResetEmail(
  locale: NotificationLocale,
  input: PasswordResetTemplateInput
): PasswordResetEmail {
  const templates: Record<NotificationLocale, PasswordResetEmail> = {
    es: buildTemplate("es", {
      subject: "Recupera tu acceso a Kaklen",
      greeting: "Hola,",
      explanation: "Recibimos una solicitud para restablecer la contraseña de tu cuenta Kaklen.",
      action: "Restablecer contraseña",
      expiry: `Este enlace es válido por ${input.expiresMinutes} minutos.`,
      ignore: "Si no solicitaste este cambio, puedes ignorar este correo."
    }, input.resetUrl),
    en: buildTemplate("en", {
      subject: "Reset your Kaklen password",
      greeting: "Hello,",
      explanation: "We received a request to reset the password for your Kaklen account.",
      action: "Reset password",
      expiry: `This link is valid for ${input.expiresMinutes} minutes.`,
      ignore: "If you did not request this change, you can ignore this email."
    }, input.resetUrl),
    "pt-BR": buildTemplate("pt-BR", {
      subject: "Redefina sua senha do Kaklen",
      greeting: "Olá,",
      explanation: "Recebemos uma solicitação para redefinir a senha da sua conta Kaklen.",
      action: "Redefinir senha",
      expiry: `Este link é válido por ${input.expiresMinutes} minutos.`,
      ignore: "Se você não solicitou esta alteração, ignore este e-mail."
    }, input.resetUrl)
  };

  return templates[locale];
}

interface TemplateCopy {
  subject: string;
  greeting: string;
  explanation: string;
  action: string;
  expiry: string;
  ignore: string;
}

function buildTemplate(
  locale: NotificationLocale,
  copy: TemplateCopy,
  resetUrl: string
): PasswordResetEmail {
  const escapedUrl = escapeHtml(resetUrl);
  return {
    subject: copy.subject,
    text: [
      copy.greeting,
      "",
      copy.explanation,
      "",
      `${copy.action}: ${resetUrl}`,
      "",
      copy.expiry,
      copy.ignore
    ].join("\n"),
    html: `<!doctype html>
<html lang="${locale}">
  <body style="margin:0;background:#f4f6f8;color:#111827;font-family:Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;padding:32px 20px">
      <div style="background:#ffffff;border:1px solid #dbe1e8;padding:32px">
        <p>${escapeHtml(copy.greeting)}</p>
        <p>${escapeHtml(copy.explanation)}</p>
        <p style="margin:28px 0">
          <a href="${escapedUrl}" style="display:inline-block;background:#165dcc;color:#ffffff;padding:12px 18px;text-decoration:none;font-weight:700">${escapeHtml(copy.action)}</a>
        </p>
        <p style="font-size:14px;color:#4b5563">${escapeHtml(copy.expiry)}</p>
        <p style="font-size:14px;color:#4b5563">${escapeHtml(copy.ignore)}</p>
        <p style="margin-top:28px;font-size:12px;color:#6b7280;word-break:break-all">${escapedUrl}</p>
      </div>
    </div>
  </body>
</html>`
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
