import { describe, expect, test } from "vitest";
import type { StoredUseCase } from "../../../src/domain/entities/index.js";
import {
  cacheEntries,
  networkFailureProblem,
  staleFileConflict,
  suggestedSyncActions
} from "../../../src/http/sync-result-support.js";

describe("sync result support", () => {
  test("maps sync results into local cache entries", () => {
    expect(
      cacheEntries([
        {
          current_revision: "revision-1",
          path: "specs/PAY-001.md",
          status: "OK"
        },
        {
          current_revision: "revision-2",
          path: "specs/PAY-002.md",
          status: "CONFLICT"
        }
      ])
    ).toEqual([
      { path: "specs/PAY-001.md", revision: "revision-1", status: "SYNCED" },
      { path: "specs/PAY-002.md", revision: "revision-2", status: "UNRESOLVED" }
    ]);
  });

  test("serializes queued push details when the network is unavailable", () => {
    expect(
      networkFailureProblem([{ base_revision: "revision-1", path: "specs/PAY-001.md" }])
    ).toMatchObject({
      pending_push: {
        files: [{ base_revision: "revision-1", path: "specs/PAY-001.md" }],
        status: "QUEUED"
      },
      status: 503,
      suggested_next_actions: [
        {
          command: "vspec push",
          reason: "Retry the queued push once connectivity returns."
        }
      ],
      title: "Sync network unavailable"
    });
  });

  test("builds a conflict result with local and remote content", () => {
    const result = staleFileConflict(
      storedUseCase(),
      {
        content: "# Local title",
        path: "specs/PAY-001.md"
      },
      "# Place an order\n\n## Main Success Scenario"
    );

    expect(result).toMatchObject({
      current_revision: "revision-current",
      impact: { entity_id: "usecase-1", severity: "BREAKING" },
      path: "specs/PAY-001.md",
      status: "CONFLICT"
    });
    expect(result.conflict_content).toContain("<<<<<<< local\n# Local title");
    expect(result.conflict_content).toContain("# Place an order");
    expect(result.conflict_content).toContain("## Main Success Scenario");
    expect(result.conflict_content).toContain(">>>>>>> remote (revision-current)");
  });

  test("suggests conflict actions only when a conflict exists", () => {
    expect(
      suggestedSyncActions([
        { current_revision: "revision-1", path: "specs/PAY-001.md", status: "OK" }
      ])
    ).toEqual([
      {
        command: "vspec pull",
        reason: "Refresh local files after successful push."
      }
    ]);
    expect(
      suggestedSyncActions([
        {
          current_revision: "revision-2",
          path: "specs/PAY-002.md",
          status: "CONFLICT"
        }
      ])
    ).toEqual([
      {
        command: "vspec diff",
        reason: "Inspect the server and local changes before resolving the conflict."
      },
      {
        command: "vspec push",
        reason: "Push again after removing conflict markers."
      }
    ]);
  });
});

function storedUseCase(): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-current",
    format: "BRIEF",
    id: "usecase-1",
    key: "PAY-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P1",
    project_id: "project-1",
    scope: "Checkout",
    status: "DRAFT",
    title: "Place an order"
  };
}
