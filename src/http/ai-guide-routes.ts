import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const guideQuerySchema = z.object({
  cli_version: z.string().default("1.0.0"),
  format: z.enum(["json", "markdown"]).default("markdown")
});
const guideBodySchema = z.object({
  cached_guides: z.array(z.object({
    cli_version: z.string(),
    content: z.string()
  })).default([]),
  simulate_network_failure: z.boolean().default(false)
});

export function registerAiGuideRoutes(app: FastifyInstance) {
  app.post("/v1/ai-guide", (request, reply) => aiGuide(request, reply));
}

function aiGuide(request: FastifyRequest, reply: FastifyReply) {
  const parsed = guideQuerySchema.safeParse(request.query);
  const query = parsed.success ? parsed.data : { cli_version: "1.0.0", format: "markdown" };
  const body = guideBodySchema.parse(request.body ?? {});
  const cachedGuide = body.cached_guides[0];
  if (body.simulate_network_failure && cachedGuide !== undefined) {
    return reply.send(staleGuide(cachedGuide));
  }
  if (query.format === "json") {
    return reply.send(jsonGuide(query.cli_version));
  }
  return reply.send({
    cache: { cli_version: query.cli_version, status: "REFRESHED" },
    content: guideMarkdown(),
    suggested_next_actions: suggestedNextActions()
  });
}

function staleGuide(cached: { cli_version: string; content: string }) {
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

function guideSections() {
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

function suggestedNextActions() {
  return [
    { command: "vspec login", reason: "Authenticate before working with private specs." },
    { command: "vspec project list", reason: "Find the project to inspect." },
    { command: "vspec session start", reason: "Pin the target use cases before editing." }
  ];
}
