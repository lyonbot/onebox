/* eslint-env node */
module.exports = {
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', '@stylistic'],
  root: true,
  rules: {
    '@typescript-eslint/no-explicit-any': 0,
    'object-shorthand': 1,
    '@stylistic/comma-dangle': [1, 'always-multiline'],
    '@stylistic/jsx-props-no-multi-spaces': 1,
  },
};
