import { BadRequestException } from "@nestjs/common";
import { assertMoneyPrecision, serializeMoney } from "./money-validation";

describe("money validation", () => {
  it("rejects fractional CLP values with a stable code", () => {
    expect(() => assertMoneyPrecision("1000.50", "CLP")).toThrow(BadRequestException);
    try {
      assertMoneyPrecision("1000.50", "CLP");
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: "CLP_FRACTION_NOT_ALLOWED" });
    }
  });

  it("accepts economic whole pesos and keeps two decimals for other currencies", () => {
    expect(serializeMoney("1000.00", "CLP")).toBe("1000");
    expect(serializeMoney("1000.5", "USD")).toBe("1000.50");
  });
});
