import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sourceMessages = readText("apps/web/src/locale/messages.xlf");
const spanishMessages = readText("apps/web/src/locale/messages.es.xlf");
const englishMessages = readText("apps/web/src/locale/messages.en.xlf");
const portugueseMessages = readText("apps/web/src/locale/messages.pt-BR.xlf");

test("locale switching replaces only the locale prefix", () => {
  const localeService = readText("apps/web/src/app/i18n/locale.service.ts");

  assert.match(localeService, /localizedUrl\(locale: SupportedLocale/);
  assert.match(localeService, /removeLeadingLocale\(location\.pathname\)/);
  assert.match(localeService, /location\.search/);
  assert.match(localeService, /location\.hash/);
  assert.match(localeService, /window\.location\.assign\(this\.localizedUrl\(locale\)\)/);
});

test("locale service preserves internal routes, query params, and fragments", () => {
  assert.equal(localizedPath("pt-BR", "/es/organizations/123/clients", "?page=2", "#notes"), "/pt-BR/organizations/123/clients?page=2#notes");
  assert.equal(localizedPath("en", "/es/login", "", ""), "/en/login");
  assert.equal(localizedPath("pt-BR", "/organizations/123/clients", "", ""), "/pt-BR/organizations/123/clients");
});

test("root redirect supports stored locale, browser locale, and es fallback", () => {
  const i18nServer = readText("scripts/i18n-server.mjs");

  assert.match(i18nServer, /localStorage\.getItem\("kaklen\.locale"\)/);
  assert.match(i18nServer, /navigator\.language/);
  assert.match(i18nServer, /window\.location\.replace\("\/" \+ normalized \+ "\/login"\)/);
  assert.match(i18nServer, /browser\.startsWith\("pt"\) \? "pt-BR" : browser\.startsWith\("en"\) \? "en" : "es"/);
});

test("localized builds use locale baseHref and fail on missing translations", () => {
  const angular = readText("apps/web/angular.json");

  for (const locale of ["es", "en", "pt-BR"]) {
    assert.match(angular, new RegExp(`"baseHref": "/${escapeRegExp(locale)}/"`));
  }
  assert.equal(countMatches(angular, /"i18nMissingTranslation": "error"/g), 3);
});

test("dev:i18n builds and serves the three localized prefixes", () => {
  const packageJson = readText("package.json");
  const webPackage = readText("apps/web/package.json");
  const devI18n = readText("scripts/dev-i18n.mjs");

  assert.match(packageJson, /"dev:i18n": "node scripts\/dev-i18n\.mjs"/);
  assert.match(webPackage, /"build:es": "pnpm --dir \.\.\/\.\. web:runtime-config && ng build --configuration es"/);
  assert.match(webPackage, /"build:en": "pnpm --dir \.\.\/\.\. web:runtime-config && ng build --configuration en"/);
  assert.match(webPackage, /"build:pt-BR": "node \.\.\/\.\.\/scripts\/build-web-pt-br\.mjs"/);
  assert.match(devI18n, /`build:\$\{locale\}`/);
  assert.match(devI18n, /createI18nServer\(\{ distRoot, port/);
  assert.match(readText("scripts/i18n-server.mjs"), /export const supportedLocales = \["es", "en", "pt-BR"\]/);
  assert.match(readText("scripts/i18n-server.mjs"), /"SPA", 200, "text\/html; charset=utf-8"/);
});

test("verify:i18n-server checks localized indexes, assets, runtime config, and MIME types", () => {
  const packageJson = readText("package.json");
  const verify = readText("scripts/verify-i18n-server.mjs");
  const server = readText("scripts/i18n-server.mjs");

  assert.match(packageJson, /"verify:i18n-server": "node scripts\/verify-i18n-server\.mjs"/);
  assert.match(verify, /runtime-config\.json/);
  assert.match(verify, /contentType/);
  assert.match(verify, /missing-bundle\.js/);
  assert.match(server, /isAssetRequest\(requestedPath\)/);
  assert.match(server, /sendNotFound\(response\)/);
  assert.match(server, /contentTypeFor\(filePath\)/);
});

test("pt-BR public route uses Angular supported pt locale data without changing source translations", () => {
  const angular = readText("apps/web/angular.json");
  const buildScript = readText("scripts/build-web-pt-br.mjs");

  assert.match(angular, /"pt": \{\s*"translation": "\.angular\/i18n\/messages\.pt\.xlf"/);
  assert.match(angular, /"subPath": ""/);
  assert.match(angular, /"pt-BR": \{\s*"localize": \["pt"\]/);
  assert.match(angular, /"baseHref": "\/pt-BR\/"/);
  assert.match(buildScript, /messages\.pt-BR\.xlf/);
  assert.match(buildScript, /writeRuntimeConfig\(\)/);
  assert.match(buildScript, /source\.replace\('target-language="pt-BR"', 'target-language="pt"'\)/);
});

test("language selector remains unique and outside login/register", () => {
  const shell = readText("apps/web/src/main.ts");
  const login = readText("apps/web/src/app/pages/login.component.ts");
  const register = readText("apps/web/src/app/pages/register.component.ts");

  assert.equal(countMatches(shell, /<kaklen-locale-selector \/>/g), 1);
  assert.doesNotMatch(login, /kaklen-locale-selector|LocaleSelectorComponent/);
  assert.doesNotMatch(register, /kaklen-locale-selector|LocaleSelectorComponent/);
});

test("login has expected English and Brazilian Portuguese translations", () => {
  for (const text of ["Sign in", "Register", "Language", "Welcome back", "Email", "Password", "Don’t have an account?", "Create one"]) {
    assert.match(englishMessages, new RegExp(escapeRegExp(text)));
  }

  for (const text of ["Entrar", "Cadastro", "Idioma", "Bem-vindo de volta", "E-mail", "Senha", "Ainda não tem uma conta?", "Crie uma"]) {
    assert.match(portugueseMessages, new RegExp(escapeRegExp(text)));
  }
});

test("quotation repair conflict has exact localized recovery guidance", () => {
  assert.match(
    spanishMessages,
    /<trans-unit id="quotationMoneyRepairConflict"[\s\S]*?<target>La cotización cambió mientras recalculábamos los totales\. Intenta nuevamente\.<\/target>/
  );
  assert.match(
    englishMessages,
    /<trans-unit id="quotationMoneyRepairConflict"[\s\S]*?<target>The quotation changed while totals were being recalculated\. Try again\.<\/target>/
  );
  assert.match(
    portugueseMessages,
    /<trans-unit id="quotationMoneyRepairConflict"[\s\S]*?<target>A cotação foi alterada durante o recálculo dos totais\. Tente novamente\.<\/target>/
  );
});

test("localized XLIFF files include every source translation id with targets", () => {
  const sourceIds = translationIds(sourceMessages);
  for (const [label, body] of [
    ["en", englishMessages],
    ["pt-BR", portugueseMessages]
  ]) {
    const ids = translationIds(body);
    const missing = sourceIds.filter((id) => !ids.includes(id));
    assert.deepEqual(missing, [], `${label} is missing translation ids`);
    assert.equal(hasEmptyTargets(body), false, `${label} has empty targets`);
  }
});

function localizedPath(locale, pathname, search, hash) {
  const segments = pathname.split("/").filter(Boolean);
  if (["es", "en", "pt-BR"].includes(segments[0])) {
    segments.shift();
  }
  const path = `/${locale}/${segments.join("/")}`.replace(/\/$/, "");
  return `${path || `/${locale}/login`}${search}${hash}`;
}

function translationIds(content) {
  return Array.from(content.matchAll(/<trans-unit id="([^"]+)"/g), (match) => match[1]).sort();
}

function hasEmptyTargets(content) {
  return /<target>\s*<\/target>/.test(content) || !/<target>/.test(content);
}

function countMatches(value, pattern) {
  return Array.from(value.matchAll(pattern)).length;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readText(path) {
  return readFileSync(path, "utf8");
}
