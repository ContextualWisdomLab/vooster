import { Command, Flags } from "@oclif/core";

import { fetchJson, postJson } from "../http-client.js";

type LoginFlags = {
  "api-url"?: string;
  "github-code"?: string;
  "workspace-name"?: string;
  "workspace-slug"?: string;
};

type OAuthFlags = {
  apiUrl: string;
  githubCode: string;
};

type SignupFlags = {
  workspaceName: string;
  workspaceSlug: string;
};

type OAuthStartResponse = {
  state: string;
};

type SignupResponse = {
  recommended_next_command: string;
  user: {
    email: string;
  };
  workspace: {
    slug: string;
  };
};

type LoginResponse = {
  recommended_next_command?: string;
  user: {
    github_id: string;
  };
  workspaces: Array<{
    role: string;
    slug: string;
  }>;
};

export class LoginCommand extends Command {
  static override description = "Authenticate with GitHub OAuth.";

  static override flags = {
    "api-url": Flags.string(),
    "github-code": Flags.string(),
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
  const start = await postJson(
    `${oauthFlags.apiUrl}/v1/auth/github/start`,
    signupFlags === undefined
      ? { flow: "login" }
      : {
          workspace: {
            name: signupFlags.workspaceName,
            slug: signupFlags.workspaceSlug
          }
        }
  );
  const startBody = start.body as OAuthStartResponse;
  const callbackUrl = new URL("/v1/auth/github/callback", oauthFlags.apiUrl);
  callbackUrl.searchParams.set("code", oauthFlags.githubCode);
  callbackUrl.searchParams.set("state", startBody.state);

  const callback = await fetchJson(callbackUrl, {
    headers: {
      Cookie: start.cookie
    }
  });
  if (signupFlags === undefined) {
    printLogin(callback.body as LoginResponse, writeLine);
    return;
  }

  printSignup(callback.body as SignupResponse, writeLine);
}

function printSignup(callbackBody: SignupResponse, writeLine: (message: string) => void): void {
  writeLine(`Signed up ${callbackBody.user.email}`);
  writeLine(`Workspace ${callbackBody.workspace.slug}`);
  writeLine(callbackBody.recommended_next_command);
}

function printLogin(callbackBody: LoginResponse, writeLine: (message: string) => void): void {
  writeLine(`Logged in ${callbackBody.user.github_id}`);
  for (const workspace of callbackBody.workspaces) {
    writeLine(`Workspace ${workspace.slug} ${workspace.role}`);
  }
  if (callbackBody.recommended_next_command !== undefined) {
    writeLine(callbackBody.recommended_next_command);
  }
}

function oauthFlagsFrom(flags: LoginFlags): OAuthFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    githubCode: requiredFlag(flags, "github-code")
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
