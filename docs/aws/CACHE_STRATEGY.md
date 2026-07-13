# AWS Cache Strategy

Kaklen separates deployable assets by cache behavior:

- `index.html`: `Cache-Control: no-cache, max-age=0`. CloudFront should revalidate it on every navigation so users receive the newest bundle references.
- `runtime-config.json`: `Cache-Control: no-store`. It contains public runtime metadata such as API URL, environment, version, commit and build time. It must not be reused across deployments.
- `runtime-config.js`: `Cache-Control: no-store`. It bootstraps the browser with the same public runtime metadata.
- Hashed JS/CSS/assets: `Cache-Control: public,max-age=31536000,immutable`. These files are content-addressed and can be cached aggressively.

Deployment flow:

1. Generate runtime config with `APP_VERSION`, `COMMIT_SHA` and `BUILD_TIME`.
2. Upload hashed assets first.
3. Upload `runtime-config.json`, `runtime-config.js` and `index.html` last.
4. Invalidate CloudFront paths:
   - `/index.html`
   - `/runtime-config.json`
   - `/runtime-config.js`
5. Avoid invalidating immutable hashed assets unless the upload was corrupted.

This prevents CloudFront and browsers from mixing an old HTML shell with a new API or a stale runtime config.
