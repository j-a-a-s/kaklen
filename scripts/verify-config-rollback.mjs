import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const KAKLEN_PRE_CONFIG_SHA = "4e8e01f85207b1af377c5465229171492ad0e0ce";
export const KOKECORE_PRE_CONFIG_SHA = "9d74f7f39bdf3bce027dd97ec7d0d203950b26fd";

export const CONFIG_ROLLBACK_PATHS = Object.freeze([
  "apps/api/package.json",
  "packages/config/package.json",
  "packages/config/src/index.ts",
  "pnpm-lock.yaml"
]);

const ROLLBACK_VALIDATIONS = Object.freeze([
  ["env:verify"],
  ["lint"],
  ["typecheck"],
  ["test"],
  ["build"],
  ["architecture:check"],
  ["security:scan"]
]);

const KOKECORE_PACKAGES = Object.freeze([
  "@kokecore/auth",
  "@kokecore/calendar",
  "@kokecore/config",
  "@kokecore/errors",
  "@kokecore/logging",
  "@kokecore/rbac",
  "@kokecore/storage",
  "@kokecore/validation"
]);

export function validateRestoredConfigDependency(apiManifest, configManifest, lockfile) {
  const expected = "link:../../../kokecore/packages/config";
  const errors = [];

  if (apiManifest.dependencies?.["@kokecore/config"] !== expected) {
    errors.push("API Config dependency was not restored to its previous local link");
  }
  if (configManifest.dependencies?.["@kokecore/config"] !== expected) {
    errors.push("Kaklen Config adapter was not restored to its previous local link");
  }
  if (lockfile.includes("kokecore-config-0.2.0.tgz")) {
    errors.push("certified Config tarball remains in the restored lockfile");
  }
  const linkedConfigEntries =
    lockfile.match(/specifier:\s*link:\.\.\/\.\.\/\.\.\/kokecore\/packages\/config/g) ?? [];
  if (linkedConfigEntries.length !== 2) {
    errors.push(`expected two restored Config lock entries, found ${linkedConfigEntries.length}`);
  }
  return errors;
}

export function verifyConfigRollback({
  kaklenSource = process.cwd(),
  kokecoreSource = process.env.KOKECORE_SOURCE_PATH ?? resolve(process.cwd(), "..", "kokecore")
} = {}) {
  const kaklenRepository = resolve(kaklenSource);
  const kokecoreRepository = resolve(kokecoreSource);
  const temporaryRoot = mkdtempSync(join(tmpdir(), "kaklen-config-rollback-"));
  const kaklenRoot = join(temporaryRoot, "kaklen");
  const kokecoreRoot = join(temporaryRoot, "kokecore");

  try {
    assertRepository(kaklenRepository, "Kaklen source");
    assertRepository(kokecoreRepository, "KOKE CORE source");
    run("git", ["clone", "--quiet", "--no-local", kaklenRepository, kaklenRoot], temporaryRoot);
    run("git", ["clone", "--quiet", "--no-local", kokecoreRepository, kokecoreRoot], temporaryRoot);
    const currentKokecoreSha = capture("git", ["rev-parse", "HEAD"], kokecoreRoot).trim();

    restoreConfigFiles(kaklenRoot);
    restoreKokecoreConfigPackage(kokecoreRoot);
    rmSync(join(kaklenRoot, "packages", "config", "test"), { recursive: true, force: true });
    rmSync(join(kaklenRoot, "vendor", "kokecore", "config"), {
      recursive: true,
      force: true
    });
    validateRestoredCheckout(kaklenRoot);

    run("corepack", ["pnpm", "install", "--frozen-lockfile"], kokecoreRoot);
    for (const packageName of KOKECORE_PACKAGES) {
      run("corepack", ["pnpm", "--filter", packageName, "build"], kokecoreRoot);
    }
    run("pnpm", ["install", "--frozen-lockfile"], kaklenRoot);
    run("pnpm", ["prisma:generate"], kaklenRoot);
    for (const args of ROLLBACK_VALIDATIONS) run("pnpm", args, kaklenRoot);

    console.log("KAKLEN_CONFIG_ROLLBACK_PASSED");
    console.log(`Kaklen restored from: ${KAKLEN_PRE_CONFIG_SHA}`);
    console.log(`KOKE CORE checkout retained: ${currentKokecoreSha}`);
    console.log(`KOKE CORE Config restored from: ${KOKECORE_PRE_CONFIG_SHA}`);
    console.log("Temporary checkout removed: yes");
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function restoreKokecoreConfigPackage(kokecoreRoot) {
  const configRoot = join(kokecoreRoot, "packages", "config");
  rmSync(configRoot, { recursive: true, force: true });

  const paths = capture(
    "git",
    ["ls-tree", "-r", "--name-only", KOKECORE_PRE_CONFIG_SHA, "packages/config"],
    kokecoreRoot
  )
    .split(/\r?\n/)
    .filter(Boolean);
  if (paths.length === 0) {
    throw new Error(`No Config package found at ${KOKECORE_PRE_CONFIG_SHA}.`);
  }
  for (const path of paths) {
    const target = join(kokecoreRoot, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(
      target,
      capture("git", ["show", `${KOKECORE_PRE_CONFIG_SHA}:${path}`], kokecoreRoot)
    );
  }
  writeFileSync(
    join(kokecoreRoot, "pnpm-lock.yaml"),
    capture("git", ["show", `${KOKECORE_PRE_CONFIG_SHA}:pnpm-lock.yaml`], kokecoreRoot)
  );
}

function restoreConfigFiles(kaklenRoot) {
  for (const path of CONFIG_ROLLBACK_PATHS) {
    const content = capture("git", ["show", `${KAKLEN_PRE_CONFIG_SHA}:${path}`], kaklenRoot);
    writeFileSync(join(kaklenRoot, path), content);
  }
}

function validateRestoredCheckout(kaklenRoot) {
  const apiManifest = JSON.parse(readFileSync(join(kaklenRoot, "apps/api/package.json"), "utf8"));
  const configManifest = JSON.parse(
    readFileSync(join(kaklenRoot, "packages/config/package.json"), "utf8")
  );
  const lockfile = readFileSync(join(kaklenRoot, "pnpm-lock.yaml"), "utf8");
  const errors = validateRestoredConfigDependency(apiManifest, configManifest, lockfile);
  if (errors.length > 0) {
    throw new Error(`Config rollback contract failed:\n- ${errors.join("\n- ")}`);
  }
}

function assertRepository(path, label) {
  if (!existsSync(path) || !statSync(path).isDirectory() || !existsSync(join(path, ".git"))) {
    throw new Error(`${label} is not a Git repository: ${path}`);
  }
}

function capture(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
    timeout: commandTimeout()
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed in ${cwd}: ${result.error?.message ?? result.stderr ?? result.stdout}`
    );
  }
  return result.stdout;
}

function run(command, args, cwd) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
    timeout: commandTimeout(),
    killSignal: "SIGTERM"
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed in ${cwd}: ${result.error?.message ?? `exit ${result.status}`}`
    );
  }
}

function commandTimeout() {
  const timeout = Number(process.env.KAKLEN_CONFIG_ROLLBACK_TIMEOUT_MS ?? 900_000);
  if (!Number.isInteger(timeout) || timeout <= 0) {
    throw new Error("KAKLEN_CONFIG_ROLLBACK_TIMEOUT_MS must be a positive integer.");
  }
  return timeout;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyConfigRollback();
}
