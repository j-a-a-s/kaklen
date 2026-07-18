import { parseTemplate } from "@angular/compiler";
import ts from "typescript";

const DATA_BINDINGS = new Set(["formControlName", "formControl", "ngModel"]);
const TEXT_LIKE_TYPES = new Set(["text", "email", "password", "search", "url", "tel"]);
const ASSET_CONTROL_ELEMENTS = new Set(["input", "textarea", "select"]);
const DATA_ONLY_SEARCH_NAMES = /(?:email|password|firstName|lastName|legalName|description|notes|phone|whatsapp|amount|quantity|unitPrice)/i;

export function auditTypeScriptSource(file, source, options = {}) {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const validators = collectValidators(sourceFile, source);
  const templates = collectComponentTemplates(sourceFile, source, file, options.readExternalTemplate);
  const aggregate = { findings: [], formCount: 0, controlCount: 0, controlsByType: {} };

  for (const template of templates) {
    const result = auditTemplate(template.file, template.content, { source, validators });
    aggregate.findings.push(...result.findings);
    aggregate.formCount += result.formCount;
    aggregate.controlCount += result.controlCount;
    for (const [type, count] of Object.entries(result.controlsByType)) {
      aggregate.controlsByType[type] = (aggregate.controlsByType[type] ?? 0) + count;
    }
  }

  return aggregate;
}

export function auditTemplate(file, template, context = {}) {
  const parsed = parseTemplate(template, file, { preserveWhitespaces: true });
  const findings = parsed.errors?.map((error) => `${file}: template parse error: ${error.msg}`) ?? [];
  const forms = [];
  const controls = [];
  const rawMarkers = [];

  walk(parsed.nodes, [], (node, ancestors) => {
    if (!isElement(node)) return;
    if (node.name === "form") forms.push({ node, ancestors });
    if (isControl(node)) controls.push({ node, ancestors });
    if (node.name === "kaklen-required" || node.name === "kaklen-optional") {
      rawMarkers.push({ node, ancestors });
    }
    if (node.name === "small" && /^(?:Opcional|Obligatorio)$/i.test(textContent(node).trim())) {
      rawMarkers.push({ node, ancestors });
    }
  });

  for (const [index, form] of forms.entries()) {
    const search = isSearchForm(form.node);
    const formControls = controls.filter((control) => control.ancestors.includes(form.node));
    if (search && isDataDisguisedAsSearch(form.node, formControls)) {
      findings.push(`${file}: form ${index + 1} uses role="search" for data entry`);
    }
    if (!search && formControls.length > 0 && !hasDescendant(form.node, "kaklen-form-error-summary")) {
      findings.push(`${file}: form ${index + 1} has no error summary`);
    }
  }

  for (const marker of rawMarkers) {
    if (!file.endsWith("form-feedback.components.ts")) {
      findings.push(`${file}: raw required/optional marker bypasses FormField`);
    }
  }

  const controlsByType = {};
  let auditedControlCount = 0;
  for (const control of controls) {
    const element = control.node;
    const binding = controlBinding(element);
    const name = binding?.value || "dynamic";
    const form = [...control.ancestors].reverse().find((ancestor) => isElement(ancestor) && ancestor.name === "form");
    if (!form) continue;
    auditedControlCount += 1;
    const search = form ? isSearchForm(form) && !isDataDisguisedAsSearch(form, controls.filter((item) => item.ancestors.includes(form))) : false;
    const type = controlType(element);
    controlsByType[type] = (controlsByType[type] ?? 0) + 1;

    if (!search) auditDataControl(findings, file, element, control.ancestors, name, context);
    else auditSearchControl(findings, file, element, control.ancestors, name);
    auditInputContract(findings, file, element, name);
  }

  return { findings: unique(findings), formCount: forms.length, controlCount: auditedControlCount, controlsByType };
}

export function auditFormSource(file, source, options = {}) {
  return file.endsWith(".html")
    ? auditTemplate(file, source, options)
    : auditTypeScriptSource(file, source, options);
}

function auditDataControl(findings, file, element, ancestors, name, context) {
  const field = [...ancestors].reverse().find((ancestor) => isAuthorizedField(ancestor));
  if (!field) {
    findings.push(`${file}: ${name} is outside the shared FormField contract`);
    return;
  }
  for (const input of ["label", "controlId", "required", "invalid"]) {
    if (!hasAttributeOrInput(field, input)) findings.push(`${file}: ${name} FormField has no ${input} input`);
  }
  if (!hasTextAttribute(element, "kaklenControl")) {
    findings.push(`${file}: ${name} does not use the shared kaklenControl ARIA contract`);
  }
  const requiredBinding = attributeExpression(field, "required");
  const validator = context.validators?.get(name) ?? "unknown";
  if (validator === "implicit-required") {
    findings.push(`${file}: ${name} uses a required custom validator without explicit Validators.required metadata`);
  }
  if (validator === "required" && !isRequiredExpression(requiredBinding) && !isAutoExpression(requiredBinding)) {
    findings.push(`${file}: ${name} is required by validators but FormField is not required`);
  }
  if (validator === "optional" && isRequiredExpression(requiredBinding)) {
    findings.push(`${file}: ${name} is optional by validators but FormField is required`);
  }
  if (validator === "dynamic" && !isDynamicRequiredExpression(requiredBinding) && !isAutoExpression(requiredBinding)) {
    findings.push(`${file}: ${name} has dynamic required validators without matching field policy`);
  }
}

