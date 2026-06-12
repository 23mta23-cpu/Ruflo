/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          // Use a self-contained config for tests so we are not bound by
          // Expo's "bundler" moduleResolution which is incompatible with ts-jest.
          module: 'CommonJS',
          moduleResolution: 'Node',
          esModuleInterop: true,
          strict: true,
          target: 'ES2020',
          skipLibCheck: true,
          types: ['jest', 'node'],
        },
      },
    ],
  },
};
