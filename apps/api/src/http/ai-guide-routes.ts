import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { buildAiGuide } from "../application/ai-guide.js";

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
  const query = parsed.success ? parsed.data : { cli_version: "1.0.0", format: "markdown" as const };
  const body = guideBodySchema.parse(request.body ?? {});
  const result = buildAiGuide({
    cachedGuides: body.cached_guides,
    cliVersion: query.cli_version,
    format: query.format,
    simulateNetworkFailure: body.simulate_network_failure
  });
  return reply.code(result.status).send(result.body);
}
