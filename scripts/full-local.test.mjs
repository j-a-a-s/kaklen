import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("dev:full:i18n orchestrates API and localized frontend", () => {
  const packageJson = readText("package.json");
  const script = readText("scripts/dev-full-i18n.mjs");

  assert.match(packageJson, /"dev:full:i18n": "node scripts\/dev-full-i18n\.mjs"/);
  assert.match(script, /"pnpm", \["run", "doctor"\]/);
  assert.match(script, /"docker", \["compose", "up", "-d", \.\.\.services\]/);
  assert.match(script, /services\.push\("postgres"\)/);
  assert.match(script, /services\.push\("redis"\)/);
  assert.match(script, /services\.push\("mailpit"\)/);
  assert.match(script, /"pnpm", \["prisma:generate"\]/);
  assert.match(script, /"pnpm", \["prisma:migrate"\]/);
  assert.match(script, /"pnpm", \["--filter", "@kaklen\/api", "dev"\]/);
  assert.match(script, /createI18nServer\(\{ distRoot, port: webPort/);
});

test("dev:full:i18n waits for API health before reporting frontend readiness", () => {
  const script = readText("scripts/dev-full-i18n.mjs");
  const healthWait = script.indexOf("await waitForHttp(apiHealthLiveUrl()");
  const apiSummary = script.indexOf("✓ API disponible");
  const webListen = script.indexOf("server = createI18nServer");
  const webWait = script.indexOf("await waitForHttp(webLoginUrl(\"es\")");
  const finalSummary = script.indexOf("Entorno completo listo");

  assert.ok(healthWait > 0);
  assert.ok(apiSummary > healthWait);
  assert.ok(webListen > apiSummary);
  assert.ok(webWait > webListen);
  assert.ok(finalSummary > webWait);
});

test("dev:full:i18n propagates shutdown to child processes", () => {
  const script = readText("scripts/dev-full-i18n.mjs");

  assert.match(script, /process\.on\("SIGINT"/);
  assert.match(script, /process\.on\("SIGTERM"/);
  assert.match(script, /stopManagedProcess\(managed/);
  assert.match(script, /stopManagedProcessAndWait\(managed/);
  assert.match(script, /process\.kill\(-pid, signal\)/);
  assert.match(script, /stopManagedProcess\(managed, "SIGKILL"\)/);
  assert.match(script, /await Promise\.all\(processShutdowns\)/);
  assert.match(script, /await waitForTcpUnavailable\(apiPort, 5000\)/);
  assert.match(script, /await closeServer\(server\)/);
  assert.match(script, /httpServer\.close/);
  assert.match(script, /httpServer\.closeAllConnections/);
});

test("dev:full:i18n does not accept a stale API process", () => {
  const script = readText("scripts/dev-full-i18n.mjs");

  assert.match(script, /await waitForTcpUnavailable\(apiPort, 10000\)/);
  assert.match(script, /const apiProcess = startManagedProcess/);
  assert.match(script, /await waitForHttp\(apiHealthLiveUrl\(\)/);
  assert.match(script, /if \(hasExited\(apiProcess\.child\)\)/);
});

test("verify:full-local checks API, frontend, runtime config, CORS, and login connectivity", () => {
  const packageJson = readText("package.json");
  const script = readText("scripts/verify-full-local.mjs");

  assert.match(packageJson, /"verify:full-local": "node scripts\/verify-full-local\.mjs"/);
  assert.match(script, /apiHealthReadyUrl/);
  assert.match(script, /verifyRuntimeConfig/);
  assert.match(script, /body\.apiBaseUrl, apiBaseUrl/);
  assert.match(script, /verifyCorsPreflight/);
  assert.match(script, /Access-Control-Request-Method": "POST"/);
  assert.match(script, /access-control-allow-credentials"\), "true"/);
  assert.match(script, /verifyLoginEndpoint/);
  assert.match(script, /response\.status, 401/);
});

test("login distinguishes API availability failures from invalid credentials", () => {
  const authService = readText("apps/web/src/app/auth/auth.service.ts");
  const login = readText("apps/web/src/app/pages/login.component.ts");

  assert.match(authService, /healthReady\(\): Promise<void>/);
  assert.match(authService, /\/health\/ready/);
  assert.match(login, /await this\.authService\.healthReady\(\)/);
  assert.match(login, /messageForLoginError\(error\)/);
  assert.match(login, /error\.status === 401/);
  assert.match(login, /@@loginError:Email o contraseña inválidos\./);
  assert.match(login, /error\.status === 0/);
  assert.match(login, /@@loginServerUnavailable:No fue posible conectar con el servidor\./);
  assert.match(login, /error\.status === 429/);
  assert.match(login, /@@loginRateLimit:Demasiados intentos de inicio de sesión\./);
  assert.match(login, /@@loginServerTimeout:El servidor está tardando demasiado\./);
  assert.match(login, /error\.status >= 500/);
  assert.match(login, /@@loginServiceUnavailable:El servicio no está disponible temporalmente\./);
});

test("CORS local origin remains explicit with credentials enabled", () => {
  const config = readText("packages/config/src/index.ts");
  const main = readText("apps/api/src/main.ts");
  const envExample = readText(".env.example");

  assert.match(config, /env\.AUTH_ALLOWED_ORIGINS \?\? LOCAL_ORIGIN/);
  assert.match(main, /origin: config\.corsAllowedOrigins/);
  assert.match(main, /credentials: true/);
  assert.match(envExample, /AUTH_ALLOWED_ORIGINS="http:\/\/localhost:4200"/);
  assert.doesNotMatch(envExample, /AUTH_ALLOWED_ORIGINS="\*"/);
});

test("runtime config for full local points to localhost API", () => {
  const script = readText("scripts/dev-full-i18n.mjs");
  const envExample = readText(".env.example");

  assert.match(script, /PUBLIC_API_BASE_URL: apiBaseUrl/);
  assert.match(script, /const apiBaseUrl = `http:\/\/localhost:\$\{apiPort\}\/api`/);
  assert.match(envExample, /PUBLIC_API_BASE_URL=http:\/\/localhost:3000\/api/);
});

function readText(path) {
  return readFileSync(path, "utf8");
}
