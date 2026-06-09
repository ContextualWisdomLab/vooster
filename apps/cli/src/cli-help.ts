type CommandHelp = {
  examples?: string[];
  flags: string[];
  summary: string;
  usage: string;
};

const commandGroups = [
  ["AI", "ai-guide"],
  ["Project", "workspace switch, project create/list/switch, status"],
  ["Use Cases", "usecase create/list/show/set/archive/restore, history, diff, verify"],
  [
    "Scenarios",
    "scenario add, step add/edit/move, comment add/list/edit/resolve/delete"
  ],
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
      usage:
        "$ vspec init --project <KEY> [--force] [--verify-workflow] [--format human|json|agent]",
      flags: [
        "--project=<KEY>             Project key to bind this repo to. Required.",
        "--force                     Overwrite an existing .vspec/config.json.",
        "--verify-workflow           Generate .github/workflows/vspec-verify.yml.",
        "--format=<human|json|agent> Output format. Default: human."
      ],
      examples: [
        "$ vspec init --project ACME",
        "$ vspec init --project ACME --force",
        "$ vspec init --project ACME --verify-workflow",
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
  ],
  [
    "usecase add-stakeholder",
    {
      summary: "Attach a stakeholder interest to a use case.",
      usage:
        "$ vspec usecase add-stakeholder <KEY-NNN> --stakeholder <name> --interest <text>",
      flags: [
        "--stakeholder=<name>        Existing stakeholder name. Required.",
        "--interest=<text>           Stakeholder interest to protect. Required.",
        "--protection-mechanism=<text> How the system protects the interest.",
        "--format=<human|agent>      Output format."
      ],
      examples: [
        '$ vspec usecase add-stakeholder POCKET-001 --stakeholder "Account Holder" --interest "Accurate confirmed expense records"'
      ]
    }
  ],
  [
    "stakeholder create",
    {
      summary: "Create a stakeholder for the current project.",
      usage:
        "$ vspec stakeholder create --name <name> --type <INTERNAL|EXTERNAL|REGULATORY>",
      flags: [
        "--name=<name>                           Stakeholder name. Required.",
        "--type=<INTERNAL|EXTERNAL|REGULATORY>  Stakeholder type. Required.",
        "--description=<text>                    Optional description.",
        "--format=<human|agent>                  Output format."
      ],
      examples: ['$ vspec stakeholder create --name "Account Holder" --type EXTERNAL']
    }
  ],
  [
    "scenario add",
    {
      summary: "Add a main success or extension scenario.",
      usage:
        "$ vspec scenario add <KEY-NNN> --type <MAIN_SUCCESS|EXTENSION> [--at <extension-point>]",
      flags: [
        "--type=<MAIN_SUCCESS|EXTENSION> Scenario type. Required.",
        "--outcome=<SUCCESS|FAILURE>      Scenario outcome.",
        "--at=<extension-point>          Extension label such as 2a, 3b, or *a.",
        "--condition=<text>              Extension condition.",
        "--format=<human|agent>          Output format."
      ],
      examples: [
        "$ vspec scenario add POCKET-001 --type MAIN_SUCCESS --outcome SUCCESS",
        '$ vspec scenario add POCKET-001 --type EXTENSION --at 2a --condition "Amount is missing or invalid" --outcome FAILURE'
      ]
    }
  ],
  [
    "step add",
    {
      summary: "Add an active-voice step to a scenario.",
      usage: "$ vspec step add <scenario-id> --actor <name> --action <text> [--at <n>]",
      flags: [
        "--actor=<name>        Registered actor performing the step. Required.",
        "--action=<text>       Active-voice step action. Required.",
        "--at=<n>              Insert at this 1-based step position; defaults to append.",
        "--force               Persist wording after reviewing validation warnings.",
        "--format=<human|agent> Output format."
      ],
      examples: [
        '$ vspec step add <main-scenario-id> --actor "Pocket" --action "validates the amount is positive and the category is selected"',
        '$ vspec step add <main-scenario-id> --actor "Pocket" --action "validates the amount is positive" --at 2'
      ]
    }
  ],
  [
    "step move",
    {
      summary: "Move an existing step to a scenario position.",
      usage: "$ vspec step move <step-id> --to <n>",
      flags: [
        "--to=<n>               New 1-based step position. Required.",
        "--format=<human|agent> Output format."
      ],
      examples: ["$ vspec step move <step-id> --to 2 --format=agent"]
    }
  ],
  [
    "step edit",
    {
      summary: "Edit an existing step by id.",
      usage:
        "$ vspec step edit <step-id> --base-revision <revision-id> [--actor <name>] [--action <text>]",
      flags: [
        "--base-revision=<revision-id> Latest data.usecase.current_revision_id from usecase show. Required.",
        "--actor=<name>                Registered actor to assign to the step.",
        "--action=<text>               Replacement active-voice step action.",
        "--implements=<path[:symbol]>  Implementation reference, comma-separated for many.",
        "--format=<human|agent>        Output format."
      ],
      examples: [
        "# Use the step id from usecase show --format=agent.",
        '$ vspec step edit <step-id> --base-revision <current-revision-id> --action "selects an account before saving the expense" --format=agent'
      ]
    }
  ],
  [
    "ai-guide",
    {
      summary: "Print the AI agent onboarding guide.",
      usage: "$ vspec ai-guide [--api-url <url>] [--format human|json]",
      flags: [
        "--api-url=<url>        API URL when no config exists.",
        "--format=<human|json>  Output format. Default: human."
      ],
      examples: ["$ vspec ai-guide", "$ vspec ai-guide --format json"]
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
    "  $ vspec ai-guide",
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
