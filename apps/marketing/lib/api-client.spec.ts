import type { ContactFormValues } from "./validation";
import { submitLead } from "./api-client";

describe("submitLead", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.useRealTimers();
  });

  it("accepts only the documented success contract", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        leadReference: "5d0786e8-591d-47a2-8854-e28e3452c4c7",
        whatsapp: { scheduled: false }
      })
    );

    await expect(submitLead(validValues())).resolves.toEqual({
      success: true,
      leadReference: "5d0786e8-591d-47a2-8854-e28e3452c4c7",
      whatsapp: { scheduled: false }
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/leads",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        credentials: "omit"
      })
    );
  });

  it("maps backend codes without rendering a backend-controlled message", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          code: "LEAD_PHONE_INVALID",
          message: "<script>stealCookies()</script>",
          statusCode: 400
        },
        400
      )
    );

    const result = await submitLead(validValues());

    expect(result).toEqual({
      success: false,
      code: "LEAD_PHONE_INVALID",
      message: "Ingresa un teléfono válido para el país seleccionado."
    });
    expect(JSON.stringify(result)).not.toContain("stealCookies");
  });

  it("rejects malformed or non-JSON success responses", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>not JSON</html>", {
        status: 200,
        headers: { "Content-Type": "text/html" }
      })
    );

    await expect(submitLead(validValues())).resolves.toMatchObject({
      success: false,
      code: "NETWORK_ERROR"
    });
  });

  it("minimizes browser metadata before transmission", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        leadReference: "5d0786e8-591d-47a2-8854-e28e3452c4c7",
        whatsapp: { scheduled: false }
      })
    );

    await submitLead(validValues(), {
      landingPage: "/contacto",
      referrer: "https://user:secret@example.com/path?token=secret#section",
      utmSource: "<img src=x>",
      utmCampaign: " alpha "
    });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(requestInit.body)) as Record<string, unknown>;
    expect(body.referrer).toBe("https://example.com/path");
    expect(body.utmCampaign).toBe("alpha");
    expect(body).not.toHaveProperty("utmSource");
    expect(JSON.stringify(body)).not.toContain("secret");
  });

  it("distinguishes a request timeout from invalid credentials or validation", async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        })
    );

    const pending = submitLead(validValues(), {}, 25);
    await jest.advanceTimersByTimeAsync(25);

    await expect(pending).resolves.toMatchObject({
      success: false,
      code: "REQUEST_TIMEOUT"
    });
  });
});

function validValues(): ContactFormValues {
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
    website: ""
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
