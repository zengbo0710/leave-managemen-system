import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import eslint from "eslint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Disable all rules
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      // Completely turn off all rules
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      '@next/next/no-img-element': 'off',
      'react/no-unescaped-entities': 'off',
      // Add any other specific rules you want to ensure are off
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
