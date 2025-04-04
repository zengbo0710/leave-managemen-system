import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import eslint from "eslint";
import nextPlugin from "@next/eslint-plugin-next";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

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
    plugins: {
      '@next/next': nextPlugin,
      '@typescript-eslint': typescriptEslint,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      }
    },
    rules: {
      // Minimal rules to prevent critical issues
      'no-unused-vars': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@next/next/no-img-element': 'off',
      'react/prop-types': 'off',
      
      // Additional minimal Next.js specific rules
      '@next/next/no-html-link-for-pages': 'warn',
      '@next/next/no-sync-scripts': 'warn',
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
