import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/', 'public/', 'main/src/devtool.legacy.js']
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        Papa: 'readonly',
        STATE: 'readonly',
        XLSX: 'readonly'
      }
    },
    rules: {
      'no-empty': 'off',
      'no-useless-escape': 'off',
      'no-unused-vars': ['warn', {
        args: 'none',
        varsIgnorePattern: '^_'
      }]
    }
  }
];
