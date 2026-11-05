import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      'prisma/migrations/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.test.ts', '**/test/**/*.ts', 'prisma/seed/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // NestJS reads the constructor parameter types of an injectable through
    // emitDecoratorMetadata, so an injected class has to stay a value import
    // even though it only appears in a type position in the source. Autofixing
    // consistent-type-imports here erases the metadata and breaks dependency
    // injection at boot.
    files: ['apps/api/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
);
