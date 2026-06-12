module.exports = {
  ...require('./jest.config.cjs'),
  collectCoverage: true,
  collectCoverageFrom: ['dist-test/src/network-config.js'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
