type CommandHelp = {
  examples?: string[];
  flags: string[];
  summary: string;
  usage: string;
};

const commandGroups = [
  ["Project", "workspace switch, project create/list/switch, status"],
  ["Use Cases", "usecase create/list/show/set/archive/restore, history, diff, verify"],
  ["Scenarios", "scenario add, step add/edit, comment add/list/edit/resolve/delete"],
  [
    "Actors",
    "actor create/list/show/edit/archive, stakeholder create/list/show/edit/archive"
  ],
  ["Collaboration", "session start/list/complete, branch create, merge open/resolve"],
  ["Locks", "lock <KEY>, lock renew, lock release, who"],
  ["Sync", "init, pull, push, sync, export gherkin/markdown"],
  ["Admin", "login, logout, member invite, api-key create/list/revoke, doctor"]
] as const;

const commandHelp = new Map<string, CommandHelp>([
  [
    "init",
    {
      summary: "Initialize a .vspec/ directory in the current repository.",
      usage: "$ vspec init --project <KEY> [--force] [--format human|json|agent]",
      flags: [
        "--project=<KEY>             Project key to bind this repo to. Required.",
        "--force                     Overwrite an existing .vspec/config.json.",
        "--format=<human|json|agent> Output format. Default: human."
      ],
      examples: [
        "$ vspec init --project ACME",
        "$ vspec init --project ACME --force",
        "$ vspec init --project ACME --format agent"
      ]
    }
  ],
  [
    "lock",
    {
      summary: "Acquire, renew, or release a use case lock.",
      usage: "$ vspec lock <KEY-NNN> --type soft|semantic|hard --reason <text>",
      flags: [
        "--type=<soft|semantic|hard> Lock strength. Required for acquire.",
        "--reason=<text>            Human-readable lock reason.",
        "--ttl=<minutes>            Lock duration. Default: 30.",
        "--session=<id>             Agent session id.",
        "--format=<human|agent>     Output format."
      ]
    }
  ],
  [
    "lock release",
    {
      summary: "Release an owned active lock.",
      usage: "$ vspec lock release <lock-id>",
      flags: [
        "--session=<id>         Agent session id that owns the lock.",
        "--format=<human|agent> Output format."
      ]
    }
  ],
  [
    "lock renew",
    {
      summary: "Extend an owned active lock.",
      usage: "$ vspec lock renew <lock-id> [--ttl <minutes>]",
      flags: [
        "--ttl=<minutes>        Renewal duration. Default: 30.",
        "--session=<id>         Agent session id that owns the lock.",
        "--format=<human|agent> Output format."
      ]
    }
  ],
  [
    "usecase create",
    {
      summary: "Create a Cockburn-style use case.",
      usage: "$ vspec usecase create --title <text> --primary-actor <name>",
      flags: [
        "--title=<text>          Use case title. Required.",
        "--primary-actor=<name>  Primary actor name. Required.",
        "--project-id=<id>       Project id when no project is selected.",
        "--format=<human|agent>  Output format."
      ]
    }
  ]
]);

export function helpTextFor(argv: string[]): string | undefined {
  const requested = helpRequest(argv);
  if (requested === undefined) {
    return undefined;
  }
  if (requested.length === 0) {
    return rootHelp();
  }
  return commandPage(
    commandHelp.get(requested.join(" ")) ?? genericCommandHelp(requested)
  );
}

function helpRequest(argv: string[]): string[] | undefined {
  if (argv[0] === "help") {
    return argv.slice(1);
  }
  if (!argv.includes("--help") && !argv.includes("-h")) {
    return undefined;
  }
  return argv.filter((item) => item !== "--help" && item !== "-h");
}

function rootHelp(): string {
  return [
    "Cockburn-style use case management for concurrent agents.",
    "",
    "USAGE",
    "  $ vspec <command> [options]",
    "  $ vspec help <command>",
    "",
    "COMMAND GROUPS",
    ...commandGroups.map(([name, commands]) => `  ${name.padEnd(14)} ${commands}`),
    "",
    "GLOBAL FLAGS",
    "  -h, --help       Show CLI help.",
    "  -v, --version    Show CLI version.",
    "",
    "EXAMPLES",
    "  $ vspec help usecase create",
    "  $ vspec help lock release",
    ""
  ].join("\n");
}

function commandPage(help: CommandHelp): string {
  return [
    help.summary,
    "",
    "USAGE",
    `  ${help.usage}`,
    "",
    "FLAGS",
    ...help.flags.map((flag) => `  ${flag}`),
    ...(help.examples === undefined
      ? []
      : ["", "EXAMPLES", ...help.examples.map((example) => `  ${example}`)]),
    ""
  ].join("\n");
}

function genericCommandHelp(parts: string[]): CommandHelp {
  return {
    summary: `Help for vspec ${parts.join(" ")}.`,
    usage: `$ vspec ${parts.join(" ")} [options]`,
    flags: [
      "--format=<human|json|agent> Output format when supported.",
      "-h, --help                  Show command help."
    ]
  };
}
