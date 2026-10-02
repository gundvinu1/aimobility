const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@ai-mos/constants$': '<rootDir>/../../packages/constants/src/index.ts',
    '^@ai-mos/types$': '<rootDir>/../../packages/types/src/index.ts',
  },
  testMatch: ['**/*.spec.tsx', '**/*.spec.ts', '**/*.test.tsx', '**/*.test.ts'],
};

module.exports = createJestConfig(customJestConfig);
