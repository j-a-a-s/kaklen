import { normalizeNotificationLocale, renderPasswordResetEmail } from "./templates";

describe("password reset email templates", () => {
  it.each([
    ["es", "Recupera tu acceso a Kaklen"],
    ["en", "Reset your Kaklen password"],
    ["pt-BR", "Redefina sua senha do Kaklen"]
  ] as const)("renders a safe %s template", (locale, subject) => {
    const message = renderPasswordResetEmail(locale, {
      resetUrl: "http://localhost:4200/es/reset-password?token=a&next=<unsafe>",
      expiresMinutes: 30
    });

    expect(message.subject).toBe(subject);
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
