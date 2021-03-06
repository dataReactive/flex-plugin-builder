const base = require('./../../jest.config.base');
const pkg = require('./package');

module.exports = {
  ...base,
  name: pkg.name,
  displayName: pkg.name,
  rootDir: '../..',
  testMatch: [
    `<rootDir>/packages/${pkg.name}/**/*.test.ts`
  ],
  testPathIgnorePatterns: [
    '<rootDir>/packages/create-flex-plugin/templates/*'
  ],
  coveragePathIgnorePatterns: [
    '<rootDir>/packages/create-flex-plugin/templates/*'
  ]
};
