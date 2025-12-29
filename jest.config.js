// jest.config.js
// Jest configuration for MVP unit tests
// Phase 6, Task 1: Testing infrastructure setup

const baseConfig = {
  preset: 'ts-jest',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'lib/**/*.ts',
    'lib/**/*.tsx',
    'components/**/*.tsx',
    '!lib/**/*.d.ts',
    '!lib/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
      },
    }],
  },
};

module.exports = {
  ...baseConfig,
  projects: [
    {
      ...baseConfig,
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: ['**/__tests__/**/*.test.ts', '!**/__tests__/**/theme-context.test.ts', '!**/__tests__/**/use-debounce.test.ts', '!**/__tests__/**/use-chatbot-grid.test.ts', '!**/__tests__/**/use-creators.test.ts'],
    },
    {
      ...baseConfig,
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      testMatch: ['**/__tests__/**/theme-context.test.ts', '**/__tests__/**/use-debounce.test.ts', '**/__tests__/**/use-chatbot-grid.test.ts', '**/__tests__/**/use-creators.test.ts', '**/__tests__/**/*.test.tsx'],
    },
  ],
};
