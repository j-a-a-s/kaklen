import { normalizeNotificationLocale, renderPasswordResetEmail, renderQuotationEmail } from "./templates";

describe("password reset email templates", () => {
  it.each([
    ["es", "Recupera tu acceso a Kaklen", "Restablecer contraseña", "copia y pega"],
    ["en", "Reset your Kaklen password", "Reset password", "copy and paste"],
    ["pt-BR", "Redefina sua senha do Kaklen", "Redefinir senha", "copie e cole"]
  ] as const)("renders a safe and complete %s template", (locale, subject, action, fallback) => {
    const message = renderPasswordResetEmail(locale, {
      resetUrl: "http://localhost:4200/es/reset-password?token=a&next=<unsafe>",
      expiresMinutes: 30
    });

    expect(message.subject).toBe(subject);
    expect(message.text).toContain("KAKLEN");
    expect(message.text).toContain(action);
    expect(message.text).toContain(fallback);
    expect(message.text).toContain("30");
    expect(message.html).toContain("KAKLEN");
    expect(message.html).toContain(action);
    expect(message.html).toContain(fallback);
    expect(message.text).toContain("token=a&next=<unsafe>");
    expect(message.html).toContain("token=a&amp;next=&lt;unsafe&gt;");
    expect(message.html).not.toContain("next=<unsafe>");
  });

  it("falls back to Spanish for unsupported or missing locales", () => {
    expect(normalizeNotificationLocale("en")).toBe("en");
    expect(normalizeNotificationLocale("pt-BR")).toBe("pt-BR");
    expect(normalizeNotificationLocale("fr")).toBe("es");
    expect(normalizeNotificationLocale(undefined)).toBe("es");
  });
});

describe("quotation email templates", () => {
  it.each([
    ["es", "Cotización QUO-000001 v1", "documento PDF adjunto"],
    ["en", "Quotation QUO-000001 v1", "PDF document is attached"],
    ["pt-BR", "Cotação QUO-000001 v1", "documento PDF está anexado"]
  ] as const)("renders localized and escaped %s content", (locale, heading, attachmentCopy) => {
    const message = renderQuotationEmail(locale, {
      organizationName: "Kaklen & Co",
      quotationNumber: "QUO-000001 v1",
      clientName: "Ada <Lovelace>",
      message: "Please review <script>alert(1)</script>"
    });

    expect(message.text).toContain(heading);
    expect(message.text).toContain(attachmentCopy);
    expect(message.html).toContain("Ada &lt;Lovelace&gt;");
    expect(message.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(message.html).not.toContain("<script>");
  });
});
