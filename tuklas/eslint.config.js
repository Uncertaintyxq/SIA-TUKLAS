import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'reference/**', 'database/**', 'vendor/**', 'storage/**', 'public/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Leading underscore marks a parameter that must exist but isn't used.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Playwright capture script: Node, with a page callback that runs in the browser
    files: ['client/scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    // Plain scripts copied into the build as they are (index.html loads them before the app)
    files: ['client/public/**/*.js'],
    languageOptions: { sourceType: 'script', globals: globals.browser },
  },
  {
    // The service worker runs in its own scope (self.registration, clients, caches)
    files: ['client/public/sw.js'],
    languageOptions: { sourceType: 'script', globals: globals.serviceworker },
  },
  {
    files: ['client/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Styling lives in CSS Modules only — no inline styles.
      'react/forbid-dom-props': ['error', { forbid: ['style'] }],
      'react/forbid-component-props': ['error', { forbid: ['style'] }],
    },
  },
);
