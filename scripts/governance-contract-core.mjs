import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

export const LICENSE_TEXT = `Copyright (c) 2026 j-a-a-s. All rights reserved.

Kaklen is proprietary source-visible software. Access to this repository does not grant permission to use, copy, modify, distribute, sublicense, host, sell, or create derivative works from the source code or documentation without prior written authorization from the copyright holder.

Unauthorized use is prohibited.
`;

export const ADVISORY_URL =
  "https://github.com/j-a-a-s/kaklen/security/advisories/new";

export const CODEOWNERS_LINES = Object.freeze([
  "* @j-a-a-s",
  "/.github/ @j-a-a-s",
  "/apps/api/src/auth/ @j-a-a-s",
  "/apps/api/src/security/ @j-a-a-s",
  "/packages/config/ @j-a-a-s",
  "/prisma/ @j-a-a-s",
  "/docs/governance/ @j-a-a-s",
  "/LICENSE @j-a-a-s",
  "/SECURITY.md @j-a-a-s"
]);

export const REPOSITORY_GOVERNANCE = Object.freeze({
  repository: "j-a-a-s/kaklen",
  visibility: "public",
  defaultBranch: "main",
  ownership: "proprietary-source-visible",
  description:
    "Plataforma SaaS multiempresa para cotizaciones, eventos, clientes, proveedores y servicios profesionales.",
  homepage: null,
  topics: Object.freeze([
    "angular",
    "nestjs",
    "typescript",
    "prisma",
    "postgresql",
    "saas",
    "event-management",
    "quotation-management",
    "chile"
  ]),
  privateVulnerabilityReporting: true
});

export const REQUIRED_GOVERNANCE_FILES = Object.freeze([
  "LICENSE",
  "NOTICE.md",
  "README.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
  ".github/CODEOWNERS",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  "docs/README.md",
  "docs/governance/PROJECT_GOVERNANCE.md",
  "docs/governance/OWNERSHIP_AND_CONTRIBUTIONS.md",
  "docs/governance/repository-governance.json"
]);

const DOCUMENT_SNIPPETS = Object.freeze({
  "NOTICE.md": [
    "Kaklen pertenece y es mantenido por `j-a-a-s`",
    "identidad visual y su documentación no se licencian",
    "dependencias externas utilizadas por Kaklen conservan sus propias licencias",
    "`pnpm security:sbom`"
  ],
  "README.md": [
    "## Licencia\n\nKaklen es software propietario. Consulta [LICENSE](LICENSE).",
    "[Gobernanza del proyecto](docs/governance/PROJECT_GOVERNANCE.md)",
    "[Propiedad y contribuciones](docs/governance/OWNERSHIP_AND_CONTRIBUTIONS.md)"
  ],
  "docs/README.md": [
    "[Gobernanza del proyecto](governance/PROJECT_GOVERNANCE.md)",
    "[Propiedad y contribuciones](governance/OWNERSHIP_AND_CONTRIBUTIONS.md)",
    "[Política de seguridad privada](../SECURITY.md)",
    "[Código de conducta](../CODE_OF_CONDUCT.md)"
  ],
  "CONTRIBUTING.md": [
    "prior written authorization from `j-a-a-s`",
    "approved contribution agreement",
    "author must\nown every right needed",
    "No contribution changes Kaklen's proprietary license",
    "Unauthorized code contributions are closed without integration",
    "pnpm check",
    "pnpm quality:gate"
  ],
  "docs/governance/PROJECT_GOVERNANCE.md": [
    "owner y maintainer actual",
    "cambios rutinarios",
    "cambios sensibles",
    "releases requieren",
    "Quality Gate",
    "Solo `j-a-a-s` puede autorizar releases, crear tags, publicar artefactos",
    "Se prohíbe el force push y toda reescritura del historial de `main`"
  ],
  "docs/governance/OWNERSHIP_AND_CONTRIBUTIONS.md": [
    "issues y sugerencias pueden recibirse",
    "autorización escrita previa de `j-a-a-s`",
    "acuerdo de contribución aprobado",
    "poseer todos los derechos necesarios",
    "Ninguna contribución modifica la licencia",
    "contribuciones de código no autorizadas se cerrarán sin integrar"
  ],
  "CODE_OF_CONDUCT.md": [
    "trato profesional",
    "acoso, discriminación",
    "publicación de datos personales",
    "vulnerabilidades no deben publicarse como issues",
    "`j-a-a-s`, como owner, aplica esta política"
  ],
  "SECURITY.md": [
    "única rama soportada",
    "`main`",
    "No abras issues públicos",
    ADVISORY_URL,
    "secretos, tokens, datos personales ni exploits",
    "coordina la validación, priorización, corrección y divulgación"
  ],
  ".github/PULL_REQUEST_TEMPLATE.md": [
    "prior written authorization from `j-a-a-s`",
    "Scope",
    "Tests were added or updated",
    "Migrations and configuration",
    "Security and privacy",
    "Canonical documentation",
    "`pnpm check`",
    "`pnpm quality:gate`"
  ],
  ".github/ISSUE_TEMPLATE/bug_report.yml": [
    "Reproduction",
    "Environment",
    "secrets, tokens, personal data",
    ADVISORY_URL
  ],
  ".github/ISSUE_TEMPLATE/feature_request.yml": [
    "Environment and context",
    "secrets, tokens, personal data",
    ADVISORY_URL
  ],
  ".github/ISSUE_TEMPLATE/config.yml": [
    "blank_issues_enabled: false",
    ADVISORY_URL
  ]
});

