/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@ai-mos/constants$': '<rootDir>/../../packages/constants/src/index.ts',
    '^@ai-mos/types$': '<rootDir>/../../packages/types/src/index.ts',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts'],
};
