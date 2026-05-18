import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const guideQuerySchema = z.object({
  cli_version: z.string().default("1.0.0")
});

export function registerAiGuideRoutes(app: FastifyInstance) {
  app.post("/v1/ai-guide", (request, reply) => aiGuide(request, reply));
}

function aiGuide(request: FastifyRequest, reply: FastifyReply) {
  const parsed = guideQuerySchema.safeParse(request.query);
  const cliVersion = parsed.success ? parsed.data.cli_version : "1.0.0";
  return reply.send({
    cache: { cli_version: cliVersion, status: "REFRESHED" },
    content: guideMarkdown(),
    suggested_next_actions: suggestedNextActions()
  });
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
