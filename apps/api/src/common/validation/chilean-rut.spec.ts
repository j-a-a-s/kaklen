import { formatChileanRut, isValidChileanRut, normalizeChileanRut } from "./chilean-rut";

describe("Chilean RUT validation", () => {
  it("accepts valid RUT values", () => {
    expect(isValidChileanRut("12.345.678-5")).toBe(true);
    expect(isValidChileanRut("12345678-5")).toBe(true);
    expect(isValidChileanRut("5.000.001-K")).toBe(true);
    expect(isValidChileanRut("5.000.001-k")).toBe(true);
  });

  it("rejects invalid or incomplete RUT values", () => {
    expect(isValidChileanRut("12.345.678-9")).toBe(false);
    expect(isValidChileanRut("123")).toBe(false);
    expect(isValidChileanRut("12.345.678-X")).toBe(false);
  });

  it("normalizes and formats RUT values", () => {
    expect(normalizeChileanRut("12.345.678-5")).toBe("123456785");
    expect(formatChileanRut("5000001k")).toBe("5.000.001-K");
  });
});
