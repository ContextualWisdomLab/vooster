import { execFile } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, "../../../..");
const fixtureDir = path.join(root, ".state/domain-entity-test");
const fixturePath = path.join(fixtureDir, "domain-entity-imports.test-fixture.ts");
const tsconfigPath = path.join(fixtureDir, "tsconfig.json");

describe("domain entity vocabulary", () => {
  test("exports a Stored<Model> type for every Prisma model", async () => {
    const schema = await readFile(
      path.join(root, "apps/api/prisma/schema.prisma"),
      "utf8"
    );
    const storedTypes = [...schema.matchAll(/^model\s+(\w+)/gm)].map(
      ([, model]) => `Stored${model ?? ""}`
    );

    await mkdir(fixtureDir, { recursive: true });
    await writeFile(fixturePath, typeImportFixture(storedTypes));
    await writeFile(tsconfigPath, domainEntityTsconfig());

    try {
      const result = await execFileAsync(
        "npx",
        ["tsc", "-p", tsconfigPath, "--pretty", "false"],
        {
          cwd: root,
          env: process.env,
          maxBuffer: 10 * 1024 * 1024
        }
      );
      expect(result.stderr).toBe("");
    } finally {
      await Promise.all([
        unlink(fixturePath).catch(() => undefined),
        unlink(tsconfigPath).catch(() => undefined)
      ]);
    }
  }, 30_000);
});

function domainEntityTsconfig(): string {
  return `${JSON.stringify(
    {
      extends: "../../tsconfig.json",
      include: [
        "domain-entity-imports.test-fixture.ts",
        "../../apps/api/src/domain/**/*.ts"
      ]
    },
    null,
    2
  )}\n`;
}

function typeImportFixture(storedTypes: string[]): string {
  const imports = storedTypes.map((storedType) => `  ${storedType}`).join(",\n");
  const tupleItems = storedTypes.map((storedType) => `  ${storedType}`).join(",\n");

  return [
    "import type {",
    imports,
    '} from "../../apps/api/src/domain/entities/index.js";',
    "",
    "type DomainEntityImports = [",
    tupleItems,
    "];",
    "",
    "export type { DomainEntityImports };",
    ""
  ].join("\n");
}
