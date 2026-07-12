import js from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/.astro/**",
      "**/.next/**",
      "**/.state/**",
      "coverage/**",
      "dist/**",
      "**/dist/**",
      "node_modules/**",
      "apps/app/next-env.d.ts",
      "apps/api/tests/e2e/_template.test.ts"
    ]
  },
  {
    files: ["**/*.{js,mjs}"],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly"
      }
    }
  },
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
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
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          rules: [
            {
              from: { type: "cli" },
              allow: { to: { type: ["http", "application", "ports", "domain"] } }
            },
            {
              from: { type: "http" },
              allow: { to: { type: ["application", "ports", "domain"] } }
            },
            {
              from: { type: "application" },
              allow: { to: { type: ["ports", "domain"] } }
            },
            {
              from: { type: "infrastructure" },
              allow: { to: { type: ["ports", "domain"] } }
            },
            {
              from: { type: "ports" },
              allow: { to: { type: "domain" } }
            }
          ]
        }
      ]
    }
  }
);