const CONTRADICTIONS = Object.freeze([
  /Kaklen\s+(?:is|es)\s+(?:an?\s+)?(?:open[ -]source|c[oó]digo abierto|software (?:de )?c[oó]digo abierto|software libre)/iu,
  /permission is hereby granted/iu,
  /Kaklen[^\n]*(?:licensed under|licenciado bajo)\s+(?:MIT|Apache|GPL|AGPL|BSD)/iu,
  /(?:MIT|Apache|GPL|AGPL|BSD)[^\n]*(?:license applies to Kaklen|licencia aplica a Kaklen)/iu
]);

const OSS_LICENSE = /^(?:MIT|Apache-2\.0|GPL-[0-9.]+|AGPL-[0-9.]+|BSD-[0-9]-Clause)$/i;

export function verifyGovernanceContract(root = process.cwd()) {
  const errors = [];
  for (const path of REQUIRED_GOVERNANCE_FILES) {
    if (!existsSync(resolve(root, path))) {
      errors.push(`${path}: required governance file is missing.`);
    }
  }

  if (existsSync(resolve(root, "LICENSE"))) {
    validateLicenseText(readFileSync(resolve(root, "LICENSE"), "utf8"), errors);
  }

  const packages = loadWorkspacePackages(root, errors);
  validatePrivatePackageLicenses(packages, errors);
  const documents = loadGovernanceDocuments(root);
  validateGovernanceDocuments(documents, errors);

  const codeowners = documents.get(".github/CODEOWNERS");
  if (codeowners !== undefined) {
    validateCodeowners(codeowners, errors);
  }

  const metadataPath = resolve(
    root,
    "docs/governance/repository-governance.json"
  );
  if (existsSync(metadataPath)) {
    try {
      validateRepositoryMetadata(JSON.parse(readFileSync(metadataPath, "utf8")), errors);
    } catch (error) {
      errors.push(
        `docs/governance/repository-governance.json: invalid JSON (${error instanceof Error ? error.message : "parse failure"}).`
      );
    }
  }

  return {
    errors,
    fileCount: REQUIRED_GOVERNANCE_FILES.length,
    packageCount: packages.filter(({ manifest }) => manifest.private === true).length
  };
}

export function validateLicenseText(content, errors = []) {
  if (content !== LICENSE_TEXT) {
    errors.push("LICENSE: content must match the canonical proprietary license exactly.");
  }
  return errors;
}

export function validatePrivatePackageLicenses(packages, errors = []) {
  for (const { path, manifest } of packages) {
    if (typeof manifest.license === "string" && OSS_LICENSE.test(manifest.license)) {
      errors.push(`${path}: open-source license declaration is not allowed.`);
    }
    if (manifest.private === true && manifest.license !== "UNLICENSED") {
      errors.push(`${path}: private packages must declare license UNLICENSED.`);
    }
  }
  return errors;
}

