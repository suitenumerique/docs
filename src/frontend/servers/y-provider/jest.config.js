var config = {
  rootDir: './__tests__',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts)$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../src/$1',
    '^@blocknote/server-util$': '<rootDir>/../__mocks__/mock.js',
    '^y-protocols/awareness.js$': '<rootDir>/../__mocks__/mock.js',
  },
};
export default config;
