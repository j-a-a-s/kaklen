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

  test("assisted authenticated surfaces expose accessible controls and focus behavior", async ({ page }) => {
    await loginDemo(page);
    const organizationId = await page.evaluate(() => localStorage.getItem("kaklen.activeOrganizationId"));
    expect(organizationId).toBeTruthy();

    const paths = [
      `/organizations/${organizationId}`,
      `/organizations/${organizationId}/clients/new`,
      `/organizations/${organizationId}/quotations/new`,
      `/organizations/${organizationId}/events/new`
    ];
    for (const path of paths) {
      await navigateSpa(page, path);
      await expect(page.locator("main").last()).toBeVisible();
      await expectAccessibleControls(page);
      await expectNoHorizontalOverflow(page);
    }

    await navigateSpa(page, `/organizations/${organizationId}/clients`);
    const clientHref = await page.locator(`a[href*="/organizations/${organizationId}/clients/"]`).filter({ hasNotText: "Nuevo cliente" }).first().getAttribute("href");
    expect(clientHref).toBeTruthy();
    await navigateSpa(page, clientHref.replace(/^\/es/, ""));
    await expect(page.getByRole("heading", { name: "Línea de tiempo" })).toBeVisible();
    await expectAccessibleControls(page);

    await page.keyboard.press("Control+K");
    const dialog = page.getByRole("dialog", { name: "¿Qué necesitas hacer?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("searchbox")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.locator(".command-trigger")).toBeFocused();
  });

  test("assisted dashboard and mobile navigation avoid horizontal overflow in required viewports", async ({ page }) => {
    await loginDemo(page);
    const organizationId = await page.evaluate(() => localStorage.getItem("kaklen.activeOrganizationId"));
    for (const viewport of viewports.concat([{ name: "compact-desktop", width: 1366, height: 768 }])) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await navigateSpa(page, `/organizations/${organizationId}`);
      await expectNoHorizontalOverflow(page);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Abrir navegación" }).click();
    await expect(page.locator("#authenticated-navigation")).toBeVisible();
    await expectAccessibleControls(page);
  });
});

async function loginDemo(page) {
  await page.goto(`${webBase}/es/login`);
  await page.getByLabel("Email").fill("empresa.angela@demo.kaklen.local");
  await page.getByLabel("Contraseña").fill("KaklenDemo2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/es\/dashboard$/);
  await expect(page.locator("kaklen-dashboard")).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("kaklen.activeOrganizationId"))).not.toBeNull();
}

async function expectAccessibleControls(page) {
  const violations = await page.evaluate(() => {
    const failures = [];
    const ids = new Set();
    for (const element of Array.from(document.querySelectorAll("[id]"))) {
      const id = element.getAttribute("id");
      if (!id) continue;
      if (ids.has(id)) failures.push(`duplicate id ${id}`);
      ids.add(id);
    }
    for (const control of Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea, button"))) {
      const id = control.getAttribute("id");
      const wrapped = Boolean(control.closest("label"));
      const explicit = id ? Boolean(document.querySelector(`label[for='${id}']`)) : false;
      const text = control.tagName === "BUTTON" ? control.textContent?.trim() : "";
      if (!wrapped && !explicit && !text && !control.getAttribute("aria-label") && !control.getAttribute("aria-labelledby")) {
        failures.push(`${control.tagName.toLowerCase()} missing accessible name`);
      }
    }
    return failures;
  });
  expect(violations).toEqual([]);
}

async function expectNoHorizontalOverflow(page) {
  const layout = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
}

async function navigateSpa(page, route) {
  const localizedRoute = `/es${route}`;
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, localizedRoute);
  await expect(page).toHaveURL(new RegExp(`${localizedRoute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  await page.locator("main").last().waitFor();
}
