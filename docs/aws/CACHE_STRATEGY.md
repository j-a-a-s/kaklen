# AWS Cache Strategy

Kaklen separates deployable assets by cache behavior:

- `/es/index.html`, `/en/index.html`, `/pt-BR/index.html`: `Cache-Control: no-cache, max-age=0`. CloudFront should revalidate the localized HTML shell on every navigation so users receive the newest bundle references.
- `runtime-config.json`: `Cache-Control: no-store`. It contains public runtime metadata such as API URL, environment, version, commit and build time. It must not be reused across deployments.
- `runtime-config.js`: `Cache-Control: no-store`. It bootstraps the browser with the same public runtime metadata.
- Hashed JS/CSS/assets: `Cache-Control: public,max-age=31536000,immutable`. These files are content-addressed and can be cached aggressively.

Localized routing:

- CloudFront must serve `/es/*`, `/en/*` and `/pt-BR/*`.
- Each prefix must fall back to its own SPA shell:
  - `/es/index.html`
  - `/en/index.html`
  - `/pt-BR/index.html`
- Root `/` should redirect to the preferred locale using a minimal bootstrap page or CloudFront Function logic based on stored/browser language.

Deployment flow:

1. Generate runtime config with `APP_VERSION`, `COMMIT_SHA` and `BUILD_TIME`.
2. Build all localized web bundles: `es`, `en` and `pt-BR`.
3. Upload hashed assets first.
4. Upload `runtime-config.json`, `runtime-config.js` and localized `index.html` files last.
5. Invalidate CloudFront paths:
   - `/es/index.html`
   - `/en/index.html`
   - `/pt-BR/index.html`
   - `/runtime-config.json`
   - `/runtime-config.js`
6. Avoid invalidating immutable hashed assets unless the upload was corrupted.

This prevents CloudFront and browsers from mixing an old HTML shell with a new API or a stale runtime config.
