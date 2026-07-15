import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("logout clears authenticated user, access token, and refresh state", () => {
  const authService = readText("apps/web/src/app/auth/auth.service.ts");

  assert.match(authService, /finally \{\n\s+this\.clearSessionState\(\);/);
  assert.match(authService, /this\.accessToken = null/);
  assert.match(authService, /this\.refreshPromise = null/);
  assert.match(authService, /this\.user\.set\(null\)/);
  assert.match(authService, /this\.sessionVersion \+= 1/);
});

test("logout clears organization context and permissions", () => {
  const authService = readText("apps/web/src/app/auth/auth.service.ts");
  const organizationService = readText("apps/web/src/app/organizations/organization.service.ts");

  assert.match(authService, /this\.organizationService\.clearSessionContext\(\)/);
  assert.match(organizationService, /clearSessionContext\(\): void/);
  assert.match(organizationService, /this\.organizations\.set\(\[\]\)/);
  assert.match(organizationService, /this\.activeOrganizationId\.set\(null\)/);
  assert.match(organizationService, /this\.permissions\.set\(\[\]\)/);
});

test("logout removes private storage keys while preserving locale preference", () => {
  const authService = readText("apps/web/src/app/auth/auth.service.ts");

  assert.match(authService, /"kaklen\.activeOrganizationId"/);
  assert.match(authService, /"kaklen\.permissions"/);
  assert.match(authService, /"kaklen\.membership"/);
  assert.match(authService, /"kaklen\.onboarding"/);
  assert.match(authService, /this\.clearPrivateStorage\(localStorage\)/);
  assert.match(authService, /this\.clearPrivateStorage\(sessionStorage\)/);
  assert.doesNotMatch(authService, /"kaklen\.locale"/);
});

test("stale refresh responses cannot restore a logged-out user", () => {
  const authService = readText("apps/web/src/app/auth/auth.service.ts");

  assert.match(authService, /const refreshSessionVersion = this\.sessionVersion/);
  assert.match(authService, /applyAuthResponse\(response, refreshSessionVersion\)/);
  assert.match(authService, /expectedSessionVersion !== this\.sessionVersion/);
});

test("public layout does not render previous user or organization after logout", () => {
  const shell = readText("apps/web/src/main.ts");

  assert.match(shell, /\*ngIf="isAuthenticated\(\) && activeOrganizationName\(\)"/);
  assert.match(shell, /\*ngIf="isAuthenticated\(\)"/);
  assert.match(shell, /auth\.user\(\) as user/);
});

test("logout navigation replaces private history entry", () => {
  const shell = readText("apps/web/src/main.ts");

  assert.match(shell, /navigateByUrl\("\/login", \{ replaceUrl: true \}\)/);
  assert.match(shell, /this\.closeMenu\(\)/);
});

test("public header owns the only language selector", () => {
  const shell = readText("apps/web/src/main.ts");

  assert.equal(countMatches(shell, /<kaklen-locale-selector \/>/g), 1);
  assert.match(shell, /LocaleSelectorComponent/);
  assert.match(shell, /NotificationContainerComponent/);
  assert.match(shell, /<header class="topbar"[\s\S]*<kaklen-locale-selector \/>[\s\S]*<\/header>/);
});

test("login and register do not render language selectors", () => {
  const login = readText("apps/web/src/app/pages/login.component.ts");
  const register = readText("apps/web/src/app/pages/register.component.ts");

  assert.doesNotMatch(login, /LocaleSelectorComponent|kaklen-locale-selector|auth-language/);
  assert.doesNotMatch(register, /LocaleSelectorComponent|kaklen-locale-selector|auth-language/);
});

test("login remains anonymous and does not render previous user or organization data", () => {
  const login = readText("apps/web/src/app/pages/login.component.ts");

  assert.doesNotMatch(login, /activeOrganizationName|organization-pill|user-chip|firstName|lastName/);
});

function readText(path) {
  return readFileSync(path, "utf8");
}

function countMatches(value, pattern) {
  return Array.from(value.matchAll(pattern)).length;
}
