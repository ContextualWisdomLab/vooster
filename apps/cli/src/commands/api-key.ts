import { Args, Command, Flags } from "@oclif/core";
import {
  apiKeyCreateRequestSchema,
  apiKeyCreateResponseSchema,
  apiKeyListQuerySchema,
  apiKeyListResponseSchema,
  apiKeyRevokeResponseSchema,
  type ApiKeyCreateResponse,
  type ApiKeyListResponse,
  type ApiKeyPublicResponse,
  type ApiKeyRevokeResponse
} from "@vooster/contracts";

import { buildAgentEnvelope } from "../agent-envelope.js";
import { requiredArgument, requiredFlag, resolveContextFlag } from "../flag-values.js";
import { deleteJson, fetchJson, postJson } from "../http-client.js";

type ApiKeyFlags = {
  "api-url"?: string;
  format?: string;
  name?: string;
  scopes?: string;
  "session-cookie"?: string;
  "workspace-id"?: string;
};

type ApiKeyWorkspaceFlags = {
  apiUrl: string;
  sessionCookie: string;
  workspaceId: string;
};

type ApiKeyCreateFlags = ApiKeyWorkspaceFlags & {
  name: string;
  scopes: string[];
};

type ApiKeyRevokeFlags = {
  apiKeyId: string;
  apiUrl: string;
  sessionCookie: string;
};

export class ApiKeyCommand extends Command {
  static override description = "Manage workspace API keys.";

  static override args = {
    action: Args.string(),
    apiKeyId: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    format: Flags.string(),
    name: Flags.string(),
    scopes: Flags.string(),
    "session-cookie": Flags.string(),
    "workspace-id": Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(ApiKeyCommand);

    await runApiKey(
      parsed.flags,
      parsed.args.action,
      parsed.args.apiKeyId,
      this.log.bind(this)
    );
  }
}

export async function runApiKey(
  flags: ApiKeyFlags,
  action: string | undefined,
  apiKeyId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  if (action === "create") {
    await createApiKey(flags, writeLine);
    return;
  }
  if (action === "list") {
    await listApiKeys(flags, writeLine);
    return;
  }
  if (action === "revoke") {
    await revokeApiKey(flags, apiKeyId, writeLine);
    return;
  }

  throw new Error("Missing api-key action.");
}

async function createApiKey(
  flags: ApiKeyFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const apiKeyFlags = apiKeyCreateFlagsFrom(flags);
  const body = apiKeyCreateRequestSchema.parse({
    name: apiKeyFlags.name,
    scopes: apiKeyFlags.scopes,
    workspace_id: apiKeyFlags.workspaceId
  });
  const response = await postJson(`${apiKeyFlags.apiUrl}/v1/api-keys`, body, {
    Cookie: apiKeyFlags.sessionCookie
  });
  const parsedBody: ApiKeyCreateResponse = apiKeyCreateResponseSchema.parse(
    response.body
  );

  if (flags.format === "agent") {
    writeLine(
      JSON.stringify(
        buildAgentEnvelope({
          data: parsedBody,
          suggested_next_actions: parsedBody.suggested_next_actions
        }),
        null,
        2
      )
    );
    return;
  }

  printApiKey(parsedBody.api_key, writeLine);
  writeLine(`Token ${parsedBody.plaintext_token}`);
  writeLine("Only shown once");
  for (const action of parsedBody.suggested_next_actions) {
    writeLine(action.command);
  }
}

async function listApiKeys(
  flags: ApiKeyFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const apiKeyFlags = apiKeyWorkspaceFlagsFrom(flags);
  const url = new URL("/v1/api-keys", apiKeyFlags.apiUrl);
  url.searchParams.set("workspace_id", apiKeyFlags.workspaceId);
  apiKeyListQuerySchema.parse(Object.fromEntries(url.searchParams));
  const response = await fetchJson(url, {
    headers: {
      Cookie: apiKeyFlags.sessionCookie
    }
  });
  const body: ApiKeyListResponse = apiKeyListResponseSchema.parse(response.body);

  if (flags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: body }), null, 2));
    return;
  }

  writeLine(`ApiKeys ${String(body.api_keys.length)}`);
  for (const apiKey of body.api_keys) {
    printApiKey(apiKey, writeLine);
  }
}

async function revokeApiKey(
  flags: ApiKeyFlags,
  apiKeyId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const apiKeyFlags = apiKeyRevokeFlagsFrom(flags, apiKeyId);
  const response = await deleteJson(
    `${apiKeyFlags.apiUrl}/v1/api-keys/${apiKeyFlags.apiKeyId}`,
    {
      Cookie: apiKeyFlags.sessionCookie
    }
  );
  const body: ApiKeyRevokeResponse = apiKeyRevokeResponseSchema.parse(response.body);

  if (flags.format === "agent") {
    writeLine(
      JSON.stringify(
        buildAgentEnvelope({
          data: body,
          suggested_next_actions: body.suggested_next_actions
        }),
        null,
        2
      )
    );
    return;
  }

  printApiKey(body.api_key, writeLine);
  writeLine(`Revoked ${body.api_key.revoked_at ?? "null"}`);
  if (body.idempotent === true) {
    writeLine("Idempotent true");
  }
  for (const action of body.suggested_next_actions) {
    writeLine(action.command);
  }
}

function printApiKey(
  apiKey: ApiKeyPublicResponse,
  writeLine: (message: string) => void
): void {
  writeLine(`ApiKey ${apiKey.id}`);
  writeLine(`Name ${apiKey.name}`);
  writeLine(`Scopes ${apiKey.scopes.join(", ")}`);
  writeLine(`Revoked ${apiKey.revoked_at ?? "false"}`);
}

function apiKeyWorkspaceFlagsFrom(flags: ApiKeyFlags): ApiKeyWorkspaceFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    workspaceId: resolveContextFlag(flags, "workspace-id")
  };
}

function apiKeyCreateFlagsFrom(flags: ApiKeyFlags): ApiKeyCreateFlags {
  return {
    ...apiKeyWorkspaceFlagsFrom(flags),
    name: requiredFlag(flags, "name"),
    scopes: requiredFlag(flags, "scopes")
      .split(",")
      .map((scope) => scope.trim())
      .filter((scope) => scope.length > 0)
  };
}

function apiKeyRevokeFlagsFrom(
  flags: ApiKeyFlags,
  apiKeyId: string | undefined
): ApiKeyRevokeFlags {
  return {
    apiKeyId: requiredArgument(apiKeyId, "api-key-id"),
    apiUrl: resolveContextFlag(flags, "api-url"),
    sessionCookie: resolveContextFlag(flags, "session-cookie")
  };
}
