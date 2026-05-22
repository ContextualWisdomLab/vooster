import { Args, Command, Flags } from "@oclif/core";

import {
  printComment,
  printCommentResponse,
  type CommentListResponse,
  type CommentResponse
} from "./comment-output.js";
import { buildAgentEnvelope } from "../agent-envelope.js";
import { requiredArgument, requiredFlag, resolveContextFlag } from "../flag-values.js";
import { deleteJson, fetchJson, patchJson, postJson } from "../http-client.js";

type CommentCliFlags = {
  "api-url"?: string;
  body?: string;
  format?: string;
  "session-cookie"?: string;
};

type CommentTargetFlags = {
  apiUrl: string;
  sessionCookie: string;
  targetId: string;
};

type CommentBodyFlags = CommentTargetFlags & {
  body: string;
};

export class CommentCommand extends Command {
  static override description = "Manage use case comments.";

  static override args = {
    action: Args.string(),
    targetId: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    body: Flags.string(),
    format: Flags.string(),
    "session-cookie": Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(CommentCommand);

    await runComment(
      parsed.flags,
      parsed.args.action,
      parsed.args.targetId,
      this.log.bind(this)
    );
  }
}

export async function runComment(
  flags: CommentCliFlags,
  action: string | undefined,
  targetId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  if (action === "add") {
    await addComment(flags, targetId, writeLine);
    return;
  }
  if (action === "list") {
    await listComments(flags, targetId, writeLine);
    return;
  }
  if (action === "edit") {
    await editComment(flags, targetId, writeLine);
    return;
  }
  if (action === "resolve") {
    await resolveComment(flags, targetId, writeLine);
    return;
  }
  if (action === "delete") {
    await deleteComment(flags, targetId, writeLine);
    return;
  }

  throw new Error("Missing comment action.");
}

async function addComment(
  flags: CommentCliFlags,
  targetId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const commentFlags = commentBodyFlagsFrom(flags, targetId, "usecase-id");
  const response = await postJson(
    `${commentFlags.apiUrl}/v1/usecases/${commentFlags.targetId}/comments`,
    { body: commentFlags.body },
    {
      Cookie: commentFlags.sessionCookie
    }
  );
  const body = response.body as CommentResponse;
  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({
      data: body,
      suggested_next_actions: body.suggested_next_actions
    }), null, 2));
    return;
  }

  printCommentResponse(body, writeLine);
}

async function listComments(
  flags: CommentCliFlags,
  targetId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const commentFlags = commentTargetFlagsFrom(flags, targetId, "usecase-id");
  const response = await fetchJson(
    `${commentFlags.apiUrl}/v1/usecases/${commentFlags.targetId}/comments`,
    {
      headers: {
        Cookie: commentFlags.sessionCookie
      }
    }
  );
  const body = response.body as CommentListResponse;

  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: body }), null, 2));
    return;
  }

  writeLine(`Comments ${String(body.comments.length)}`);
  for (const comment of body.comments) {
    printComment(comment, writeLine);
  }
}

async function editComment(
  flags: CommentCliFlags,
  targetId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const commentFlags = commentBodyFlagsFrom(flags, targetId, "comment-id");
  const response = await patchJson(
    `${commentFlags.apiUrl}/v1/comments/${commentFlags.targetId}`,
    { body: commentFlags.body },
    {
      Cookie: commentFlags.sessionCookie
    }
  );
  const body = response.body as CommentResponse;
  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({
      data: body,
      suggested_next_actions: body.suggested_next_actions
    }), null, 2));
    return;
  }

  printCommentResponse(body, writeLine);
}

async function resolveComment(
  flags: CommentCliFlags,
  targetId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const commentFlags = commentTargetFlagsFrom(flags, targetId, "comment-id");
  const response = await patchJson(
    `${commentFlags.apiUrl}/v1/comments/${commentFlags.targetId}`,
    { resolved: true },
    {
      Cookie: commentFlags.sessionCookie
    }
  );
  const body = response.body as CommentResponse;
  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({
      data: body,
      suggested_next_actions: body.suggested_next_actions
    }), null, 2));
    return;
  }

  printCommentResponse(body, writeLine);
}

async function deleteComment(
  flags: CommentCliFlags,
  targetId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const commentFlags = commentTargetFlagsFrom(flags, targetId, "comment-id");
  const response = await deleteJson(`${commentFlags.apiUrl}/v1/comments/${commentFlags.targetId}`, {
    Cookie: commentFlags.sessionCookie
  });
  const body = response.body as CommentResponse;
  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({
      data: body,
      suggested_next_actions: body.suggested_next_actions
    }), null, 2));
    return;
  }

  printCommentResponse(body, writeLine);
  writeLine("Deleted true");
}

function commentTargetFlagsFrom(
  flags: CommentCliFlags,
  targetId: string | undefined,
  argumentName: string
): CommentTargetFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    targetId: requiredArgument(targetId, argumentName)
  };
}

function commentBodyFlagsFrom(
  flags: CommentCliFlags,
  targetId: string | undefined,
  argumentName: string
): CommentBodyFlags {
  return {
    ...commentTargetFlagsFrom(flags, targetId, argumentName),
    body: requiredFlag(flags, "body")
  };
}
