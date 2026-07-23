import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveProfile } from "./quality-pipeline-core.mjs";

const dockerfile = readFileSync("apps/web/Dockerfile", "utf8");

test("web Docker image builds and serves every localized Angular application", () => {
  assert.match(
    dockerfile,
    /--mount=type=cache,id=kaklen-pnpm-store,target=\/pnpm\/store,sharing=locked/,
  );
  assert.match(
    dockerfile,
    /pnpm install --store-dir=\/pnpm\/store --frozen-lockfile --filter @kaklen\/web\.\.\./,
  );
  assert.match(dockerfile, /pnpm --filter @kokecore\/validation build/);
  assert.match(dockerfile, /pnpm --filter @kaklen\/shared build/);
  assert.match(dockerfile, /pnpm --filter @kaklen\/web build:es/);
  assert.match(dockerfile, /pnpm --filter @kaklen\/web build:en/);
  assert.match(dockerfile, /pnpm --filter @kaklen\/web build:pt-BR/);
  assert.match(dockerfile, /dist\/web\/es\/browser\/index\.html/);
  assert.match(dockerfile, /dist\/web\/en\/browser\/index\.html/);
  assert.match(dockerfile, /dist\/web\/pt-BR\/browser\/index\.html/);
  assert.match(dockerfile, /apps\/web\/public\/runtime-config\.js/);
  assert.match(dockerfile, /apps\/web\/public\/runtime-config\.json/);
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.match(dockerfile, /scripts\/serve-i18n\.mjs/);
});

test("canonical CI builds both production container images", () => {
  const keys = new Set(resolveProfile("quality:gate:ci").tasks.map((task) => task.key));
  assert.equal(keys.has("docker-api"), true);
  assert.equal(keys.has("docker-web"), true);
});
