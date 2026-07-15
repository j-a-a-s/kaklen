#!/usr/bin/env node
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { cleanDev } from "./clean-dev.mjs";
import { writeRuntimeConfig } from "./write-runtime-config.mjs";

const locales = ["es", "en", "pt-BR"];
const port = Number(process.env.WEB_PORT ?? 4200);
const distRoot = resolve("apps/web/dist/web");
let currentChild = null;
let server = null;

process.on("SIGINT", () => forwardAndExit("SIGINT"));
process.on("SIGTERM", () => forwardAndExit("SIGTERM"));

console.log("KAKLEN DEV I18N");
console.log("Limpiando artefactos regenerables...");
cleanDev().forEach((target) => console.log(`✓ ${target}`));
const runtime = writeRuntimeConfig();
console.log(`✓ Runtime config ${runtime.config.version} ${runtime.config.commitSha}`);
const runtimeEnv = createRuntimeEnv(runtime.config);

await run("pnpm", ["prisma:generate"], runtimeEnv);
await run("turbo", ["run", "build", "--filter=./packages/*"], runtimeEnv);
for (const locale of locales) {
  await run("pnpm", ["--filter", "@kaklen/web", `build:${locale}`], runtimeEnv);
}

server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `localhost:${port}`}`);
  const locale = localeFromPath(url.pathname);

  if (url.pathname === "/" || url.pathname === "") {
    sendRootRedirect(response);
    return;
  }

  if (url.pathname === "/runtime-config.json" || url.pathname === "/runtime-config.js") {
    sendFile(response, resolve(`apps/web/public/${url.pathname.slice(1)}`), "no-store");
    return;
  }

  if (!locale) {
    redirect(response, `/es${url.pathname}${url.search}${url.hash}`);
    return;
  }

  const localeRoot = resolveLocaleRoot(locale);
  const pathWithoutLocale = removeLeadingLocale(url.pathname);
  const requestedPath = pathWithoutLocale === "/" ? "/index.html" : pathWithoutLocale;
  const filePath = safeJoin(localeRoot, requestedPath);

  if (filePath && isFile(filePath)) {
    sendFile(response, filePath, cachePolicyFor(filePath));
    return;
  }

  sendFile(response, join(localeRoot, "index.html"), "no-cache");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`✓ Localized web available at http://localhost:${port}/es/login`);
  console.log(`✓ English: http://localhost:${port}/en/login`);
  console.log(`✓ Português: http://localhost:${port}/pt-BR/login`);
});

function run(command, args, env) {
  return new Promise((resolveRun, reject) => {
    currentChild = spawn(command, args, { stdio: "inherit", shell: false, env });
    currentChild.on("exit", (code, signal) => {
      currentChild = null;
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

function localeFromPath(pathname) {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return locales.includes(firstSegment) ? firstSegment : null;
}

function removeLeadingLocale(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0 && locales.includes(segments[0])) {
    segments.shift();
  }
  return `/${segments.join("/")}`;
}

function resolveLocaleRoot(locale) {
  const root = resolve(distRoot, locale);
  const browserRoot = resolve(root, "browser");
  const localizedBrowserRoot = resolve(browserRoot, locale);
  if (isDirectory(localizedBrowserRoot)) return localizedBrowserRoot;
  return isDirectory(browserRoot) ? browserRoot : root;
}

function safeJoin(root, pathname) {
  const relativePath = pathname.replace(/^\/+/, "");
  const filePath = resolve(root, normalize(relativePath));
  return filePath === root || filePath.startsWith(`${root}${sep}`) ? filePath : null;
}

function isFile(pathname) {
  try {
    return statSync(pathname).isFile();
  } catch {
    return false;
  }
}

function isDirectory(pathname) {
  try {
    return statSync(pathname).isDirectory();
  } catch {
    return false;
  }
}

function sendFile(response, filePath, cacheControl) {
  try {
    const file = readFileSync(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypeFor(filePath),
      "Cache-Control": cacheControl
    });
    response.end(file);
  } catch {
    if (!response.headersSent) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    }
    response.end("Not found");
  }
}

function sendRootRedirect(response) {
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(`<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>Kaklen</title></head>
<body>
<script>
  const supported = ["es", "en", "pt-BR"];
  const stored = localStorage.getItem("kaklen.locale");
  const browser = navigator.language || "";
  const normalized = supported.includes(stored) ? stored : browser.startsWith("pt") ? "pt-BR" : browser.startsWith("en") ? "en" : "es";
  window.location.replace("/" + normalized + "/login");
</script>
</body>
</html>`);
}

function redirect(response, location) {
  response.writeHead(302, { Location: location, "Cache-Control": "no-store" });
  response.end();
}

function contentTypeFor(filePath) {
  const extension = extname(filePath);
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".json") return "application/json; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

function cachePolicyFor(filePath) {
  const basename = filePath.split(sep).pop() ?? "";
  if (basename === "index.html") return "no-cache";
  if (basename === "runtime-config.json" || basename === "runtime-config.js") return "no-store";
  if (/\.[a-f0-9]{8,}\./i.test(basename)) return "public,max-age=31536000,immutable";
  return "no-cache";
}

function createRuntimeEnv(config) {
  return {
    ...process.env,
    APP_VERSION: config.version,
    COMMIT_SHA: config.commitSha,
    BUILD_TIME: config.buildTime,
    PUBLIC_APP_ENVIRONMENT: config.environment
  };
}

function forwardAndExit(signal) {
  if (currentChild) {
    currentChild.kill(signal);
  }
  if (server) {
    server.close(() => process.exit(signal === "SIGINT" ? 130 : 143));
    return;
  }
  process.exit(signal === "SIGINT" ? 130 : 143);
}
