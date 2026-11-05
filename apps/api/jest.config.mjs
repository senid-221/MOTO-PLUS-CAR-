const tsJestOptions = [
  'ts-jest',
  {
    tsconfig: {
      module: 'CommonJS',
      moduleResolution: 'Node',
      target: 'ES2022',
      esModuleInterop: true,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      strict: true,
      strictNullChecks: true,
      skipLibCheck: true,
      noUnusedLocals: false,
    },
  },
];

export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  transform: { '^.+\\.ts$': tsJestOptions },
  clearMocks: true,
};
