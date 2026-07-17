export type NotificationLocale = "es" | "en" | "pt-BR";

export interface PasswordResetEmail {
  subject: string;
  text: string;
  html: string;
}

export interface EmailVerificationEmail {
  subject: string;
  text: string;
  html: string;
}

export interface QuotationEmailContent {
  text: string;
  html: string;
}

interface QuotationTemplateInput {
  organizationName: string;
  quotationNumber: string;
  clientName: string;
  message: string;
}

interface PasswordResetTemplateInput {
  resetUrl: string;
  expiresMinutes: number;
}

interface EmailVerificationTemplateInput {
  verificationUrl: string;
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
      expiry: `Este enlace es válido por ${formatDuration("es", input.expiresMinutes)}.`,
      ignore: "Si no solicitaste este cambio, puedes ignorar este correo.",
      fallback: "Si el botón no funciona, copia y pega este enlace en tu navegador:"
    }, input.resetUrl),
    en: buildTemplate("en", {
      subject: "Reset your Kaklen password",
      greeting: "Hello,",
      explanation: "We received a request to reset the password for your Kaklen account.",
      action: "Reset password",
      expiry: `This link is valid for ${formatDuration("en", input.expiresMinutes)}.`,
      ignore: "If you did not request this change, you can ignore this email.",
      fallback: "If the button does not work, copy and paste this link into your browser:"
    }, input.resetUrl),
    "pt-BR": buildTemplate("pt-BR", {
      subject: "Redefina sua senha do Kaklen",
      greeting: "Olá,",
      explanation: "Recebemos uma solicitação para redefinir a senha da sua conta Kaklen.",
      action: "Redefinir senha",
      expiry: `Este link é válido por ${formatDuration("pt-BR", input.expiresMinutes)}.`,
      ignore: "Se você não solicitou esta alteração, ignore este e-mail.",
      fallback: "Se o botão não funcionar, copie e cole este link no navegador:"
    }, input.resetUrl)
  };

  return templates[locale];
}

export function renderEmailVerificationEmail(
  locale: NotificationLocale,
  input: EmailVerificationTemplateInput
): EmailVerificationEmail {
  const templates: Record<NotificationLocale, EmailVerificationEmail> = {
    es: buildTemplate("es", {
      subject: "Confirma tu cuenta de Kaklen",
      greeting: "Hola,",
      explanation: "Tu cuenta de Kaklen fue creada. Confirma tu dirección de correo para poder iniciar sesión.",
      action: "Confirmar correo",
      expiry: `Este enlace es válido por ${formatDuration("es", input.expiresMinutes)}.`,
      ignore: "Si no creaste esta cuenta, puedes ignorar este correo.",
      fallback: "Si el botón no funciona, copia y pega este enlace en tu navegador:"
    }, input.verificationUrl),
    en: buildTemplate("en", {
      subject: "Confirm your Kaklen account",
      greeting: "Hello,",
      explanation: "Your Kaklen account has been created. Confirm your email address before signing in.",
      action: "Confirm email",
      expiry: `This link is valid for ${formatDuration("en", input.expiresMinutes)}.`,
      ignore: "If you did not create this account, you can ignore this email.",
      fallback: "If the button does not work, copy and paste this link into your browser:"
    }, input.verificationUrl),
    "pt-BR": buildTemplate("pt-BR", {
      subject: "Confirme sua conta do Kaklen",
      greeting: "Olá,",
      explanation: "Sua conta do Kaklen foi criada. Confirme seu endereço de e-mail antes de entrar.",
      action: "Confirmar e-mail",
      expiry: `Este link é válido por ${formatDuration("pt-BR", input.expiresMinutes)}.`,
      ignore: "Se você não criou esta conta, ignore este e-mail.",
      fallback: "Se o botão não funcionar, copie e cole este link no navegador:"
    }, input.verificationUrl)
  };

  return templates[locale];
}

