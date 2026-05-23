import type { FastifyReply } from "fastify";
import type {
  StoredRevision,
  StoredScenario,
  StoredStep
} from "../../../src/domain/entities/index.js";

export function reply() {
  const captured: {
    body?: unknown;
    fastifyReply: FastifyReply;
    send: (body: unknown) => unknown;
    statusCode?: number;
  } = {
    fastifyReply: undefined as unknown as FastifyReply,
    send: (body) => {
      captured.body = body;
      return body;
    }
  };
  captured.fastifyReply = {
    code: (statusCode: number) => {
      captured.statusCode = statusCode;
      return captured.fastifyReply;
    },
    send: captured.send
  } as unknown as FastifyReply;
  return captured;
}

export function scenario(): StoredScenario {
  return { id: "scenario-1" } as StoredScenario;
}

export function revision(): StoredRevision {
  return { id: "revision-1", snapshot: {} } as StoredRevision;
}

export function step(): StoredStep {
  return { id: "step-1" } as StoredStep;
}
