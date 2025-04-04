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
    plugins: {
      '@next/next': nextPlugin,
      '@typescript-eslint': typescriptEslint,
      'react': reactPlugin
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {
      // Convert all rules to warnings
      'no-unused-vars': 'warn',
      'no-console': 'warn',
      'no-debugger': 'warn',
      
      // TypeScript rules
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/no-empty-interface': 'warn',
      '@typescript-eslint/no-inferrable-types': 'warn',
      
      // Next.js rules
      '@next/next/no-img-element': 'warn',
      '@next/next/no-html-link-for-pages': 'warn',
      '@next/next/no-sync-scripts': 'warn',
      
      // React rules
      'react/prop-types': 'warn',
      'react/no-unescaped-entities': 'warn',
      'react/react-in-jsx-scope': 'warn',
      'react/no-direct-mutation-state': 'warn',
      'react/no-deprecated': 'warn',
      
      // Accessibility rules
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/aria-role': 'warn',
      
      // Completely disable some strict checks
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-var-requires': 'off'
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
