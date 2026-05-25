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
      body: "Before any write, start a session with --pin for every use case you will inspect. Fetch with --format=agent, apply one focused change, check suggested_next_actions, then commit or complete the session."
    },
    {
      heading: "The --format=agent payload contract",
      body: "Agent payloads are JSON. Inspect context, data, affected_files, dry_run, suggested_next_actions, warnings, and format_version before deciding the next command."
    },
    {
      heading: "Forbidden actions",
      body: "Never write without a pin. Never force a merge or ignore a conflict. Never discard suggested_next_actions; they are part of the command contract."
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
Before any write, start a session with \`--pin\` for every use case you will
inspect or edit. Then:

1. Fetch the target with \`--format=agent\`.
2. Read the envelope before choosing the next command.
3. Make one focused change.
4. Follow any \`suggested_next_actions\`.
5. Complete the session or resolve the surfaced conflict.

## The --format=agent payload contract
Inspect \`context\`, \`suggested_next_actions\`, \`warnings\`, and \`format_version\`
on every response. Treat \`data\` as the command result,
\`affected_files\` as the local write set, and \`dry_run\` as a signal that no
server mutation was committed.

## Forbidden actions
Never write without a pin. Never force a merge or ignore a conflict. Never
discard \`suggested_next_actions\`; they are part of the command contract.

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
