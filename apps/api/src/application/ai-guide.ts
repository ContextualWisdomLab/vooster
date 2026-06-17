import type {
  AiGuideRequest,
  AiGuideSection,
  CachedAiGuide,
  SuggestedNextAction
} from "../domain/ai-guide.js";

export type AiGuideResult = {
  body: unknown;
  status: number;
};

export function buildAiGuide(request: AiGuideRequest): AiGuideResult {
  const cachedGuide = request.cachedGuides[0];
  if (request.simulateNetworkFailure && cachedGuide !== undefined) {
    return { body: staleGuide(cachedGuide), status: 200 };
  }
  if (request.simulateNetworkFailure) {
    return { body: coldOfflineProblem(), status: 503 };
  }
  if (request.format === "json") {
    return { body: jsonGuide(request.cliVersion), status: 200 };
  }

  return {
    body: {
      cache: refreshedCache(request.cliVersion, cachedGuide?.cli_version),
      content: guideMarkdown(),
      suggested_next_actions: suggestedNextActions()
    },
    status: 200
  };
}

function refreshedCache(cliVersion: string, cachedVersion: string | undefined) {
  if (cachedVersion !== undefined && cachedVersion !== cliVersion) {
    return {
      cli_version: cliVersion,
      previous_cli_version: cachedVersion,
      status: "REFRESHED_VERSION_MISMATCH"
    };
  }
  return { cli_version: cliVersion, status: "REFRESHED" };
}

function coldOfflineProblem() {
  return {
    bootstrap: "Read https://vspec.dev/ai-guide and retry vspec ai-guide once online.",
    exit_code: 5,
    status: 503,
    suggested_next_actions: [
      {
        command: "vspec ai-guide",
        reason: "Retry once network access returns."
      }
    ],
    title: "AI guide unavailable",
    type: "about:blank"
  };
}

function staleGuide(cached: CachedAiGuide) {
  return {
    cache: { cli_version: cached.cli_version, status: "STALE_FALLBACK" },
    content: `WARNING: this guide may be out of date relative to the installed CLI.\n\n${cached.content}`,
    suggested_next_actions: [
      ...suggestedNextActions(),
      { command: "vspec ai-guide", reason: "Retry once connectivity returns." }
    ],
    warnings: [
      {
        type: "STALE_AI_GUIDE",
        message: `Using cached guide ${cached.cli_version} because the current guide could not be fetched.`
      }
    ]
  };
}

function jsonGuide(cliVersion: string) {
  return {
    examples: [
      {
        commands: [
          "vspec login",
          "vspec project list",
          "vspec project create --key POCKET --name Pocket",
          "vspec init --project POCKET",
          'vspec actor create --name "Account Holder" --type PRIMARY',
          'vspec actor create --name "Pocket" --type SUPPORTING',
          'vspec stakeholder create --name "Account Holder" --type EXTERNAL',
          'vspec usecase create --title "User logs a new expense" --primary-actor "Account Holder" --format=agent',
          'vspec usecase add-stakeholder POCKET-001 --stakeholder "Account Holder" --interest "Accurate confirmed expense records"',
          "vspec scenario add POCKET-001 --type MAIN_SUCCESS --outcome SUCCESS",
          'vspec step add <main-scenario-id> --actor "Account Holder" --action "enters the expense amount, selects a category, and optionally adds a note"',
          'vspec step add <main-scenario-id> --actor "Pocket" --action "validates the amount is positive and the category is selected"',
          'vspec scenario add POCKET-001 --type EXTENSION --at 2a --condition "Amount is missing or invalid" --outcome FAILURE',
          'vspec session start --intent "Update checkout copy" --pin PAY-001',
          "vspec usecase show PAY-001 --format=agent",
          "vspec change propose --usecase PAY-001 --summary ..."
        ],
        title: "First pinned edit"
      }
    ],
    sections: guideSections(),
    suggested_next_actions: suggestedNextActions(),
    version: cliVersion
  };
}

function guideSections(): AiGuideSection[] {
  return [
    {
      heading: "Why sessions exist",
      body: "Sessions pin exact revisions so parallel agents can inspect, edit, and merge without guessing whether a peer changed the same use case."
    },
    {
      heading: "Mandatory workflow",
      body: "For existing use cases, start a session with --pin for every use case you will inspect. A pin is an existing use case key such as POCKET-001. For greenfield work, create the first use case before starting a pinned session, or continue without a session until a key exists. Fetch with --format=agent, apply one focused change, check suggested_next_actions, then commit or complete the session."
    },
    {
      heading: "Greenfield setup",
      body: 'For a new product, run vspec status first. If already authenticated, do not run vspec login again; use the current API and workspace. Run vspec project list, create the project if missing with vspec project create --key POCKET --name Pocket, then bind the repo with vspec init --project POCKET. Create a primary actor, a supporting product actor such as vspec actor create --name "Pocket" --type SUPPORTING, a typed stakeholder such as vspec stakeholder create --name "Account Holder" --type EXTERNAL, and a use case. Add at least one stakeholder interest before creating scenarios. Then create the main scenario, active-voice steps, and an extension such as vspec scenario add POCKET-001 --type EXTENSION --at 2a --condition "Amount is missing or invalid" --outcome FAILURE.'
    },
    {
      heading: "Existing use case edits",
      body: "For an existing use case, start a pinned session, inspect step ids in `vspec usecase show <KEY-NNN> --format=agent`, and use `data.usecase.current_revision_id` as the `--base-revision` for `vspec step edit`. After every mutation, re-read the use case or use the returned `data.revision.id` as the next base revision. Use `vspec step add --at <n>` to insert a new step at a 1-based position, and `vspec step move <step-id> --to <n>` to reorder without changing wording. Extension points use labels such as `2a`, not plain step numbers."
    },
    {
      heading: "The --format=agent payload contract",
      body: "Agent payloads are JSON. Inspect context, data, affected_files, dry_run, suggested_next_actions, warnings, and format_version before deciding the next command."
    },
    {
      heading: "Forbidden actions",
      body: "Never edit an existing use case without a pin. Never force a merge or ignore a conflict. Never discard suggested_next_actions; they are part of the command contract."
    },
    {
      heading: "Worked example",
      body: 'Log in, list projects, run vspec session start --intent "Update checkout copy" --pin PAY-001, inspect with vspec usecase show PAY-001 --format=agent, propose a focused change, and complete the session.'
    }
  ];
}