function auditSearchControl(findings, file, element, ancestors, name) {
  const labelled = hasAttributeOrInput(element, "aria-label") || ancestors.some((ancestor) =>
    isElement(ancestor) && ancestor.name === "label"
  );
  if (!labelled) findings.push(`${file}: search control ${name} has no accessible label`);
  if (!hasAttributeOrInput(element, "id") && !hasAttributeOrInput(element, "aria-label")) {
    findings.push(`${file}: search control ${name} has no stable id`);
  }
}

function auditInputContract(findings, file, element, name) {
  const type = staticAttribute(element, "type") ?? (element.name === "input" ? "text" : element.name);
  if (element.name === "input" && (/(?:email|recipient)/i.test(name) || name === "to")) {
    requireStatic(findings, file, name, element, "type", "email");
    requireStatic(findings, file, name, element, "inputmode", "email");
  }
  if (element.name === "input" && /(?:phone|whatsapp)/i.test(name)) {
    requireStatic(findings, file, name, element, "type", "tel");
    requireStatic(findings, file, name, element, "inputmode", "tel");
  }
  if (element.name === "textarea" || (element.name === "input" && TEXT_LIKE_TYPES.has(type))) {
    if (!hasAttributeOrInput(element, "maxlength")) findings.push(`${file}: ${name} has no maxlength`);
  }
  if (type === "number" && !["numeric", "decimal"].includes(staticAttribute(element, "inputmode"))) {
    findings.push(`${file}: ${name} has no numeric inputmode`);
  }
}

