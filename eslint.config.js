import js from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**", "tests/e2e/_template.test.ts"]
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
        { type: "cli", pattern: "src/cli" },
        { type: "http", pattern: "src/http" },
        { type: "application", pattern: "src/application" },
        { type: "domain", pattern: "src/domain" },
        { type: "ports", pattern: "src/ports" },
        { type: "infrastructure", pattern: "src/infrastructure" }
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
