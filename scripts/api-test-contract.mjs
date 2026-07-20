export const API_UNIT_TEST_REGEX = String.raw`^(?!.*(?:\.integration\.spec|\.e2e-spec)\.ts$).*\.spec\.ts$`;
export const API_INTEGRATION_TEST_REGEX = String.raw`.*(?:\.integration\.spec|\.e2e-spec)\.ts$`;

export function resolveApiTestMode(argumentsList) {
  const modes = argumentsList.filter((argument) => argument === "--unit" || argument === "--integration");
  if (modes.length > 1) {
    throw new Error("Choose either --unit or --integration, not both.");
  }

  const mode = modes[0] ?? "--all";
  const passthrough = argumentsList.filter(
    (argument) => argument !== "--unit" && argument !== "--integration"
  );
  if (mode === "--unit") return { mode: "unit", testRegex: API_UNIT_TEST_REGEX, passthrough };
  if (mode === "--integration") {
    return { mode: "integration", testRegex: API_INTEGRATION_TEST_REGEX, passthrough };
  }
  return { mode: "all", testRegex: null, passthrough };
}
