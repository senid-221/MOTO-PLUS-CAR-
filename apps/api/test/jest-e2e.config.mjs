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
      types: ['node', 'jest'],
    },
  },
];

export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  roots: ['<rootDir>/test'],
  testRegex: '.*\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': tsJestOptions },
  setupFiles: ['<rootDir>/test/load-env.ts'],
  testTimeout: 120_000,
  // Authentication tests rotate real tokens and hit a real database, so they
  // must not share a worker with anything else.
  maxWorkers: 1,
  dangerouslyReportAssertionFailure: true,
};
