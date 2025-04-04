import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import eslint from "eslint";
import nextPlugin from "@next/eslint-plugin-next";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Spread existing configurations
  ...compat.extends("next/core-web-vitals"),
  
  // Flat config for Next.js and TypeScript
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    plugins: {
      '@next/next': nextPlugin,
      '@typescript-eslint': typescriptEslint,
      'react': reactPlugin
    },
    rules: {
      // Disable specific warnings or errors
      'react/no-unescaped-entities': 'off',
      '@next/next/no-img-element': 'off',
      'react/display-name': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
    }
  },
  
  // Ignore specific files
  {
    ignores: [
      '.next/',
      'node_modules/',
      'out/',
      'build/',
      'dist/'
    ]
  }
];

export default eslintConfig;
