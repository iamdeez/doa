import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/generated/**',
    ],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // 빈 스텁 클래스(17개 도메인 모듈)의 데코레이터 허용: NestJS @Injectable()/@Controller()
      '@typescript-eslint/no-extraneous-class': [
        'error',
        { allowWithDecorator: true },
      ],
    },
  },
];
