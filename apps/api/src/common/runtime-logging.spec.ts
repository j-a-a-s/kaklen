import { redactSecret } from "./runtime-logging";

describe("runtime logging", () => {
  it("redacts secrets recursively", () => {
    expect(
      redactSecret({
        Authorization: "Bearer token",
        nested: {
          password: "secret",
          safe: "value"
        }
      })
    ).toEqual({
      Authorization: "[REDACTED]",
      nested: {
        password: "[REDACTED]",
        safe: "value"
      }
    });
  });
});
