// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // Allow unescaped apostrophes in JSX text - they render fine in React Native
      'react/no-unescaped-entities': 'off',
    },
  },
]);
