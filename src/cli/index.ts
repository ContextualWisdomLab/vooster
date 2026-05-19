import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Args, Command, Flags, flush, handle } from "@oclif/core";

const root = dirname(fileURLToPath(import.meta.url));

export class VspecCommand extends Command {
  static override description = "Cockburn-style use case management for concurrent agents.";

  static override args = {
    command: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    "github-code": Flags.string(),
    help: Flags.help({ char: "h" }),
    version: Flags.version({ char: "v" }),
    "workspace-name": Flags.string(),
    "workspace-slug": Flags.string()
  };

  static override strict = false;

  override async run(): Promise<void> {
    const parsed = await this.parse(VspecCommand);

    if (parsed.args.command === "login") {
      await this.login(parsed.flags);
      return;
    }

    this.log("vspec CLI");
  }

  private async login(flags: ParsedFlags): Promise<void> {
    const loginFlags = loginFlagsFrom(flags);
    const start = await postJson(`${loginFlags.apiUrl}/v1/auth/github/start`, {
      workspace: {
        name: loginFlags.workspaceName,
        slug: loginFlags.workspaceSlug
      }
    });
    const startBody = start.body as OAuthStartResponse;
    const callbackUrl = new URL("/v1/auth/github/callback", loginFlags.apiUrl);
    callbackUrl.searchParams.set("code", loginFlags.githubCode);
    callbackUrl.searchParams.set("state", startBody.state);

    const callback = await fetchJson(callbackUrl, {
      headers: {
        Cookie: start.cookie
      }
    });
    const callbackBody = callback.body as SignupResponse;

    this.log(`Signed up ${callbackBody.user.email}`);
    this.log(`Workspace ${callbackBody.workspace.slug}`);
    this.log(callbackBody.recommended_next_command);
  }
}

type LoginFlags = {
  apiUrl: string;
  githubCode: string;
  workspaceName: string;
  workspaceSlug: string;
};

type ParsedFlags = {
  "api-url"?: string;
  "github-code"?: string;
  "workspace-name"?: string;
  "workspace-slug"?: string;
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

function loginFlagsFrom(flags: ParsedFlags): LoginFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    githubCode: requiredFlag(flags, "github-code"),
    workspaceName: requiredFlag(flags, "workspace-name"),
    workspaceSlug: requiredFlag(flags, "workspace-slug")
  };
}

function requiredFlag(values: ParsedFlags, name: keyof ParsedFlags): string {
  const value = values[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing --${name}.`);
  }

  return value;
}

type JsonResponse = {
  body: unknown;
  cookie: string;
};

async function postJson(url: string, body: unknown): Promise<JsonResponse> {
  return fetchJson(url, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
}

async function fetchJson(
  url: URL | string,
  init: RequestInit
): Promise<JsonResponse> {
  const response = await fetch(url, init);
  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(`API request failed with ${String(response.status)}.`);
  }

  return {
    body,
    cookie: response.headers.get("set-cookie") ?? ""
  };
}

export async function runCli(argv = process.argv.slice(2)): Promise<void> {
  try {
    await VspecCommand.run(argv, {
      pjson: {
        name: "vspec",
        oclif: {
          commands: {
            strategy: "single",
            target: "index.js"
          }
        },
        version: "1.0.0"
      },
      root
    });
    await flush();
  } catch (error: unknown) {
    await handle(error instanceof Error ? error : new Error(String(error)));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void runCli();
}