function collectComponentTemplates(sourceFile, source, file, readExternalTemplate) {
  const templates = [];
  visit(sourceFile, (node) => {
    if (!ts.isDecorator(node) || !ts.isCallExpression(node.expression) || node.expression.expression.getText(sourceFile) !== "Component") return;
    const metadata = node.expression.arguments[0];
    if (!metadata || !ts.isObjectLiteralExpression(metadata)) return;
    for (const property of metadata.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const name = property.name.getText(sourceFile).replace(/["']/g, "");
      if (name === "template" && (ts.isNoSubstitutionTemplateLiteral(property.initializer) || ts.isStringLiteral(property.initializer))) {
        templates.push({ file, content: property.initializer.text });
      }
      if (name === "template" && ts.isTemplateExpression(property.initializer)) {
        templates.push({ file, content: source.slice(property.initializer.getStart(sourceFile) + 1, property.initializer.getEnd() - 1) });
      }
      if (name === "templateUrl" && ts.isStringLiteralLike(property.initializer)) {
        if (!readExternalTemplate) {
          templates.push({ file, content: "" });
        } else {
          const external = readExternalTemplate(file, property.initializer.text);
          templates.push({ file: external.file, content: external.content });
        }
      }
    }
  });
  return templates;
}

function collectValidators(sourceFile, source) {
  const validators = new Map();
  visit(sourceFile, (node) => {
    if (ts.isPropertyAssignment(node) && isFormControlCreation(node.initializer)) {
      const name = propertyName(node.name, sourceFile);
      if (name) validators.set(name, validatorKind(node.initializer.getText(sourceFile)));
    }
  });

  const dynamicPattern = /controls(?:\[(["'])([A-Za-z0-9_]+)\1\]|\.([A-Za-z0-9_]+))\.(?:addValidators|setValidators)\([\s\S]{0,240}?Validators\.(?:required|requiredTrue)/g;
  for (const match of source.matchAll(dynamicPattern)) {
    validators.set(match[2] ?? match[3], "dynamic");
  }
  return validators;
}

function isFormControlCreation(node) {
  return ts.isNewExpression(node) && node.expression.getText().endsWith("FormControl");
}

function validatorKind(text) {
  if (/Validators\.(?:required|requiredTrue)\b/.test(text)) return "required";
  if (customValidatorRequiresValue(text)) return "implicit-required";
  return "optional";
}

function customValidatorRequiresValue(text) {
  return validatorCalls(text, "emailValidator").some(([required]) => required?.trim() === "true") ||
    validatorCalls(text, "internationalPhoneValidator").some(([options]) => /\brequired\s*:\s*true\b/.test(options ?? "")) ||
    validatorCalls(text, "decimalValidator").some((args) => args[3]?.trim() !== "false") ||
    validatorCalls(text, "moneyValidator").some((args) => args[2]?.trim() !== "false");
}

function validatorCalls(source, functionName) {
  const calls = [];
  const marker = `${functionName}(`;
  let cursor = 0;
  while ((cursor = source.indexOf(marker, cursor)) >= 0) {
    const start = cursor + marker.length;
    let depth = 1;
    let quote = "";
    let escaped = false;
    let end = start;
    for (; end < source.length && depth > 0; end += 1) {
      const character = source[end];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = "";
      } else if (character === '"' || character === "'" || character === "`") {
        quote = character;
      } else if (character === "(") {
        depth += 1;
      } else if (character === ")") {
        depth -= 1;
      }
    }
    if (depth === 0) calls.push(splitTopLevelArguments(source.slice(start, end - 1)));
    cursor = Math.max(end, cursor + marker.length);
  }
  return calls;
}

function splitTopLevelArguments(source) {
  const argumentsList = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
    } else if ("([{".includes(character)) {
      depth += 1;
    } else if (")]}".includes(character)) {
      depth -= 1;
    } else if (character === "," && depth === 0) {
      argumentsList.push(source.slice(start, index));
      start = index + 1;
    }
  }
  if (source.trim() || argumentsList.length) argumentsList.push(source.slice(start));
  return argumentsList;
}

function propertyName(node, sourceFile) {
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
  return node.getText(sourceFile).replace(/["']/g, "");
}

function visit(node, callback) {
  callback(node);
  node.forEachChild((child) => visit(child, callback));
}

function walk(nodes, ancestors, callback) {
  for (const node of nodes ?? []) {
    callback(node, ancestors);
    walk(node.children, [...ancestors, node], callback);
  }
}

function isElement(node) {
  return typeof node?.name === "string" && Array.isArray(node.children);
}

function isControl(node) {
  return isElement(node) && [...(node.attributes ?? []), ...(node.inputs ?? [])].some((attribute) => DATA_BINDINGS.has(attribute.name));
}

function controlBinding(node) {
  const attribute = [...(node.attributes ?? []), ...(node.inputs ?? [])].find((item) => DATA_BINDINGS.has(item.name));
  return attribute ? { name: attribute.name, value: attribute.value ?? attribute.value?.source ?? attribute.valueSpan?.toString() ?? "" } : null;
}

function controlType(node) {
  if (ASSET_CONTROL_ELEMENTS.has(node.name)) return node.name;
  return "custom";
}

function isAuthorizedField(node) {
  return isElement(node) && (
    node.name === "kaklen-form-field" ||
    (node.name === "label" && hasTextAttribute(node, "kaklen-form-field")) ||
    hasTextAttribute(node, "kaklenFormFieldAuthorized")
  );
}

function isSearchForm(node) {
  return staticAttribute(node, "role") === "search";
}

function isDataDisguisedAsSearch(form, controls) {
  if (!isSearchForm(form)) return false;
  return controls.some(({ node }) => {
    const binding = controlBinding(node);
    return binding?.name !== "formControlName" || DATA_ONLY_SEARCH_NAMES.test(binding.value);
  });
}

function hasDescendant(node, elementName) {
  let found = false;
  walk(node.children, [node], (child) => {
    if (isElement(child) && child.name === elementName) found = true;
  });
  return found;
}

function textContent(node) {
  let value = "";
  walk(node.children, [node], (child) => {
    if (typeof child?.value === "string") value += child.value;
  });
  return value;
}

function hasTextAttribute(node, name) {
  return (node.attributes ?? []).some((attribute) => attribute.name === name);
}

function hasAttributeOrInput(node, name) {
  return hasTextAttribute(node, name) || (node.inputs ?? []).some((input) => input.name === name) ||
    (node.outputs ?? []).some((output) => output.name === name);
}

function staticAttribute(node, name) {
  return (node.attributes ?? []).find((attribute) => attribute.name === name)?.value;
}

function attributeExpression(node, name) {
  const text = staticAttribute(node, name);
  if (text !== undefined) return text || "true";
  const input = (node.inputs ?? []).find((item) => item.name === name);
  return input?.value?.source ?? input?.value?.toString?.() ?? "";
}

function isRequiredExpression(value) {
  return /^(?:true|['"]true['"])$/.test(value.trim());
}

function isDynamicRequiredExpression(value) {
  const normalized = value.trim();
  return normalized.length > 0 && normalized !== "false" && !isRequiredExpression(normalized);
}

function isAutoExpression(value) {
  return /^(?:auto|['"]auto['"])$/.test(value.trim());
}

function requireStatic(findings, file, name, node, attribute, expected) {
  if (staticAttribute(node, attribute) !== expected) findings.push(`${file}: ${name} must use ${attribute}="${expected}"`);
}

function unique(values) {
  return [...new Set(values)];
}
