import type { StakeholderCreateResponse, StakeholderSummary } from "@vooster/contracts";

export function printStakeholderSummary(
  stakeholder: StakeholderSummary,
  writeLine: (message: string) => void
): void {
  writeLine(`${stakeholder.name} ${stakeholder.type} ${stakeholder.id}`);
}

export function printStakeholderCreated(
  body: StakeholderCreateResponse,
  writeLine: (message: string) => void
): void {
  writeLine(`Stakeholder ${body.stakeholder.name} ${body.stakeholder.type}`);
  writeLine(`Stakeholder id ${body.stakeholder.id}`);
  writeLine(`Revision version ${String(body.revision.version_number)}`);
  writeLine(body.recommended_next_command);
}
