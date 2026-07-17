import ts from "typescript";

const FORBIDDEN_CALLS = new Set(["Number", "parseFloat"]);
const MONEY_WORDS = /(?:amount|discount|money|price|quantity|subtotal|tax|total)/i;

export function verifyPdfMoneySource(file, source) {
  const findings = [];
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let buildViewModel;

  visit(sourceFile, (node) => {
    if (ts.isMethodDeclaration(node) && node.name.getText(sourceFile) === "buildViewModel") {
      buildViewModel = node;
    }
  });

  if (!buildViewModel?.body) return [`${file}: buildViewModel was not found`];
  const methodText = buildViewModel.getText(sourceFile);
  if (!methodText.includes("calculateQuotationMoney(")) findings.push(`${file}: ViewModel does not use calculateQuotationMoney`);
  if (!methodText.includes("{ currency: source.currency }")) findings.push(`${file}: ViewModel does not pass quotation currency to shared calculation`);
  if (!methodText.includes("this.assertPersistenceParity(source, calculated)")) findings.push(`${file}: persisted totals are not validated before rendering`);

  visit(buildViewModel.body, (node) => {
    if (ts.isCallExpression(node)) {
      const called = node.expression.getText(sourceFile);
      if (FORBIDDEN_CALLS.has(called)) findings.push(`${file}: ViewModel uses forbidden ${called} conversion`);
      if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "toFixed") {
        findings.push(`${file}: ViewModel uses forbidden toFixed rounding`);
      }
    }
    if (ts.isBinaryExpression(node)) {
      const operator = node.operatorToken.kind;
      const monetary = MONEY_WORDS.test(node.getText(sourceFile));
      if (monetary && [
        ts.SyntaxKind.PlusToken,
        ts.SyntaxKind.MinusToken,
        ts.SyntaxKind.AsteriskToken,
        ts.SyntaxKind.SlashToken,
        ts.SyntaxKind.PercentToken
      ].includes(operator)) {
        findings.push(`${file}: ViewModel contains manual monetary arithmetic: ${node.getText(sourceFile)}`);
      }
    }
  });

  return [...new Set(findings)];
}

export function containsFractionalClpDisplay(text) {
  return [
    /\$\s*\d{1,3}(?:\.\d{3})*,\d{2}(?!\d)/,
    /\$\s*\d{1,3}(?:,\d{3})*\.\d{2}(?!\d)/,
    /\b\d+(?:[.,]\d{3})*[.,]\d{2}\s*CLP\b/i
  ].some((pattern) => pattern.test(text));
}

function visit(node, callback) {
  callback(node);
  node.forEachChild((child) => visit(child, callback));
}
