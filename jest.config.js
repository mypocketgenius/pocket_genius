// jest.config.js
// Jest configuration for MVP unit tests
// Phase 6, Task 1: Testing infrastructure setup

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Use jsdom environment for React component tests
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
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
  // Transform files for React Testing Library
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
      },
    }],
  },
};
