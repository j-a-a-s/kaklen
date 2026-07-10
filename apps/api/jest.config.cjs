module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.ts$": "ts-jest"
  },
  moduleNameMapper: {
    "^@kaklen/config$": "<rootDir>/../../packages/config/src/index.ts",
    "^@kaklen/shared$": "<rootDir>/../../packages/shared/src/index.ts"
  },
  collectCoverageFrom: ["src/**/*.(t|j)s"],
  testEnvironment: "node"
};
