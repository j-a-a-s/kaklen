# Quotation Money Calculation

## Shared Algorithm

Frontend and API call `calculateQuotationMoney` from `@kaklen/shared`. The function uses scaled `bigint` values, never binary floating point, with these scales:

- money: 2 decimal places;
- quantity: 3 decimal places;
- percentage: 2 decimal places.

Values are rounded half-up when reducing scale. API output remains decimal strings and Prisma stores `Decimal` values.

## Order Of Operations

For each line:

1. `subtotal = quantity * unitPrice`;
2. apply the explicit line discount when its type is `PERCENTAGE` or `FIXED`;
3. otherwise apply the quotation global discount;
4. cap discount at the line subtotal;
5. `taxableBase = subtotal - discountTotal`;
6. `taxTotal = taxableBase * taxPercent`;
7. `total = taxableBase + taxTotal`.

The global discount therefore applies only to lines without a specific discount. A zero tax percentage represents an exempt line. Totals are sums of the already rounded line amounts.

## Invariants

- Global and percentage discounts are between 0 and 100.
- Fixed discounts and prices are non-negative.
- Quantity is greater than zero.
- A 100% discount produces a zero taxable base and zero tax.
- Changing quantity, price, discount, tax, adding a line, or removing a line recalculates the sticky summary synchronously.

Exact regression cases, including `0%`, `5%`, `100%`, invalid ranges, fixed discounts, exemptions, and mixed taxes, live in `packages/shared/tests/quotation-money.test.mjs` and the quotation API tests.
