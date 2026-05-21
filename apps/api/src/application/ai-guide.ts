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
    warnings: [{
      type: "STALE_AI_GUIDE",
      message: `Using cached guide ${cached.cli_version} because the current guide could not be fetched.`
    }]
  };
}

function jsonGuide(cliVersion: string) {
  return {
    examples: [
      {
        commands: ["vspec login", "vspec project list", "vspec session start"],
        title: "First safe task"
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
      body: "Sessions pin the exact use case revisions an agent may inspect and edit."
    },
    {
      heading: "Mandatory workflow",
      body: "pin -> fetch via --format=agent -> propose-change -> commit"
    },
    {
      heading: "The --format=agent payload contract",
      body: "Agent payloads are JSON with context, suggested_next_actions, warnings, and format_version."
    },
    {
      heading: "Forbidden actions",
      body: "Do not write without a pin, force a merge, or ignore suggested_next_actions."
    }
  ];
}

function guideMarkdown() {
  return `# vspec AI Agent Guide

## Why sessions exist
Sessions pin the exact use case revisions an agent is allowed to inspect and edit.

## Mandatory workflow
pin -> fetch via --format=agent -> propose-change -> commit

## The --format=agent payload contract
Agent payloads are JSON with context, suggested_next_actions, warnings, and format_version.

## Forbidden actions
Do not write without a pin, force a merge, or ignore suggested_next_actions.

## Worked example
Run vspec login, list projects, start a session with pinned use cases, fetch the spec, propose a change, then commit it.
`;
}

function suggestedNextActions(): SuggestedNextAction[] {
  return [
    { command: "vspec login", reason: "Authenticate before working with private specs." },
    { command: "vspec project list", reason: "Find the project to inspect." },
    { command: "vspec session start", reason: "Pin the target use cases before editing." }
  ];
}
