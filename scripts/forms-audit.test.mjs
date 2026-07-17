import assert from "node:assert/strict";
import test from "node:test";
import { auditFormSource, auditTypeScriptSource } from "./forms-audit-core.mjs";

const validField = ({ name = "name", tag = "input", attributes = "maxlength=\"80\"", required = "true" } = {}) => `
  <label kaklen-form-field label="Name" controlId="field-${name}" [required]="${required}" [invalid]="form.controls.${name}.invalid">
    <${tag} kaklenControl ${attributes} formControlName="${name}"${tag === "input" ? " /" : `></${tag}`}>
    <kaklen-field-error [control]="form.controls.${name}" />
  </label>`;

function component(template, controls = "name: new FormControl('', { validators: [Validators.required] })") {
  return `
    import { Component } from "@angular/core";
    import { FormControl, FormGroup, Validators } from "@angular/forms";
    @Component({ template: \`${template}\` })
    class Host { readonly form = new FormGroup({ ${controls} }); }
  `;
}

function findings(source) {
  return auditTypeScriptSource("host.ts", source).findings.join("\n");
}

test("accepts a standardized data form", () => {
  const source = component(`<form [formGroup]="form"><kaklen-form-error-summary />${validField()}</form>`);
  assert.deepEqual(auditTypeScriptSource("host.ts", source).findings, []);
});

test("detects a select outside the contract", () => {
  const result = findings(component(`<form [formGroup]="form"><kaklen-form-error-summary /><select formControlName="name"></select></form>`));
  assert.match(result, /outside the shared FormField/);
});

test("detects required validator without visual required state", () => {
  assert.match(findings(component(`<form><kaklen-form-error-summary />${validField({ required: "false" })}</form>`)), /required by validators/);
});

test("detects visual required state on an optional control", () => {
  const source = component(`<form><kaklen-form-error-summary />${validField()}</form>`, "name: new FormControl('')");
  assert.match(findings(source), /optional by validators/);
});

test("detects missing shared ARIA state", () => {
  const field = validField().replace(" kaklenControl", "");
  assert.match(findings(component(`<form><kaklen-form-error-summary />${field}</form>`)), /kaklenControl ARIA contract/);
});

test("detects raw optional labels", () => {
  const field = validField().replace("<kaklen-field-error", "<small>Opcional</small><kaklen-field-error");
  assert.match(findings(component(`<form><kaklen-form-error-summary />${field}</form>`)), /raw required\/optional marker/);
});

test("detects a control outside FormField", () => {
  assert.match(findings(component(`<form><kaklen-form-error-summary /><input maxlength="80" formControlName="name" /></form>`)), /outside the shared FormField/);
});

test("detects incorrect email type", () => {
  const source = component(`<form><kaklen-form-error-summary />${validField({ name: "email", attributes: "type=\"text\" inputmode=\"email\" maxlength=\"254\"" })}</form>`, "email: new FormControl('', { validators: [Validators.required] })");
  assert.match(findings(source), /type="email"/);
});

test("detects telephone without inputmode", () => {
  const source = component(`<form><kaklen-form-error-summary />${validField({ name: "phone", attributes: "type=\"tel\" maxlength=\"24\"" })}</form>`, "phone: new FormControl('', { validators: [Validators.required] })");
  assert.match(findings(source), /inputmode="tel"/);
});

test("detects a custom ControlValueAccessor without FormField", () => {
  const source = component(`<form><kaklen-form-error-summary /><kaklen-date-picker formControlName="name" /></form>`);
  assert.match(findings(source), /outside the shared FormField/);
});

test("audits inline templates", () => {
  const source = component(`<form><input maxlength="80" formControlName="name" /></form>`);
  assert.match(findings(source), /no error summary/);
});

test("audits external templates", () => {
  const source = `@Component({ templateUrl: "./host.html" }) class Host {}`;
  const result = auditTypeScriptSource("host.ts", source, {
    readExternalTemplate: () => ({ file: "host.html", content: `<form><input maxlength="80" formControlName="name" /></form>` })
  });
  assert.match(result.findings.join("\n"), /host.html: form 1 has no error summary/);
});

test("accepts an accessible search form without an error summary", () => {
  const template = `<form role="search"><label>Search<input id="search" type="search" maxlength="80" formControlName="query" /></label></form>`;
  assert.deepEqual(auditFormSource("search.html", template).findings, []);
});

test("rejects a data form disguised as search", () => {
  const template = `<form role="search" [formGroup]="form" (ngSubmit)="save()"><label>Email<input id="email" type="email" inputmode="email" maxlength="254" formControlName="email" /></label></form>`;
  assert.match(auditFormSource("host.html", template).findings.join("\n"), /role="search" for data entry/);
});
