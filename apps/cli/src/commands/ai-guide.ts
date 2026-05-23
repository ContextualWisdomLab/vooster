import { Command, Flags } from "@oclif/core";

import { resolveContextFlag } from "../flag-values.js";
import { postJson } from "../http-client.js";

const cliVersion = "1.0.0";

type AiGuideFlags = {
  "api-url"?: string;
  format?: string;
};

type ParsedAiGuideFlags = {
  apiUrl: string;
  format: "json" | "markdown";
};

type AiGuideResponse = {
  content: string;
  suggested_next_actions: Array<{
    command: string;
  }>;
};

export class AiGuideCommand extends Command {
  static override description = "Show AI-agent guidance for the current CLI version.";

  static override flags = {
    "api-url": Flags.string(),
    format: Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(AiGuideCommand);

    await runAiGuide(parsed.flags, this.log.bind(this));
  }
}

export async function runAiGuide(
  flags: AiGuideFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const guideFlags = aiGuideFlagsFrom(flags);
  const url = new URL("/v1/ai-guide", guideFlags.apiUrl);
  url.searchParams.set("cli_version", cliVersion);
  if (guideFlags.format === "json") {
    url.searchParams.set("format", "json");
  }
  const response = await postJson(url.toString(), {});

  if (guideFlags.format === "json") {
    writeLine(JSON.stringify(response.body, null, 2));
    return;
  }

  const body = response.body as AiGuideResponse;
  writeLine(body.content.trimEnd());
  for (const action of body.suggested_next_actions) {
    writeLine(action.command);
  }
}

function aiGuideFlagsFrom(flags: AiGuideFlags): ParsedAiGuideFlags {
  const format = optionalFlag(flags, "format") ?? "markdown";
  if (format !== "json" && format !== "markdown") {
    throw new Error("AI guide format must be markdown or json.");
  }

  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    format
  };
}

function optionalFlag(
  values: AiGuideFlags,
  name: keyof AiGuideFlags
): string | undefined {
  const value = values[name];
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  return value;
}
