import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    ignores: ["node_modules/", "dist/"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": "off",
    },
  },
  {
    // Compiled-output tests run under plain Node (not the TS toolchain), so
    // they need Node globals explicitly instead of relying on tsconfig types.
    files: ["test/**/*.js"],
    languageOptions: {
      globals: globals.node,
    },
  }
);
