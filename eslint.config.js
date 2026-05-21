import js from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**", "apps/api/tests/e2e/_template.test.ts"]
  },
  {
    files: ["**/*.{js,mjs}"],
    extends: [js.configs.recommended]
  },
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: {
      boundaries
    },
    settings: {
      "boundaries/elements": [
        { type: "cli", pattern: "apps/cli/src" },
        { type: "http", pattern: "apps/api/src/http" },
        { type: "application", pattern: "apps/api/src/application" },
        { type: "domain", pattern: "apps/api/src/domain" },
        { type: "ports", pattern: "apps/api/src/ports" },
        { type: "infrastructure", pattern: "apps/api/src/infrastructure" }
      ]
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "boundaries/element-types": ["error", {
        default: "disallow",
        rules: [
          { from: "cli", allow: ["http", "application", "ports", "domain"] },
          { from: "http", allow: ["application", "ports", "domain"] },
          { from: "application", allow: ["ports", "domain"] },
          { from: "infrastructure", allow: ["ports", "domain"] },
          { from: "ports", allow: ["domain"] }
        ]
      }]
    }
  }
);
