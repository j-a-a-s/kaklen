const LOCAL_API_URL = "http://localhost:3000/api";

export function buildSecurityHeaders(env = process.env) {
  validateMarketingPublicEnvironment(env);
  const apiOrigin = parseHttpOrigin(
    env.NEXT_PUBLIC_API_BASE_URL ?? LOCAL_API_URL,
    "NEXT_PUBLIC_API_BASE_URL"
  );
  const scriptPolicy =
    env.NODE_ENV === "production"
      ? "'self' 'unsafe-inline'"
      : "'self' 'unsafe-inline' 'unsafe-eval'";
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    `connect-src 'self' ${apiOrigin}`,
    "font-src 'self' data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: https:",
    "object-src 'none'",
    `script-src ${scriptPolicy}`,
    "style-src 'self' 'unsafe-inline'"
  ];

  if (env.NODE_ENV === "production") {
    directives.push("upgrade-insecure-requests");
  }

  return [
    { key: "Content-Security-Policy", value: directives.join("; ") },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" }
  ];
}

export function validateMarketingPublicEnvironment(env = process.env) {
  const deployment = ["staging", "production"].includes(
    env.PUBLIC_APP_ENVIRONMENT ?? ""
  );
  const apiUrl = env.NEXT_PUBLIC_API_BASE_URL ?? (deployment ? undefined : LOCAL_API_URL);
  const siteUrl =
    env.NEXT_PUBLIC_SITE_URL ?? (deployment ? undefined : "http://localhost:4300");
  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is required in production");
  }
  if (!siteUrl) {
    throw new Error("NEXT_PUBLIC_SITE_URL is required in production");
  }

  parseHttpUrl(apiUrl, "NEXT_PUBLIC_API_BASE_URL", deployment, false);
  parseHttpUrl(siteUrl, "NEXT_PUBLIC_SITE_URL", deployment, true);
  if (env.NEXT_PUBLIC_INSTAGRAM_URL) {
    parseHttpUrl(
      env.NEXT_PUBLIC_INSTAGRAM_URL,
      "NEXT_PUBLIC_INSTAGRAM_URL",
      deployment,
      false
    );
  }
}

function parseHttpOrigin(value, key) {
  return parseHttpUrl(value, key, false, false).origin;
}

function parseHttpUrl(value, key, requireHttps, requireOrigin) {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error(`${key} must be an HTTP(S) URL without embedded credentials`);
  }
  if (requireHttps && parsed.protocol !== "https:") {
    throw new Error(`${key} must use HTTPS in production`);
  }
  if (requireOrigin && (parsed.pathname !== "/" || parsed.search || parsed.hash)) {
    throw new Error(`${key} must be an origin without path, query, or fragment`);
  }
  return parsed;
}
