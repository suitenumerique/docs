import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  dir: './',
});

// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: 'v8',
  moduleNameMapper: {
    '^@/docs/(.*)$': '<rootDir>/src/features/docs/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jsdom',
};

const jestConfig = async () => {
  const nextJestConfig = await createJestConfig(config)();
  return {
    ...nextJestConfig,
    moduleNameMapper: {
      '\\.svg$': '<rootDir>/jest/mocks/svg.js',
      '^.+\\.svg\\?url$': `<rootDir>/jest/mocks/fileMock.js`,
      BlockNoteEditor: `<rootDir>/jest/mocks/ComponentMock.js`,
      'custom-blocks': `<rootDir>/jest/mocks/ComponentMock.js`,
      ...nextJestConfig.moduleNameMapper,
    },
  };
};

export default jestConfig;
