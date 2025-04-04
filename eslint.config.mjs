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
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Ignore specific rules for Vercel deployment
    rules: {
      // Disable specific warnings or errors
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off",
      "react/display-name": "off",
      "react/prop-types": "off",
      "@typescript-eslint/no-unused-vars": "warn", // Change to warning instead of error
    },
    // Ignore specific files or directories
    ignorePatterns: [
      ".next/",
      "node_modules/",
      "out/",
      "build/",
      "dist/"
    ]
  }
];

export default eslintConfig;
