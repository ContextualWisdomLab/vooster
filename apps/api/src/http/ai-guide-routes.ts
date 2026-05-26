import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  aiGuideJsonResponseSchema,
  aiGuideMarkdownResponseSchema,
  aiGuideQuerySchema,
  aiGuideRequestBodySchema
} from "@vooster/contracts";
import { buildAiGuide } from "../application/ai-guide.js";

export function registerAiGuideRoutes(app: FastifyInstance) {
  app.post("/v1/ai-guide", (request, reply) => aiGuide(request, reply));
}

function aiGuide(request: FastifyRequest, reply: FastifyReply) {
  const parsed = aiGuideQuerySchema.safeParse(request.query);
  const query = parsed.success
    ? parsed.data
    : { cli_version: "1.0.0", format: "markdown" as const };
  const body = aiGuideRequestBodySchema.parse(request.body ?? {});
  const result = buildAiGuide({
    cachedGuides: body.cached_guides,
    cliVersion: query.cli_version,
    format: query.format,
    simulateNetworkFailure: body.simulate_network_failure
  });
  return reply.code(result.status).send(responseBody(query.format, result));
}

function responseBody(
  format: "json" | "markdown",
  result: ReturnType<typeof buildAiGuide>
) {
  if (result.status !== 200) {
    return result.body;
  }
  return format === "json"
    ? aiGuideJsonResponseSchema.parse(result.body)
    : aiGuideMarkdownResponseSchema.parse(result.body);
}
