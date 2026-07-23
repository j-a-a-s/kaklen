import {
  escapeHtml,
  normalizeProviderMessageId,
  normalizeReferrer,
  providerFailureCode,
  sanitizeMailHeader
} from "./lead-sanitization";

describe("lead sanitization", () => {
  it("escapes all HTML-significant characters", () => {
    expect(escapeHtml(`<img src="x" onerror='alert(1)'>&`)).toBe(
      "&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;&amp;"
    );
  });

  it("prevents mail header injection", () => {
    expect(sanitizeMailHeader("Ada\r\nBcc: attacker@example.com")).toBe(
      "Ada Bcc: attacker@example.com"
    );
  });

  it("minimizes referrers by dropping credentials, query and fragment", () => {
    expect(
      normalizeReferrer("https://user:secret@example.com/path?token=secret#section")
    ).toBe("https://example.com/path");
    expect(normalizeReferrer("javascript:alert(1)")).toBeNull();
    expect(normalizeReferrer("not a URL")).toBeNull();
  });

  it("never persists raw provider error messages", () => {
    expect(providerFailureCode(new Error("Bearer top-secret-token"))).toBe(
      "WHATSAPP_SEND_FAILED"
    );
    expect(providerFailureCode({ code: "PROVIDER_TIMEOUT", message: "secret" })).toBe(
      "PROVIDER_TIMEOUT"
    );
  });

  it("normalizes opaque provider identifiers", () => {
    expect(normalizeProviderMessageId("  provider\r\n-id\u0000  ")).toBe("provider-id");
  });
});
