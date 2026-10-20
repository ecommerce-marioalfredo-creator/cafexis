/* Configuración de ESLint 8 para `npm run lint` (plugins ya listados en package.json). */
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:react-hooks/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['react-refresh'],
  // supabase/functions corre en Deno (imports por URL) y mobile/ es código nativo generado.
  // vite.config.js/.d.ts los emite `tsc -b` (tsconfig.node.json) y están en .gitignore.
  ignorePatterns: [
    'dist',
    'dist-clientes',
    'dist-equipo',
    'mobile',
    'supabase/functions',
    'node_modules',
    'vite.config.js',
    'vite.config.d.ts',
  ],
  rules: {
    // useAuth/useCustomerAuth viven junto a su Provider a propósito (comparten el contexto).
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true, allowExportNames: ['useAuth', 'useCustomerAuth'] },
    ],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      // Archivos de configuración y scripts que corren en Node.
      files: ['*.cjs', '*.config.ts', 'scripts/**/*.mjs'],
      env: { node: true, browser: false },
    },
  ],
}
