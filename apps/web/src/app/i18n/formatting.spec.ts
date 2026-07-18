import { formatRegionalMoneyValue } from "./formatting";

describe("regional money value formatting", () => {
  it("uses currency precision without adding a currency symbol", () => {
    expect(formatRegionalMoneyValue("150000", { currency: "CLP", numberFormat: "es" })).toBe("150.000");
    expect(formatRegionalMoneyValue("800", { currency: "BRL", numberFormat: "es" })).toBe("800,00");
    expect(formatRegionalMoneyValue("100.5", { currency: "EUR", numberFormat: "es" })).toBe("100,50");
    expect(formatRegionalMoneyValue("500.25", { currency: "USD", numberFormat: "en" })).toBe("500.25");
  });
});
