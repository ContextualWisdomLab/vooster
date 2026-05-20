import { execFile } from "node:child_process";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { describe, test } from "vitest";

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, "../..");
const fixturePath = path.join(root, "tests/fixtures/domain-entity-imports.test-fixture.ts");

describe("domain entity vocabulary", () => {
  test("exports a Stored<Model> type for every Prisma model", async () => {
    const schema = await readFile(path.join(root, "prisma/schema.prisma"), "utf8");
    const storedTypes = [...schema.matchAll(/^model\s+(\w+)/gm)].map(
      ([, model]) => `Stored${model ?? ""}`
    );

    await writeFile(fixturePath, typeImportFixture(storedTypes));

    try {
      await execFileAsync("npx", ["tsc", "--noEmit", "--pretty", "false"], {
        cwd: root,
        env: process.env,
        maxBuffer: 10 * 1024 * 1024
      });
    } finally {
      await unlink(fixturePath).catch(() => undefined);
    }
  }, 30_000);
});

function typeImportFixture(storedTypes: string[]): string {
  const imports = storedTypes.map((storedType) => `  ${storedType}`).join(",\n");
  const tupleItems = storedTypes.map((storedType) => `  ${storedType}`).join(",\n");

  return [
    "import type {",
    imports,
    '} from "../../src/domain/entities/index.js";',
    "",
    "type DomainEntityImports = [",
    tupleItems,
    "];",
    "",
    "export type { DomainEntityImports };",
    ""
  ].join("\n");
}
