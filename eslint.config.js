const { defineConfig, globalIgnores } = require('eslint/config');
const { configs, plugins } = require('eslint-config-airbnb-extended');
const checkFile = require('eslint-plugin-check-file');
const promise = require('eslint-plugin-promise');
const security = require('eslint-plugin-security');
const globals = require('globals');

module.exports = defineConfig([
  globalIgnores(['node_modules/', 'logs/']),
  plugins.stylistic,
  plugins.importX,
  plugins.node,
  ...configs.base.recommended,
  ...configs.node.recommended,
  security.configs.recommended,
  promise.configs['flat/recommended'],
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      parserOptions: { ecmaVersion: 'latest' },
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.jest },
    },
    plugins: { 'check-file': checkFile },
    rules: {
      'no-underscore-dangle': ['error', { allow: ['_id'] }],
      '@stylistic/indent': ['error', 2],
      '@stylistic/quotes': ['error', 'single'],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/linebreak-style': ['error', 'unix'],
      '@stylistic/arrow-parens': ['error', 'as-needed'],
      '@stylistic/max-len': ['error', { code: 150, ignoreUrls: true }],
      'max-lines': ['error', { max: 150, skipBlankLines: false, skipComments: false }],
      'import-x/order': ['error', { alphabetize: { order: 'asc' }, 'newlines-between': 'always' }],
      'check-file/filename-naming-convention': ['error', { '**/*.js': 'KEBAB_CASE' }, { ignoreMiddleExtensions: true }],
    },
  },
  {
    files: ['src/models/plugins/*.js'],
    rules: { 'no-param-reassign': 'off' },
  },
]);
