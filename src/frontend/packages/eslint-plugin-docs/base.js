const js = require('@eslint/js');
const nextPlugin = require('@next/eslint-plugin-next');
const tanstackQuery = require('@tanstack/eslint-plugin-query');
const { defineConfig } = require('eslint/config');
const importPlugin = require('eslint-plugin-import');
const jsxA11y = require('eslint-plugin-jsx-a11y');
const prettier = require('eslint-plugin-prettier');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');

const globalRules = {
  'block-scoped-var': 'error',
  curly: ['error', 'all'],
  'import/no-duplicates': ['error', { considerQueryString: false }],
  'import/order': [
    'error',
    {
      alphabetize: {
        order: 'asc',
      },
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      pathGroups: [
        {
          pattern: '@/**',
          group: 'internal',
        },
      ],
      pathGroupsExcludedImportTypes: ['builtin'],
      'newlines-between': 'always',
      warnOnUnassignedImports: true,
    },
  ],
  'no-alert': 'error',
  'no-unused-vars': [
    'error',
    { varsIgnorePattern: '^_', argsIgnorePattern: '^_' },
  ],
  'no-var': 'error',
  'react/jsx-curly-brace-presence': [
    'error',
    { props: 'never', children: 'never', propElementValues: 'always' },
  ],
};

// Base configuration
const baseConfig = defineConfig({
  plugins: {
    prettier,
    import: importPlugin,
    react,
    'react-hooks': reactHooks,
    'jsx-a11y': jsxA11y,
    '@next/next': nextPlugin,
    '@tanstack/query': tanstackQuery,
    js,
  },
  extends: ['js/recommended'],
  settings: {
    'jsx-a11y': {
      polymorphicPropName: 'as',
      components: {
        Input: 'input',
        Button: 'button',
        Box: 'div',
        Text: 'span',
        Select: 'select',
      },
    },
  },
  rules: {
    ...globalRules,
    'no-undef': 'off',
    'prettier/prettier': 'error',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',
    '@tanstack/query/exhaustive-deps': 'error',
    '@tanstack/query/no-rest-destructuring': 'warn',
    '@tanstack/query/stable-query-client': 'error',
    'jsx-a11y/alt-text': 'error',
    'jsx-a11y/aria-props': 'error',
    'jsx-a11y/aria-proptypes': 'error',
    'jsx-a11y/aria-unsupported-elements': 'error',
    'jsx-a11y/role-has-required-aria-props': 'error',
    'jsx-a11y/role-supports-aria-props': 'error',
  },
  linterOptions: {
    reportUnusedDisableDirectives: 'error',
  },
});

module.exports = { baseConfig };
