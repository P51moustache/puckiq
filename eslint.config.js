// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Supabase edge functions run on Deno (URL imports) and are excluded from tsconfig too.
    ignores: ['dist/*', 'supabase/functions/**'],
  },
  {
    rules: {
      // Allow unescaped apostrophes in JSX text - they render fine in React Native
      'react/no-unescaped-entities': 'off',
    },
  },
]);
