#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  apiHealthLiveUrl,
  apiHealthReadyUrl,
  waitForHttp,
  webLoginUrl
} from "./dev-full-i18n.mjs";

const apiBaseUrl = process.env.PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";
const webOrigin = `http://localhost:${Number(process.env.WEB_PORT ?? 4200)}`;
let startedChild = null;

console.log("KAKLEN FULL LOCAL VERIFY");

try {
  if (!(await alreadyRunning())) {
    startedChild = startFullLocal();
  }

  await waitForHttp(apiHealthLiveUrl(), { timeoutMs: 180000 });
  await waitForHttp(apiHealthReadyUrl(), { timeoutMs: 180000 });
  await waitForHttp(webLoginUrl("es"), { timeoutMs: 180000 });

  await verifyHealth();
  await verifyFrontend();
  await verifyRuntimeConfig();
  await verifyCorsPreflight();
  await verifyLoginEndpoint();

  console.log("✓ Entorno full local verificado");
} finally {
  if (startedChild) {
    stopChild(startedChild);
  }
}

async function alreadyRunning() {
  try {
    await waitForHttp(apiHealthLiveUrl(), { timeoutMs: 1500, requestTimeoutMs: 500 });
    await waitForHttp(webLoginUrl("es"), { timeoutMs: 1500, requestTimeoutMs: 500 });
    return true;
  } catch {
    return false;
  }
}

function startFullLocal() {
  const child = spawn("node", ["scripts/dev-full-i18n.mjs"], {
    stdio: "inherit",
    shell: false,
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      PUBLIC_API_BASE_URL: apiBaseUrl
    }
  });
  child.on("exit", (code, signal) => {
    if (startedChild && code !== null && code !== 0) {
      console.error(`dev:full:i18n termino con code ${code}`);
    }
    if (startedChild && signal) {
      console.error(`dev:full:i18n termino con signal ${signal}`);
    }
  });
  return child;
}

async function verifyHealth() {
  for (const path of ["/health", "/health/live", "/health/ready"]) {
    const response = await request(`${apiBaseUrl}${path}`);
    assert.equal(response.status, 200, `${path} debe responder 200`);
    const body = JSON.parse(response.body);
    assert.equal(body.status, "ok");
    assert.ok(body.version);
    assert.ok(body.commitSha);
    assert.ok(body.buildTime);
    assert.ok(body.environment);
    console.log(`✓ API ${path}`);
  }
}

async function verifyFrontend() {
  for (const locale of ["es", "en", "pt-BR"]) {
    const response = await request(`${webOrigin}/${locale}/login`);
    assert.equal(response.status, 200, `${locale} login debe responder 200`);
    assert.match(response.contentType, /^text\/html\b/);
    console.log(`✓ Frontend ${locale}`);
  }
}

async function verifyRuntimeConfig() {
  for (const locale of ["es", "en", "pt-BR"]) {
    const response = await request(`${webOrigin}/${locale}/runtime-config.json`);
    assert.equal(response.status, 200, `${locale} runtime-config debe responder 200`);
    assert.match(response.contentType, /^application\/json\b/);
    const body = JSON.parse(response.body);
    assert.equal(body.apiBaseUrl, apiBaseUrl);
    console.log(`✓ Runtime config ${locale} -> ${apiBaseUrl}`);
  }
}

async function verifyCorsPreflight() {
  const response = await request(`${apiBaseUrl}/auth/login`, {
    method: "OPTIONS",
    headers: {
      Origin: webOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type"
    }
  });
  assert.ok([200, 204].includes(response.status), "preflight debe responder 200 o 204");
  assert.equal(response.headers.get("access-control-allow-origin"), webOrigin);
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  assert.match(response.headers.get("access-control-allow-methods") ?? "", /POST|,/);
  console.log("✓ CORS preflight POST /api/auth/login");
}

async function verifyLoginEndpoint() {
  const response = await request(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: {
      Origin: webOrigin,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: "missing-user@kaklen.local",
      password: "InvalidPassword123!"
    })
  });
  assert.equal(response.status, 401, "login invalido debe responder 401, no connection refused ni CORS");
  assert.equal(response.headers.get("access-control-allow-origin"), webOrigin);
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  console.log("✓ Login endpoint accesible con credenciales invalidas");
}

async function request(url, init = {}) {
  const response = await fetch(url, init);
  return {
    status: response.status,
    headers: response.headers,
    contentType: response.headers.get("content-type") ?? "",
    body: await response.text()
  };
}

function stopChild(child) {
  const pid = child.pid;
  startedChild = null;
  if (!pid || child.exitCode !== null) {
    return;
  }
  if (process.platform === "win32") {
    child.kill("SIGTERM");
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}
