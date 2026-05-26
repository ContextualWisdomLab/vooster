import type { ActorCreateResponse, ActorSummary } from "@vooster/contracts";

export function printActorSummary(
  actor: ActorSummary,
  writeLine: (message: string) => void
): void {
  writeLine(`${actor.name} ${actor.type} ${actor.id}`);
}

export function printActorCreated(
  body: ActorCreateResponse,
  writeLine: (message: string) => void
): void {
  writeLine(`Actor ${body.actor.name} ${body.actor.type}`);
  writeLine(`Actor id ${body.actor.id}`);
  writeLine(`Revision version ${String(body.revision.version_number)}`);
  writeLine(body.recommended_next_command);
}
