import { describe, expect, test } from "vitest";
import {
  nextActions,
  resolvedRevisions
} from "../../../src/application/merge-resolution-revisions.js";
import type {
  StoredRevision,
  StoredUseCase
} from "../../../src/domain/entities/index.js";
import { usecase } from "./merge-resolution-data.js";
import { depsFor } from "./merge-resolution-fixtures.js";

describe("merge resolution revisions", () => {
  test("resolves mine and manual title choices into new revisions", async () => {
    const updatedUseCases: StoredUseCase[] = [];
    const deps = depsFor({ updatedUseCases });

    await resolvedRevisions(
      deps,
      [titleConflict("usecase-1")],
      [{ entity_id: "usecase-1", field: "title", strategy: "MINE" }]
    );
    await resolvedRevisions(
      deps,
      [titleConflict("usecase-1")],
      [
        {
          entity_id: "usecase-1",
          field: "title",
          strategy: "MANUAL",
          value: "Manual title"
        }
      ]
    );

    expect(updatedUseCases.map((usecase) => usecase.title)).toEqual([
      "Main title",
      "Manual title"
    ]);
  });

  test("rejects unsupported conflicts before writing revisions", async () => {
    await expect(
      resolvedRevisions(
        depsFor(),
        [titleConflict("missing-usecase")],
        [
          {
            entity_id: "missing-usecase",
            field: "title",
            strategy: "MANUAL",
            value: "x"
          }
        ]
      )
    ).rejects.toThrow("Unsupported conflict resolution");
  });

  test("rejects known conflicts without a resolved title", async () => {
    await expect(
      resolvedRevisions(depsFor(), [titleConflict("usecase-1")], [])
    ).rejects.toThrow("Unsupported conflict resolution");
  });

  test("falls back to random revision ids when no id factory is provided", async () => {
    const deps = { ...depsFor(), idFactory: undefined };

    const revisions = await resolvedRevisions(
      deps,
      [titleConflict("usecase-1")],
      [{ entity_id: "usecase-1", field: "title", strategy: "MINE" }]
    );

    expect(revisions[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  test("falls back to revision entity id when suggesting next actions", async () => {
    await expect(
      nextActions(depsFor().useCaseStore, [revision("missing-usecase")])
    ).resolves.toEqual([
      {
        command: "vspec usecase show missing-usecase",
        reason: "Review the resolved use case on main."
      }
    ]);
  });
});

function titleConflict(entityId: string) {
  return {
    entity_id: entityId,
    field: "title",
    mine_value: "Source title",
    theirs_value: "Main title"
  };
}

function revision(entityId: string): StoredRevision {
  return {
    entity_id: entityId,
    entity_type: "USECASE",
    id: "revision-1",
    snapshot: usecase({ id: entityId }),
    version_number: 1
  };
}
