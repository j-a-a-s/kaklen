#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createI18nServer, isFile, readText, resolveLocaleRoot, supportedLocales } from "./i18n-server.mjs";

const distRoot = resolve("apps/web/dist/web");
const expectedBaseHref = {
  es: "/es/",
  en: "/en/",
  "pt-BR": "/pt-BR/"
};

console.log("KAKLEN I18N SERVER VERIFY");

if (process.env.I18N_SKIP_BUILD === "true") {
  console.log("✓ Localized builds reutilizados");
} else {
  for (const locale of supportedLocales) {
    await run("pnpm", ["--filter", "@kaklen/web", `build:${locale}`]);
  }
}

const localeChecks = supportedLocales.map((locale) => verifyLocaleFiles(locale));
const server = createI18nServer({ distRoot, port: 0, logRequests: false });

try {
  const origin = await listen(server);
  await verifyHttp(origin, localeChecks);
  mkdirSync(resolve("artifacts"), { recursive: true });
  writeFileSync(
    resolve("artifacts/i18n-server.json"),
    `${JSON.stringify({ status: "passed", locales: [...supportedLocales], runtimeConfig: true, isolatedBuilds: true }, null, 2)}\n`
  );
  console.log("✓ i18n server listo");
} finally {
  await close(server);
}

function verifyLocaleFiles(locale) {
  const localeRoot = resolveLocaleRoot(distRoot, locale);
  const indexPath = join(localeRoot, "index.html");

  assert.equal(isFile(indexPath), true, `${locale}: falta index.html en ${localeRoot}`);
  const index = readText(indexPath);
  assert.match(index, new RegExp(`<base href="${escapeRegExp(expectedBaseHref[locale])}">`), `${locale}: base href inválido`);

  const scripts = scriptSources(index);
  assert.ok(scripts.length > 0, `${locale}: no hay bundles JS en index.html`);
  for (const script of scripts) {
    assert.equal(isFile(join(localeRoot, script)), true, `${locale}: falta bundle JS ${script}`);
  }

  const styles = styleHrefs(index);
  assert.ok(styles.length > 0, `${locale}: no hay CSS en index.html`);
  for (const style of styles) {
    assert.equal(isFile(join(localeRoot, style)), true, `${locale}: falta CSS ${style}`);
  }

  assert.equal(isFile(join(localeRoot, "runtime-config.json")), true, `${locale}: falta runtime-config.json`);
  assert.equal(isFile(join(localeRoot, "runtime-config.js")), true, `${locale}: falta runtime-config.js`);
  console.log(`✓ ${locale} index ${indexPath}`);
  console.log(`✓ ${locale} base href ${expectedBaseHref[locale]}`);
  console.log(`✓ ${locale} bundles ${scripts.join(", ")}`);
  console.log(`✓ ${locale} styles ${styles.join(", ")}`);

  return { locale, localeRoot, scripts, styles };
}

async function verifyHttp(origin, localeChecks) {
  const root = await request(`${origin}/`);
  assert.equal(root.status, 200, "root debe responder con bootstrap de locale");
  assert.match(root.body, /window\.location\.replace\("\/" \+ normalized \+ "\/login"\)/);
  console.log("✓ / locale bootstrap");

  for (const check of localeChecks) {
    const login = await request(`${origin}/${check.locale}/login`);
    assert.equal(login.status, 200, `${check.locale}: /login debe responder 200`);
    assert.match(login.contentType, /^text\/html\b/, `${check.locale}: /login debe ser HTML`);
    assert.match(login.body, new RegExp(`<base href="${escapeRegExp(expectedBaseHref[check.locale])}">`));
    console.log(`✓ /${check.locale}/login 200 ${login.contentType}`);

    const runtime = await request(`${origin}/${check.locale}/runtime-config.json`);
    assert.equal(runtime.status, 200, `${check.locale}: runtime-config.json debe responder 200`);
    assert.match(runtime.contentType, /^application\/json\b/, `${check.locale}: runtime-config.json debe ser JSON`);
    console.log(`✓ /${check.locale}/runtime-config.json 200 ${runtime.contentType}`);

    const runtimeScript = await request(`${origin}/${check.locale}/runtime-config.js`);
    assert.equal(runtimeScript.status, 200, `${check.locale}: runtime-config.js debe responder 200`);
    assert.match(runtimeScript.contentType, /^application\/javascript\b/, `${check.locale}: runtime-config.js debe ser JavaScript`);
    console.log(`✓ /${check.locale}/runtime-config.js 200 ${runtimeScript.contentType}`);

    for (const script of check.scripts) {
      const jsPath = `/${check.locale}/${script}`;
      const bundle = await request(`${origin}${jsPath}`);
      assert.equal(bundle.status, 200, `${check.locale}: ${jsPath} debe responder 200`);
      assert.match(bundle.contentType, /^application\/javascript\b/, `${check.locale}: bundle JS debe tener MIME application/javascript`);
      assert.doesNotMatch(bundle.body.slice(0, 120), /<!doctype html>|<html/i, `${check.locale}: bundle JS no debe devolver HTML`);
      console.log(`✓ ${jsPath} 200 ${bundle.contentType}`);
    }

    for (const style of check.styles) {
      const cssPath = `/${check.locale}/${style}`;
      const stylesheet = await request(`${origin}${cssPath}`);
      assert.equal(stylesheet.status, 200, `${check.locale}: ${cssPath} debe responder 200`);
      assert.match(stylesheet.contentType, /^text\/css\b/, `${check.locale}: CSS debe tener MIME text/css`);
      assert.doesNotMatch(stylesheet.body.slice(0, 120), /<!doctype html>|<html/i, `${check.locale}: CSS no debe devolver HTML`);
      console.log(`✓ ${cssPath} 200 ${stylesheet.contentType}`);
    }

    const missingAsset = await request(`${origin}/${check.locale}/missing-bundle.js`);
    assert.equal(missingAsset.status, 404, `${check.locale}: asset inexistente debe devolver 404`);
    assert.doesNotMatch(missingAsset.contentType, /^text\/html\b/, `${check.locale}: asset inexistente no debe devolver HTML`);
    console.log(`✓ /${check.locale}/missing-bundle.js 404`);
  }
}

function scriptSources(index) {
  return Array.from(index.matchAll(/<script src="([^"]+\.js)" type="module"><\/script>/g), (match) => match[1]).filter(
    (src) => !src.startsWith("/")
  );
}

function styleHrefs(index) {
  return Array.from(
    new Set(
      Array.from(index.matchAll(/<link rel="stylesheet" href="([^"]+\.css)"[^>]*>/g), (match) => match[1]).filter(
        (href) => !href.startsWith("/")
      )
    )
  );
}

function listen(server) {
  return new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address === "object", "servidor sin puerto asignado");
      resolveListen(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server) {
  return new Promise((resolveClose) => server.close(() => resolveClose()));
}

async function request(url) {
  const response = await fetch(url);
  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    body: await response.text()
  };
}

function run(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false });
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} interrupted by ${signal}`));
        return;
      }
      if (code === 0) {
        resolveRun();
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? 1}`));
    });
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
