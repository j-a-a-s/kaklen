import { expect, test } from "@playwright/test";

const webBase = process.env.E2E_WEB_BASE_URL ?? "http://localhost:4200";
const locales = ["es", "en", "pt-BR"];
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 }
];

test.describe("Kaklen accessibility and responsive smoke", () => {
  test.setTimeout(180_000);

  for (const locale of locales) {
    for (const viewport of viewports) {
      test(`${locale} login has accessible structure on ${viewport.name}`, async ({ page }) => {
        const consoleErrors = [];
        page.on("console", (message) => {
          if (message.type() === "error") {
            consoleErrors.push(message.text());
          }
        });
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`${webBase}/${locale}/login`);

        await expect(page.locator(".brand")).toBeVisible();
        await expect(page.locator(".brand img")).toHaveJSProperty("complete", true);
        await expect(page.locator("form")).toBeVisible();
        await expect(page.locator("kaklen-locale-selector")).toHaveCount(1);
        await expect(page.locator("kaklen-version-badge")).toHaveCount(0);

        const layout = await page.evaluate(() => ({
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
          loadedBrandImages: Array.from(document.querySelectorAll("kaklen-brand-logo img")).every(
            (image) => image.complete && image.naturalWidth > 0
          )
        }));
        expect(layout.loadedBrandImages).toBe(true);
        expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);

        if (viewport.name === "desktop") {
          await expect(page.locator(".auth-brand-panel kaklen-brand-logo")).toBeVisible();
        }

        const violations = await page.evaluate(() => {
          const failures = [];
          const ids = new Set();
          for (const element of Array.from(document.querySelectorAll("[id]"))) {
            const id = element.getAttribute("id");
            if (!id) continue;
            if (ids.has(id)) {
              failures.push(`duplicate id ${id}`);
            }
            ids.add(id);
          }

          for (const input of Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea"))) {
            const id = input.getAttribute("id");
            const hasLabel = Boolean(input.closest("label")) || (id ? Boolean(document.querySelector(`label[for='${id}']`)) : false);
            const hasAccessibleName = hasLabel || Boolean(input.getAttribute("aria-label")) || Boolean(input.getAttribute("aria-labelledby"));
            if (!hasAccessibleName) {
              failures.push(`${input.tagName.toLowerCase()} missing accessible name`);
            }
          }

          for (const button of Array.from(document.querySelectorAll("button"))) {
            const hasName = Boolean(button.textContent?.trim()) || Boolean(button.getAttribute("aria-label")) || Boolean(button.getAttribute("aria-labelledby"));
            if (!hasName) {
              failures.push("button missing accessible name");
            }
          }

          for (const link of Array.from(document.querySelectorAll("a[href]"))) {
            const hasName = Boolean(link.textContent?.trim()) || Boolean(link.getAttribute("aria-label")) || Boolean(link.getAttribute("aria-labelledby"));
            if (!hasName) {
              failures.push(`link ${link.getAttribute("href")} missing accessible name`);
            }
          }

          for (const image of Array.from(document.querySelectorAll("img"))) {
            if (!image.hasAttribute("alt")) {
              failures.push("image missing alt");
            }
          }

          if (!document.querySelector("main")) {
            failures.push("missing main landmark");
          }
          return failures;
        });

        expect(violations).toEqual([]);
        expect(consoleErrors).toEqual([]);
      });
    }
  }

  test("English and Brazilian Portuguese login pages do not show core Spanish login copy", async ({ page }) => {
    const forbiddenSpanish = ["Iniciar sesión", "Contraseña", "Ingresar", "¿Aún no tienes cuenta?"];
    for (const locale of ["en", "pt-BR"]) {
      await page.goto(`${webBase}/${locale}/login`);
      const visibleText = await page.locator("body").innerText();
      for (const text of forbiddenSpanish) {
        expect(visibleText).not.toContain(text);
      }
    }
  });
});
