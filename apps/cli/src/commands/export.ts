import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Args, Command, Flags } from "@oclif/core";

import { optionalFlag, requiredArgument, resolveContextFlag } from "../flag-values.js";
import { postText } from "../http-client.js";

type ExportCliFlags = {
  "api-url"?: string;
  force?: boolean;
  output?: string;
  revision?: string;
  "session-cookie"?: string;
};

type ExportFlags = {
  apiUrl: string;
  force: boolean;
  output: string | undefined;
  revision: string | undefined;
  sessionCookie: string;
  usecaseId: string;
};

export class ExportCommand extends Command {
  static override description = "Export use cases.";

  static override args = {
    format: Args.string(),
    usecaseId: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    force: Flags.boolean(),
    output: Flags.string(),
    revision: Flags.string(),
    "session-cookie": Flags.string()
  };

  override async run(): Promise<void> {
    const parsed = await this.parse(ExportCommand);

    await runExport(
      parsed.flags,
      parsed.args.format,
      parsed.args.usecaseId,
      this.log.bind(this)
    );
  }
}

export async function runExport(
  flags: ExportCliFlags,
  format: string | undefined,
  usecaseId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  if (format === "gherkin") {
    await exportGherkin(flags, usecaseId, writeLine);
    return;
  }
  if (format === "markdown") {
    await exportMarkdown(flags, usecaseId, writeLine);
    return;
  }

  throw new Error("Missing export format.");
}

async function exportGherkin(
  flags: ExportCliFlags,
  usecaseId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const exportFlags = exportFlagsFrom(flags, usecaseId);
  const response = await postText(
    `${exportFlags.apiUrl}/v1/usecases/${exportFlags.usecaseId}/export/gherkin?format=feature`,
    exportPayload(exportFlags),
    {
      Cookie: exportFlags.sessionCookie
    }
  );

  await writeExportResponse(response.body, exportFlags.output, writeLine);
}

async function exportMarkdown(
  flags: ExportCliFlags,
  usecaseId: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  const exportFlags = exportFlagsFrom(flags, usecaseId);
  const response = await postText(
    `${exportFlags.apiUrl}/v1/usecases/${exportFlags.usecaseId}/export/markdown`,
    exportPayload(exportFlags),
    {
      Cookie: exportFlags.sessionCookie
    }
  );

  await writeExportResponse(response.body, exportFlags.output, writeLine);
}

function exportPayload(flags: ExportFlags): Record<string, string | boolean> {
  return {
    force: flags.force,
    ...(flags.output === undefined ? {} : { output_path: flags.output }),
    ...(flags.revision === undefined ? {} : { revision_id: flags.revision })
  };
}

async function writeExportResponse(
  body: string,
  output: string | undefined,
  writeLine: (message: string) => void
): Promise<void> {
  if (output === undefined) {
    writeLine(body);
    return;
  }
  await writeOutputFile(process.cwd(), output, body);
  writeLine(`Exported ${output}`);
  writeLine(`Bytes ${String(Buffer.byteLength(body, "utf8"))}`);
}

function exportFlagsFrom(
  flags: ExportCliFlags,
  usecaseId: string | undefined
): ExportFlags {
  return {
    apiUrl: resolveContextFlag(flags, "api-url"),
    force: flags.force ?? false,
    output: optionalFlag(flags, "output"),
    revision: optionalFlag(flags, "revision"),
    sessionCookie: resolveContextFlag(flags, "session-cookie"),
    usecaseId: requiredArgument(usecaseId, "usecase-id")
  };
}

async function writeOutputFile(
  root: string,
  path: string,
  content: string
): Promise<void> {
  const absolutePath = resolve(root, path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
}
