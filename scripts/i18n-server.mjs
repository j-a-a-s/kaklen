import { createServer } from "node:http";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";

export const supportedLocales = ["es", "en", "pt-BR"];
const assetExtensions = new Set([".js", ".mjs", ".css", ".json", ".svg", ".png", ".jpg", ".jpeg", ".ico", ".woff", ".woff2", ".map"]);

export function createI18nServer({ distRoot = resolve("apps/web/dist/web"), port = 4200, logRequests = false } = {}) {
  const localeRoots = new Map(supportedLocales.map((locale) => [locale, resolveLocaleRoot(distRoot, locale)]));

  return createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `localhost:${port}`}`);
    const method = request.method ?? "GET";
    const locale = localeFromPath(url.pathname);

    if (url.pathname === "/" || url.pathname === "") {
      sendRootRedirect(response);
      logRequest(logRequests, "ROOT", 200, "text/html; charset=utf-8", url.pathname, "locale bootstrap");
      return;
    }

    const sharedRuntimePath = sharedRuntimeFile(url.pathname);
    if (sharedRuntimePath) {
      sendExistingFile(response, sharedRuntimePath, "no-store");
      logRequest(logRequests, "STATIC", 200, contentTypeFor(sharedRuntimePath), url.pathname, sharedRuntimePath);
      return;
    }

    if (!locale) {
      const location = `/es${url.pathname}${url.search}${url.hash}`;
      redirect(response, location);
      logRequest(logRequests, "REDIRECT", 302, "text/plain; charset=utf-8", url.pathname, location);
      return;
    }

    const localeRoot = localeRoots.get(locale) ?? resolveLocaleRoot(distRoot, locale);
    const pathWithoutLocale = removeLeadingLocale(url.pathname);
    const requestedPath = pathWithoutLocale === "/" ? "/index.html" : pathWithoutLocale;
    const filePath = safeJoin(localeRoot, requestedPath);

    if (filePath && isFile(filePath)) {
      sendExistingFile(response, filePath, cachePolicyFor(filePath));
      logRequest(logRequests, "STATIC", 200, contentTypeFor(filePath), url.pathname, filePath);
      return;
    }

    if (isAssetRequest(requestedPath)) {
      sendNotFound(response);
      logRequest(logRequests, "STATIC", 404, "text/plain; charset=utf-8", url.pathname, filePath ?? requestedPath);
      return;
    }

    const indexPath = join(localeRoot, "index.html");
    sendExistingFile(response, indexPath, "no-cache");
    logRequest(logRequests, "SPA", 200, "text/html; charset=utf-8", url.pathname, indexPath);
  });
}

export function resolveLocaleRoot(distRoot, locale) {
  const root = resolve(distRoot, locale);
  const candidates = [
    resolve(root, "browser"),
    resolve(root, "browser", locale),
    resolve(root, "browser", angularLocaleFor(locale)),
    root
  ];

  for (const candidate of candidates) {
    if (isValidLocaleRoot(candidate)) {
      return candidate;
    }
  }

  const checked = candidates.map((candidate) => `- ${candidate}`).join("\n");
  throw new Error(`No se encontró un build Angular válido para locale ${locale}.\nSe revisaron:\n${checked}\nEjecute pnpm --filter @kaklen/web build:${locale}`);
}

export function localeFromPath(pathname) {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return supportedLocales.includes(firstSegment) ? firstSegment : null;
}

export function removeLeadingLocale(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0 && supportedLocales.includes(segments[0])) {
    segments.shift();
  }
  return `/${segments.join("/")}`;
}

export function contentTypeFor(filePath) {
  const extension = extname(filePath);
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".js" || extension === ".mjs") return "application/javascript; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".json") return "application/json; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".ico") return "image/x-icon";
  if (extension === ".woff") return "font/woff";
  if (extension === ".woff2") return "font/woff2";
  if (extension === ".map") return "application/json; charset=utf-8";
  if (extension === ".txt") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

export function cachePolicyFor(filePath) {
  const basename = filePath.split(sep).pop() ?? "";
  if (basename === "index.html") return "no-cache";
  if (basename === "runtime-config.json" || basename === "runtime-config.js") return "no-store";
  if (/\.[a-f0-9]{8,}\./i.test(basename)) return "public,max-age=31536000,immutable";
  return "no-cache";
}

export function isFile(pathname) {
  try {
    return statSync(pathname).isFile();
  } catch {
    return false;
  }
}

export function readText(pathname) {
  return readFileSync(pathname, "utf8");
}

function sendExistingFile(response, filePath, cacheControl) {
  const file = readFileSync(filePath);
  response.writeHead(200, {
    "Content-Type": contentTypeFor(filePath),
    "Cache-Control": cacheControl
  });
  response.end(file);
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

function sendNotFound(response) {
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
  response.end("Not found");
}

function safeJoin(root, pathname) {
  const relativePath = pathname.replace(/^\/+/, "");
  const filePath = resolve(root, normalize(relativePath));
  return filePath === root || filePath.startsWith(`${root}${sep}`) ? filePath : null;
}

function isAssetRequest(pathname) {
  return assetExtensions.has(extname(pathname));
}

function sharedRuntimeFile(pathname) {
  if (pathname === "/runtime-config.json" || pathname === "/runtime-config.js") {
    return resolve(`apps/web/public/${pathname.slice(1)}`);
  }
  return null;
}

function angularLocaleFor(locale) {
  return locale === "pt-BR" ? "pt" : locale;
}

function isValidLocaleRoot(root) {
  return isFile(join(root, "index.html")) && hasFile(root, /^main(?:[-.][\w-]+)?\.js$/) && hasFile(root, /^polyfills(?:[-.][\w-]+)?\.js$/) && hasFile(root, /^styles(?:[-.][\w-]+)?\.css$/);
}

function hasFile(root, pattern) {
  try {
    return readdirSync(root).some((entry) => pattern.test(entry) && isFile(join(root, entry)));
  } catch {
    return false;
  }
}

function logRequest(enabled, kind, status, mimeType, url, filePath) {
  if (!enabled) return;
  console.log(`${kind} ${status} ${mimeType} ${url} -> ${filePath}`);
}
