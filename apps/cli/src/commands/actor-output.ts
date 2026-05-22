export type ActorSummary = {
  id: string;
  name: string;
  type: string;
};

export type ActorResponse = {
  actor: ActorSummary;
  recommended_next_command: string;
  revision: { version_number: number };
};

export type ActorListResponse = {
  items: ActorSummary[];
};

export function printActorSummary(
  actor: ActorSummary,
  writeLine: (message: string) => void
): void {
  writeLine(`${actor.name} ${actor.type} ${actor.id}`);
}

export function printActorCreated(
  body: ActorResponse,
  writeLine: (message: string) => void
): void {
  writeLine(`Actor ${body.actor.name} ${body.actor.type}`);
  writeLine(`Actor id ${body.actor.id}`);
  writeLine(`Revision version ${String(body.revision.version_number)}`);
  writeLine(body.recommended_next_command);
}
