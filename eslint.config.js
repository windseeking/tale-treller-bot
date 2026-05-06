import { defineConfig } from 'eslint/config'
import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'

export default defineConfig(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'docs/**',
      'plans/**',
    ]
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    plugins: {
      '@stylistic': stylistic
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      semi: ['error', 'never'],
      quotes: ['error', 'single'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-irregular-whitespace': ['off'],
      '@stylistic/max-statements-per-line': ['warn', { max: 2 }]
    }
  },
  {
    files: ['**/*.{ts,vue}'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'vue/multi-word-component-names': 'off',
      'vue/no-reserved-component-names': 'off'
    }
  },
  {
    files: ['**/*.vue'],
    rules: {
      'vue/html-closing-bracket-newline': [
        'error', {
          'singleline': 'never',
          'multiline': 'never'
        }
      ]
    },
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue']
      }
    }
  }
)
