import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Command, Flags, flush, handle } from "@oclif/core";

const root = dirname(fileURLToPath(import.meta.url));

export class VspecCommand extends Command {
  static override description = "Cockburn-style use case management for concurrent agents.";

  static override flags = {
    help: Flags.help({ char: "h" }),
    version: Flags.version({ char: "v" })
  };

  override async run(): Promise<void> {
    await this.parse(VspecCommand);
    this.log("vspec CLI");
  }
}

export async function runCli(argv = process.argv.slice(2)): Promise<void> {
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
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void runCli().catch(async (error: unknown) => {
    await handle(error instanceof Error ? error : new Error(String(error)));
  });
}
