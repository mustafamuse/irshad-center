/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:react-hooks/recommended',
    'plugin:tailwindcss/recommended',
    'prettier',
  ],
  plugins: [
    '@typescript-eslint',
    'jsx-a11y',
    'react-hooks',
    'tailwindcss',
    'simple-import-sort',
  ],
  rules: {
    // TypeScript
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'type-imports' },
    ],
    '@typescript-eslint/ban-ts-comment': 'error',

    // React
    'react/jsx-boolean-value': ['error', 'never'],
    'react/self-closing-comp': 'error',
    'react/jsx-curly-brace-presence': ['error', 'never'],
    'react/hook-use-state': 'error',
    'react-hooks/exhaustive-deps': 'error',

    // Imports
    'simple-import-sort/imports': [
      'error',
      {
        groups: [
          // React and Next.js imports
          ['^react', '^next'],
          // External libraries
          ['^@?\\w'],
          // Internal modules
          ['^@/'],
          // Parent imports
          ['^\\.\\.(?!/?$)', '^\\.\\./?$'],
          // Other relative imports
          ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
          // Style imports
          ['^.+\\.s?css$'],
        ],
      },
    ],

    // Accessibility
    'jsx-a11y/aria-props': 'error',
    'jsx-a11y/aria-proptypes': 'error',
    'jsx-a11y/aria-unsupported-elements': 'error',
    'jsx-a11y/role-has-required-aria-props': 'error',

    // Naming conventions
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'variable',
        format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
      },
      {
        selector: 'function',
        format: ['camelCase', 'PascalCase'],
      },
      {
        selector: 'typeLike',
        format: ['PascalCase'],
      },
    ],

    // Component structure
    'react/function-component-definition': [
      'error',
      {
        namedComponents: 'function-declaration',
        unnamedComponents: 'arrow-function',
      },
    ],

    // Custom rules for our patterns
    'react/jsx-sort-props': [
      'error',
      {
        callbacksLast: true,
        shorthandFirst: true,
        reservedFirst: true,
      },
    ],

    // Tailwind
    'tailwindcss/classnames-order': 'error',
    'tailwindcss/enforces-negative-arbitrary-values': 'error',
    'tailwindcss/enforces-shorthand': 'error',
    'tailwindcss/no-custom-classname': 'error',

    // Next.js
    '@next/next/no-html-link-for-pages': 'error',
    '@next/next/no-img-element': 'error',
  },
  settings: {
    tailwindcss: {
      callees: ['cn', 'cva'],
      config: 'tailwind.config.ts',
    },
    next: {
      rootDir: ['./'],
    },
  },
}
