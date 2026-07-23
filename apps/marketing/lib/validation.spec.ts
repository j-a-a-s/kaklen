import { contactFormSchema, type ContactFormValues } from "./validation";

describe("contactFormSchema", () => {
  it("accepts accented names and multiline messages", () => {
    expect(
      contactFormSchema.parse(
        validValues({
          firstName: "Ángela María",
          lastName: "O'Connor-Pérez",
          message: "Primera línea.\nSegunda línea con <detalle>."
        })
      )
    ).toMatchObject({
      firstName: "Ángela María",
      lastName: "O'Connor-Pérez"
    });
  });

  it.each([
    { firstName: "<script>alert(1)</script>" },
    { lastName: "Pérez\r\nBcc: attacker@example.com" },
    { company: "<img src=x onerror=alert(1)>" },
    { phone: "9123\r\n45678" },
    { message: "Mensaje válido\u0000con control" },
    { website: "https://spam.example" }
  ])("rejects hostile or automated form input: %o", (override) => {
    expect(contactFormSchema.safeParse(validValues(override)).success).toBe(false);
  });
});

function validValues(overrides: Partial<ContactFormValues> = {}): ContactFormValues {
  return {
    firstName: "Ángela",
    lastName: "Pérez",
    email: "angela@example.com",
    countryCode: "CL",
    phone: "9 1234 5678",
    company: "Kaklen",
    position: "Gerencia",
    country: "Chile",
    interestType: "KAKLEN",
    message: "Necesito conocer la plataforma.",
    privacyConsent: true,
    whatsappConsent: false,
    website: "",
    ...overrides
  };
}