export function validateCodeowners(content, errors = []) {
  const lines = content.trimEnd().split(/\r?\n/);
  if (!isDeepStrictEqual(lines, [...CODEOWNERS_LINES])) {
    errors.push(".github/CODEOWNERS: ownership rules do not match the canonical policy.");
  }
  return errors;
}

export function loadGovernanceDocuments(root = process.cwd()) {
  const documents = new Map();
  for (const path of Object.keys(DOCUMENT_SNIPPETS)) {
    const absolutePath = resolve(root, path);
    if (existsSync(absolutePath)) {
      documents.set(path, readFileSync(absolutePath, "utf8"));
    }
  }
  if (existsSync(resolve(root, ".github/CODEOWNERS"))) {
    documents.set(
      ".github/CODEOWNERS",
      readFileSync(resolve(root, ".github/CODEOWNERS"), "utf8")
    );
  }
  return documents;
}

export function validateGovernanceDocuments(documents, errors = []) {
  for (const [path, snippets] of Object.entries(DOCUMENT_SNIPPETS)) {
    const content = documents.get(path);
    if (content === undefined) {
      continue;
    }
    for (const snippet of snippets) {
      if (!content.includes(snippet)) {
        errors.push(`${path}: missing governance contract text: ${snippet}`);
      }
    }
  }

  for (const [path, content] of documents) {
    for (const pattern of CONTRADICTIONS) {
      if (pattern.test(content)) {
        errors.push(`${path}: contradicts Kaklen proprietary ownership or licensing.`);
      }
    }
  }
  return errors;
}

export function validateRepositoryMetadata(metadata, errors = []) {
  if (!isDeepStrictEqual(metadata, REPOSITORY_GOVERNANCE)) {
    errors.push(
      "docs/governance/repository-governance.json: metadata does not match the canonical repository policy."
    );
  }
  return errors;
}

export function compareRemoteGovernance(expected, actual) {
  const errors = [];
  for (const field of ["repository", "visibility", "defaultBranch", "description"]) {
    if (actual[field] !== expected[field]) {
      errors.push(`${field}: expected ${JSON.stringify(expected[field])}, received ${JSON.stringify(actual[field])}.`);
    }
  }

  const expectedHomepage = expected.homepage ?? null;
  const actualHomepage = actual.homepage || null;
  if (actualHomepage !== expectedHomepage) {
    errors.push(
      `homepage: expected ${JSON.stringify(expectedHomepage)}, received ${JSON.stringify(actualHomepage)}.`
    );
  }

  const expectedTopics = [...expected.topics].sort();
  const actualTopics = Array.isArray(actual.topics) ? [...actual.topics].sort() : [];
  if (!isDeepStrictEqual(actualTopics, expectedTopics)) {
    errors.push(
      `topics: expected ${JSON.stringify(expectedTopics)}, received ${JSON.stringify(actualTopics)}.`
    );
  }
  if (actual.privateVulnerabilityReporting !== expected.privateVulnerabilityReporting) {
    errors.push(
      `privateVulnerabilityReporting: expected ${expected.privateVulnerabilityReporting}, received ${actual.privateVulnerabilityReporting}.`
    );
  }
  return errors;
}

function loadWorkspacePackages(root, errors) {
  const paths = [resolve(root, "package.json")];
  for (const workspaceRoot of ["apps", "packages"]) {
    const absoluteRoot = resolve(root, workspaceRoot);
    if (existsSync(absoluteRoot)) {
      paths.push(...findPackageManifests(absoluteRoot));
    }
  }

  return [...new Set(paths)].map((path) => {
    const label = normalizePath(relative(root, path));
    try {
      return { path: label, manifest: JSON.parse(readFileSync(path, "utf8")) };
    } catch (error) {
      errors.push(
        `${label}: invalid package manifest (${error instanceof Error ? error.message : "parse failure"}).`
      );
      return { path: label, manifest: {} };
    }
  });
}

function findPackageManifests(directory) {
  const paths = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", "dist", "coverage"].includes(entry.name)) {
      continue;
    }
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...findPackageManifests(path));
    } else if (entry.isFile() && entry.name === "package.json") {
      paths.push(path);
    }
  }
  return paths;
}

function normalizePath(path) {
  return path.split("\\").join("/");
}
