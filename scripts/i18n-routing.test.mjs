import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sourceMessages = readText("apps/web/src/locale/messages.xlf");
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
  const devI18n = readText("scripts/dev-i18n.mjs");

  assert.match(devI18n, /localStorage\.getItem\("kaklen\.locale"\)/);
  assert.match(devI18n, /navigator\.language/);
  assert.match(devI18n, /window\.location\.replace\("\/" \+ normalized \+ "\/login"\)/);
  assert.match(devI18n, /browser\.startsWith\("pt"\) \? "pt-BR" : browser\.startsWith\("en"\) \? "en" : "es"/);
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
  assert.match(webPackage, /"build:es": "ng build --configuration es"/);
  assert.match(webPackage, /"build:en": "ng build --configuration en"/);
  assert.match(webPackage, /"build:pt-BR": "ng build --configuration pt-BR"/);
  assert.match(devI18n, /"es", "en", "pt-BR"/);
  assert.match(devI18n, /sendFile\(response, join\(localeRoot, "index\.html"\), "no-cache"\)/);
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
