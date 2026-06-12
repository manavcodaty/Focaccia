module.exports = {
  ...require('./jest.config.cjs'),
  collectCoverage: true,
  collectCoverageFrom: ['dist-test/src/ticketing.js'],
  coverageDirectory: 'coverage-phase2',
  coverageProvider: 'v8',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