export function renderQuotationEmail(
  locale: NotificationLocale,
  input: QuotationTemplateInput
): QuotationEmailContent {
  const copy: Record<NotificationLocale, { heading: string; introduction: string; attachment: string; closing: string }> = {
    es: {
      heading: `Cotización ${input.quotationNumber}`,
      introduction: `Hola ${input.clientName}, ${input.organizationName} te envía la siguiente cotización.`,
      attachment: "Encontrarás el documento PDF adjunto a este correo.",
      closing: "Este correo fue enviado desde Kaklen."
    },
    en: {
      heading: `Quotation ${input.quotationNumber}`,
      introduction: `Hello ${input.clientName}, ${input.organizationName} has sent you the following quotation.`,
      attachment: "The PDF document is attached to this email.",
      closing: "This email was sent from Kaklen."
    },
    "pt-BR": {
      heading: `Cotação ${input.quotationNumber}`,
      introduction: `Olá ${input.clientName}, ${input.organizationName} enviou a seguinte cotação.`,
      attachment: "O documento PDF está anexado a este e-mail.",
      closing: "Este e-mail foi enviado pelo Kaklen."
    }
  };
  const selected = copy[locale];
  return {
    text: [selected.heading, "", selected.introduction, "", input.message, "", selected.attachment, "", selected.closing].join("\n"),
    html: `<!doctype html>
<html lang="${locale}">
  <body style="margin:0;background:#f4f6f8;color:#14213a;font-family:Arial,sans-serif">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px">
      <div style="background:#ffffff;border:1px solid #dce3ec;border-radius:8px;padding:32px">
        <h1 style="margin:0 0 20px;font-size:22px">${escapeHtml(selected.heading)}</h1>
        <p>${escapeHtml(selected.introduction)}</p>
        <div style="margin:24px 0;padding:16px;border-left:4px solid #1769d2;background:#f8fafc;white-space:pre-line">${escapeHtml(input.message)}</div>
        <p>${escapeHtml(selected.attachment)}</p>
        <p style="margin-top:28px;font-size:12px;color:#627087">${escapeHtml(selected.closing)}</p>
      </div>
    </div>
  </body>
</html>`
  };
}

interface TemplateCopy {
  subject: string;
  greeting: string;
  explanation: string;
  action: string;
  expiry: string;
  ignore: string;
  fallback: string;
}

function buildTemplate(
  locale: NotificationLocale,
  copy: TemplateCopy,
  actionUrl: string
): PasswordResetEmail {
  const escapedUrl = escapeHtml(actionUrl);
  return {
    subject: copy.subject,
    text: [
      "KAKLEN",
      "",
      copy.greeting,
      "",
      copy.explanation,
      "",
      `${copy.action}: ${actionUrl}`,
      "",
      copy.expiry,
      copy.ignore,
      "",
      copy.fallback,
      actionUrl
    ].join("\n"),
    html: `<!doctype html>
<html lang="${locale}">
  <body style="margin:0;background:#f4f6f8;color:#111827;font-family:Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;padding:32px 20px">
      <div style="background:#ffffff;border:1px solid #dbe1e8;padding:32px">
        <p style="margin:0 0 28px;color:#165dcc;font-size:14px;font-weight:700;letter-spacing:2px">KAKLEN</p>
        <p>${escapeHtml(copy.greeting)}</p>
        <p>${escapeHtml(copy.explanation)}</p>
        <p style="margin:28px 0">
          <a href="${escapedUrl}" style="display:inline-block;background:#165dcc;color:#ffffff;padding:12px 18px;text-decoration:none;font-weight:700">${escapeHtml(copy.action)}</a>
        </p>
        <p style="font-size:14px;color:#4b5563">${escapeHtml(copy.expiry)}</p>
        <p style="font-size:14px;color:#4b5563">${escapeHtml(copy.ignore)}</p>
        <p style="margin-top:28px;font-size:12px;color:#6b7280">${escapeHtml(copy.fallback)}</p>
        <p style="font-size:12px;color:#6b7280;overflow-wrap:anywhere">${escapedUrl}</p>
      </div>
    </div>
  </body>
</html>`
  };
}

function formatDuration(locale: NotificationLocale, minutes: number): string {
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    if (locale === "en") return `${days} ${days === 1 ? "day" : "days"}`;
    if (locale === "pt-BR") return `${days} ${days === 1 ? "dia" : "dias"}`;
    return `${days} ${days === 1 ? "día" : "días"}`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    if (locale === "en") return `${hours} ${hours === 1 ? "hour" : "hours"}`;
    if (locale === "pt-BR") return `${hours} ${hours === 1 ? "hora" : "horas"}`;
    return `${hours} ${hours === 1 ? "hora" : "horas"}`;
  }
  if (locale === "en") return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
