export function auditFormSource(file, source) {
  const findings = [];
  const forms = [...source.matchAll(/<form\b([\s\S]*?)<\/form>/g)];
  const controls = [...source.matchAll(/<(input|textarea)\b([^>]*)>/g)]
    .filter((match) => /\bformControlName\s*=/.test(match[2]));

  for (const [index, formMatch] of forms.entries()) {
    const form = formMatch[0];
    const isSearch = /\brole\s*=\s*["']search["']/.test(form);
    if (!isSearch && /\(ngSubmit\)\s*=/.test(form) && !form.includes("kaklen-form-error-summary")) {
      findings.push(`${file}: form ${index + 1} has no error summary`);
    }
  }

  if (forms.some((match) => !/\brole\s*=\s*["']search["']/.test(match[0])) && controls.length > 0) {
    const directiveOccurrences = source.match(/FormControlA11yDirective/g)?.length ?? 0;
    if (directiveOccurrences < 2) {
      findings.push(`${file}: data-entry controls do not import the shared ARIA directive`);
    }
  }

  for (const control of controls) {
    const tag = control[1];
    const attributes = control[2];
    const name = attributeValue(attributes, "formControlName") ?? "unknown";
    const type = attributeValue(attributes, "type") ?? (/\[type\]\s*=/.test(attributes) ? "dynamic" : "text");

    if (/(?:email|recipient)/i.test(name) || name === "to") {
      requireAttribute(findings, file, name, attributes, "type", "email");
      requireAttribute(findings, file, name, attributes, "inputmode", "email");
    }
    if (/(?:phone|whatsapp)/i.test(name)) {
      requireAttribute(findings, file, name, attributes, "type", "tel");
      requireAttribute(findings, file, name, attributes, "inputmode", "tel");
    }
    if (tag === "textarea" || ["text", "email", "password", "search", "url", "tel", "dynamic"].includes(type)) {
      if (!hasAttribute(attributes, "maxlength")) {
        findings.push(`${file}: ${name} has no maxlength`);
      }
    }
    if (type === "number" && !/\binputmode\s*=\s*["'](?:numeric|decimal)["']/.test(attributes)) {
      findings.push(`${file}: ${name} has no numeric inputmode`);
    }
  }

  if (/\b(?:Nombre|Región|Dirección)\s*(?:Opcional|Obligatorio)\b/.test(source)) {
    findings.push(`${file}: concatenated required/optional label`);
  }
  if (
    !file.endsWith("form-feedback.components.ts") &&
    /<(?:span|label)[^>]*>\s*(?:Opcional|Obligatorio)\s*<\//.test(source)
  ) {
    findings.push(`${file}: raw required/optional label bypasses shared components`);
  }

  return { findings, formCount: forms.length, controlCount: controls.length };
}

function requireAttribute(findings, file, name, attributes, attribute, expected) {
  if (attributeValue(attributes, attribute) !== expected) {
    findings.push(`${file}: ${name} must use ${attribute}="${expected}"`);
  }
}

function hasAttribute(attributes, name) {
  return new RegExp(`\\b${name}\\s*=`).test(attributes);
}

function attributeValue(attributes, name) {
  return attributes.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`))?.[1];
}
