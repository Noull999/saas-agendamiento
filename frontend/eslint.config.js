import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Patrón load() dentro de useEffect es válido para fetching de datos
      'react-hooks/set-state-in-effect': 'off',
      // AuthContext exporta provider + hook en el mismo archivo (patrón estándar)
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
])
