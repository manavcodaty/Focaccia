module.exports = {
  roots: ['<rootDir>/dist-test/test'],
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  collectCoverageFrom: ['dist-test/src/**/*.js'],
};
