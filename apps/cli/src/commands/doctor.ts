import { Command, Flags } from "@oclif/core";

import { buildAgentEnvelope } from "../agent-envelope.js";
import { optionalFlag, requiredFlag, resolveContextFlag } from "../flag-values.js";
import { fetchJson } from "../http-client.js";

type DoctorCliFlags = {
  "api-url"?: string;
  format?: string;
  "project-id"?: string;
  "session-cookie"?: string;
  usecase?: string;
};

type DoctorFlags = {
  apiUrl: string;
  format: "agent" | "human" | "json";
  projectId: string | undefined;
  sessionCookie: string;
  usecaseId: string | undefined;
};

export class DoctorCommand extends Command {
  static override description = "Diagnose use case quality issues.";

  static override flags = {
    "api-url": Flags.string(),
    format: Flags.string(),
    "project-id": Flags.string(),
    "session-cookie": Flags.string(),
    usecase: Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(DoctorCommand);

    await runDoctor(parsed.flags, this.log.bind(this));
  }
}

export async function runDoctor(
  flags: DoctorCliFlags,
  writeLine: (message: string) => void
): Promise<void> {
  const doctorFlags = doctorFlagsFrom(flags);
  const url = new URL("/v1/doctor", doctorFlags.apiUrl);
  if (doctorFlags.usecaseId !== undefined) {
    url.searchParams.set("usecase_id", doctorFlags.usecaseId);
  } else {
    url.searchParams.set("project_id", doctorFlags.projectId ?? requiredFlag(flags, "project-id"));
  }

  const response = await fetchJson(url, {
    headers: {
      Cookie: doctorFlags.sessionCookie
    }
  });

  if (doctorFlags.format === "agent") {
    writeLine(JSON.stringify(buildAgentEnvelope({ data: response.body }), null, 2));
    return;
  }

  writeLine(JSON.stringify(response.body, null, 2));
}

function doctorFlagsFrom(flags: DoctorCliFlags): DoctorFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    format: outputFormat(flags.format),
    projectId: optionalFlag(flags, "project-id"),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    usecaseId: optionalFlag(flags, "usecase")
  };
}

function outputFormat(rawFormat: string | undefined): "agent" | "human" | "json" {
  if (rawFormat === undefined || rawFormat === "human") {
    return "human";
  }
  if (rawFormat === "agent" || rawFormat === "json") {
    return rawFormat;
  }

  throw new Error("Format must be human, json, or agent.");
}
