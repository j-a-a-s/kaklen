import { serializeJsonLd } from "./safe-json-ld";

describe("serializeJsonLd", () => {
  it("prevents an embedded closing script tag from breaking out of JSON-LD", () => {
    const serialized = serializeJsonLd({
      name: "</script><script>alert('xss')</script>",
      separator: "\u2028"
    });

    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c/script\\u003e");
    expect(serialized).toContain("\\u2028");
    expect(JSON.parse(serialized).name).toBe("</script><script>alert('xss')</script>");
  });
});
