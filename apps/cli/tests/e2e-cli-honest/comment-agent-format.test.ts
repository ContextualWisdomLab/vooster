import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
import { expectOk, seedViaCli, type CliSeed } from "./cli-setup.js";

type CommentAgentEnvelope<TData> = {
  context: {
    branch: null | string;
    project_key: null | string;
    revision: null | string;
    session_id: null | string;
  };
  data: TData;
  format_version: 1;
  suggested_next_actions: Array<{ command: string }>;
  warnings: unknown[];
};

type CommentData = {
  comment: {
    body: string;
    id: string;
    resolved: boolean;
  };
};

type CommentListData = {
  comments: Array<{
    id: string;
  }>;
};

type TestServer = Awaited<ReturnType<typeof startNetworkServer>>;

let server: TestServer;
let seed: CliSeed;

describe("honest CLI comment --format=agent", () => {
  beforeAll(async () => {
    server = await startNetworkServer("vspec-comment-agent-");
    seed = await seedViaCli({
      apiUrl: server.apiUrl,
      projectKey: "COM",
      runCli
    });
  }, 30_000);

  afterAll(async () => {
    await server.stop();
  });

  test("agent comment lifecycle", async () => {
    const added = await expectOk(
      runCli(
        [
          "comment",
          "add",
          seed.usecaseKey,
          "--body",
          "Review this flow.",
          "--project-id",
          seed.projectId,
          "--format=agent"
        ],
        seed.env
      )
    );
    expect(seed.env.VSPEC_CONFIG_PATH).toContain("config.json");
    const addEnvelope = expectAgentEnvelope<CommentData>(added.stdout);
    expect(addEnvelope.context).toEqual(defaultContext());
    expect(addEnvelope.data.comment.body).toBe("Review this flow.");
    const commentId = addEnvelope.data.comment.id;

    const listed = await expectOk(
      runCli(["comment", "list", seed.usecaseKey, "--format=agent"], seed.env)
    );
    const listEnvelope = expectAgentEnvelope<CommentListData>(listed.stdout);
    expect(listEnvelope.context).toEqual(defaultContext());
    expect(listEnvelope.data.comments.some((comment) => comment.id === commentId)).toBe(
      true
    );

    const edited = await expectOk(
      runCli(
        [
          "comment",
          "edit",
          commentId,
          "--body",
          "Addressed in spec.",
          "--format=agent"
        ],
        seed.env
      )
    );
    const editEnvelope = expectAgentEnvelope<CommentData>(edited.stdout);
    expect(editEnvelope.context).toEqual(defaultContext());
    expect(editEnvelope.data.comment.id).toBe(commentId);
    expect(editEnvelope.data.comment.body).toBe("Addressed in spec.");

    const resolved = await expectOk(
      runCli(["comment", "resolve", commentId, "--format=agent"], seed.env)
    );
    const resolveEnvelope = expectAgentEnvelope<CommentData>(resolved.stdout);
    expect(resolveEnvelope.context).toEqual(defaultContext());
    expect(resolveEnvelope.data.comment.id).toBe(commentId);
    expect(resolveEnvelope.data.comment.resolved).toBe(true);

    const deleted = await expectOk(
      runCli(["comment", "delete", commentId, "--format=agent"], seed.env)
    );
    expect(deleted.stdout).not.toContain("Deleted true");
    const deleteEnvelope = expectAgentEnvelope<CommentData>(deleted.stdout);
    expect(deleteEnvelope.context).toEqual(defaultContext());
    expect(deleteEnvelope.data.comment.id).toBe(commentId);
  });
});

function expectAgentEnvelope<TData>(stdout: string): CommentAgentEnvelope<TData> {
  const envelope = JSON.parse(stdout) as unknown as CommentAgentEnvelope<TData>;
  expect(envelope.format_version).toBe(1);
  expect(envelope).toHaveProperty("data");
  expect(envelope).toHaveProperty("context");
  expect(envelope).toHaveProperty("suggested_next_actions");
  expect(envelope).toHaveProperty("warnings");
  expect(Array.isArray(envelope.suggested_next_actions)).toBe(true);
  expect(Array.isArray(envelope.warnings)).toBe(true);
  return envelope;
}

function defaultContext(): CommentAgentEnvelope<unknown>["context"] {
  return {
    branch: null,
    project_key: null,
    revision: null,
    session_id: null
  };
}
