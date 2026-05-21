import { Command, Flags } from "@oclif/core";

import { writeConfig } from "../config-store.js";
import { runDeviceFlow } from "../device-flow.js";
import { postJson } from "../http-client.js";

type LoginFlags = {
  "api-url"?: string;
  "workspace-name"?: string;
  "workspace-slug"?: string;
};

type OAuthFlags = {
  apiUrl: string;
};

type SignupFlags = {
  workspaceName: string;
  workspaceSlug: string;
};

type SignupResponse = {
  recommended_next_command: string;
  user: {
    email: string;
  };
  workspace: {
    id: string;
    slug: string;
  };
};

type LoginResponse = {
  recommended_next_command?: string;
  user: {
    github_id: string;
  };
  workspaces: Array<{
    id: string;
    role: string;
    slug: string;
  }>;
};

export class LoginCommand extends Command {
  static override description = "Authenticate with GitHub OAuth.";

  static override flags = {
    "api-url": Flags.string(),
    "workspace-name": Flags.string(),
    "workspace-slug": Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(LoginCommand);

    await runLogin(parsed.flags, this.log.bind(this));
  }
}

export async function runLogin(
  flags: LoginFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const oauthFlags = oauthFlagsFrom(flags);
  const signupFlags = signupFlagsFrom(flags);
  const device = await runDeviceFlow({
    apiUrl: oauthFlags.apiUrl,
    authStub: process.env.VSPEC_AUTH_STUB === "1",
    writeLine
  });
  const callback = await postJson(
    `${oauthFlags.apiUrl}/v1/auth/github/token`,
    {
      access_token: device.accessToken,
      ...(signupFlags === undefined
        ? {}
        : {
            workspace: {
              name: signupFlags.workspaceName,
              slug: signupFlags.workspaceSlug
            }
          })
    }
  );
  if (signupFlags === undefined) {
    const body = callback.body as LoginResponse;
    writeConfig(configPatch(oauthFlags.apiUrl, callback.cookie, firstWorkspace(body)));
    printLogin(body, writeLine);
    return;
  }

  const body = callback.body as SignupResponse;
  writeConfig(configPatch(oauthFlags.apiUrl, callback.cookie, {
    id: body.workspace.id,
    slug: body.workspace.slug
  }));
  printSignup(body, writeLine);
}

function printSignup(callbackBody: SignupResponse, writeLine: (message: string) => void): void {
  writeLine(`Signed up ${callbackBody.user.email}`);
  writeLine(`Workspace ${callbackBody.workspace.slug} ${callbackBody.workspace.id}`);
  writeLine(callbackBody.recommended_next_command);
}

function printLogin(callbackBody: LoginResponse, writeLine: (message: string) => void): void {
  writeLine(`Logged in ${callbackBody.user.github_id}`);
  for (const workspace of callbackBody.workspaces) {
    writeLine(`Workspace ${workspace.slug} ${workspace.id} ${workspace.role}`);
  }
  if (callbackBody.recommended_next_command !== undefined) {
    writeLine(callbackBody.recommended_next_command);
  }
}

function oauthFlagsFrom(flags: LoginFlags): OAuthFlags {
  return {
    apiUrl: flags["api-url"] ?? process.env.VSPEC_API_URL ?? "http://127.0.0.1:3000"
  };
}

function signupFlagsFrom(flags: LoginFlags): SignupFlags | undefined {
  if (flags["workspace-name"] === undefined && flags["workspace-slug"] === undefined) {
    return undefined;
  }

  return {
    workspaceName: requiredFlag(flags, "workspace-name"),
    workspaceSlug: requiredFlag(flags, "workspace-slug")
  };
}

function requiredFlag(values: LoginFlags, name: keyof LoginFlags): string {
  const value = values[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing --${name}.`);
  }

  return value;
}

function configPatch(
  apiUrl: string,
  cookie: string,
  workspace: { id: string; slug: string } | undefined
) {
  return {
    api_url: apiUrl,
    current_workspace_id: workspace?.id,
    current_workspace_slug: workspace?.slug,
    profile: "default",
    session_token: sessionTokenFrom(cookie)
  };
}

function firstWorkspace(body: LoginResponse): { id: string; slug: string } | undefined {
  return body.workspaces[0];
}

function sessionTokenFrom(cookie: string): string {
  const token = /vspec_session=([^;,]+)/.exec(cookie)?.[1];
  if (token === undefined) {
    throw new Error("Login response did not include a session cookie.");
  }

  return token;
}
