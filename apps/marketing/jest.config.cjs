module.exports = {
  moduleFileExtensions: ["js", "json", "ts", "tsx"],
  testEnvironment: "node",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.tsx?$": "ts-jest"
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1"
  }
};