function guideMarkdown() {
  return `# vspec AI Agent Guide

## Why sessions exist
Sessions pin exact use case revisions so parallel agents can work without guessing
whether a peer changed the same spec. A session is the coordination handle for
pins, locks, branch context, conflicts, and the final completion result.

## Mandatory workflow
For existing use cases, start a session with \`--pin\` for every use case you
will inspect or edit. A pin is an existing use case key such as \`POCKET-001\`.
For greenfield work, create the first use case before starting a pinned session,
or continue without a session until a key exists. Then:

1. Fetch the target with \`--format=agent\`.
2. Read the envelope before choosing the next command.
3. Make one focused change.
4. Follow any \`suggested_next_actions\`.
5. Complete the session or resolve the surfaced conflict.

## Greenfield setup
For a brand-new product, do not guess at files or inspect the installed source.
Use the CLI path:

1. \`vspec status\`
2. If \`vspec status\` already shows an API/workspace, do not run \`vspec login\`
   again; keep the seeded auth context.
3. If no auth context exists, \`vspec login\`
4. \`vspec project list\`
5. If the project is missing, \`vspec project create --key POCKET --name Pocket\`
6. \`vspec init --project POCKET\`
7. \`vspec actor create --name "Account Holder" --type PRIMARY\`
8. \`vspec actor create --name "Pocket" --type SUPPORTING\`
9. \`vspec stakeholder create --name "Account Holder" --type EXTERNAL\`
10. \`vspec usecase create --title "User logs a new expense" --primary-actor "Account Holder" --format=agent\`
    Add at least one stakeholder interest before creating scenarios.
11. \`vspec usecase add-stakeholder POCKET-001 --stakeholder "Account Holder" --interest "Accurate confirmed expense records"\`
12. \`vspec scenario add POCKET-001 --type MAIN_SUCCESS --outcome SUCCESS\`
13. \`vspec step add <main-scenario-id> --actor "Account Holder" --action "enters the expense amount, selects a category, and optionally adds a note"\`
14. \`vspec step add <main-scenario-id> --actor "Pocket" --action "validates the amount is positive and the category is selected"\`
15. \`vspec step add <main-scenario-id> --actor "Pocket" --action "saves the expense and confirms the saved entry"\`
16. \`vspec scenario add POCKET-001 --type EXTENSION --at 2a --condition "Amount is missing or invalid" --outcome FAILURE\`

## Existing use case edits
For an existing use case, do not inspect installed source or guess at local files.
Use the CLI path:

1. \`vspec session start --intent "Update POCKET-001" --pin POCKET-001 --format=agent\`
2. \`vspec usecase show POCKET-001 --format=agent\`
3. Find step ids in \`vspec usecase show <KEY-NNN> --format=agent\`; each step has
   an \`id\` and \`step_number\`.
4. Use \`data.usecase.current_revision_id\` as the \`--base-revision\` for
   \`vspec step edit\`.
5. After each mutation, re-read the use case or use the returned
   \`data.revision.id\` as the next base revision.
6. Use \`vspec step add --at <n>\` to insert a new step at a 1-based position,
   and \`vspec step move <step-id> --to <n>\` to reorder without changing wording.
7. Extension points use labels such as \`2a\`, not plain step numbers.

## The --format=agent payload contract
Inspect \`context\`, \`suggested_next_actions\`, \`warnings\`, and \`format_version\`
on every response. Treat \`data\` as the command result,
\`affected_files\` as the local write set, and \`dry_run\` as a signal that no
server mutation was committed.

## Forbidden actions
Never edit an existing use case without a pin. Never force a merge or ignore a
conflict. Never discard \`suggested_next_actions\`; they are part of the command
contract.

## Worked example
1. \`vspec login\`
2. \`vspec project list\`
3. \`vspec session start --intent "Update checkout copy" --pin PAY-001\`
4. \`vspec usecase show PAY-001 --format=agent\`
5. \`vspec change propose --usecase PAY-001 --summary ...\`
6. \`vspec session complete <session-id>\`
`;
}

function suggestedNextActions(): SuggestedNextAction[] {
  return [
    {
      command: "vspec login",
      reason: "Authenticate before working with private specs."
    },
    { command: "vspec project list", reason: "Find the project to inspect." },
    {
      command: "vspec session start",
      reason: "Pin the target use cases before editing."
    }
  ];
}
