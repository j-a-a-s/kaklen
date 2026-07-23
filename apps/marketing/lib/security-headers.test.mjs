import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSecurityHeaders,
  validateMarketingPublicEnvironment
} from "./security-headers.mjs";

test("marketing headers constrain framing, content types and API connections", () => {
  const headers = Object.fromEntries(
    buildSecurityHeaders({
      NODE_ENV: "production",
      NEXT_PUBLIC_API_BASE_URL: "https://api.kaklen.test/api",
      NEXT_PUBLIC_SITE_URL: "https://kaklen.test"
    }).map(({ key, value }) => [key, value])
  );

  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.match(headers["Content-Security-Policy"], /connect-src 'self' https:\/\/api\.kaklen\.test/u);
  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/u);
  assert.match(headers["Content-Security-Policy"], /upgrade-insecure-requests/u);
  assert.doesNotMatch(headers["Content-Security-Policy"], /unsafe-eval/u);
});

test("marketing headers reject API URLs with credentials or unsafe protocols", () => {
  assert.throws(
    () =>
      buildSecurityHeaders({
        NODE_ENV: "production",
        NEXT_PUBLIC_API_BASE_URL: "https://user:secret@api.kaklen.test/api",
        NEXT_PUBLIC_SITE_URL: "https://kaklen.test"
      }),
    /without embedded credentials/u
  );
  assert.throws(
    () =>
      buildSecurityHeaders({
        NODE_ENV: "production",
        NEXT_PUBLIC_API_BASE_URL: "javascript:alert(1)",
        NEXT_PUBLIC_SITE_URL: "https://kaklen.test"
      }),
    /HTTP\(S\)/u
  );
});

test("production build configuration requires HTTPS API and site URLs", () => {
  assert.throws(
    () =>
      validateMarketingPublicEnvironment({
        NODE_ENV: "production",
        PUBLIC_APP_ENVIRONMENT: "production"
      }),
    /NEXT_PUBLIC_API_BASE_URL is required/u
  );
  assert.throws(
    () =>
      validateMarketingPublicEnvironment({
        NODE_ENV: "production",
        PUBLIC_APP_ENVIRONMENT: "staging",
        NEXT_PUBLIC_API_BASE_URL: "https://api.kaklen.test/api",
        NEXT_PUBLIC_SITE_URL: "http://kaklen.test"
      }),
    /must use HTTPS/u
  );
  assert.doesNotThrow(() =>
    validateMarketingPublicEnvironment({
      NODE_ENV: "production",
      PUBLIC_APP_ENVIRONMENT: "production",
      NEXT_PUBLIC_API_BASE_URL: "https://api.kaklen.test/api",
      NEXT_PUBLIC_SITE_URL: "https://kaklen.test",
      NEXT_PUBLIC_INSTAGRAM_URL: "https://instagram.com/kaklen.cl"
    })
  );
});
