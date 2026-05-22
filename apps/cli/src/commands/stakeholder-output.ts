export type StakeholderSummary = {
  id: string;
  name: string;
  type: string;
};

export type StakeholderResponse = {
  recommended_next_command: string;
  revision: { version_number: number };
  stakeholder: StakeholderSummary;
};

export type StakeholderListResponse = {
  items: StakeholderSummary[];
};

export function printStakeholderSummary(
  stakeholder: StakeholderSummary,
  writeLine: (message: string) => void
): void {
  writeLine(`${stakeholder.name} ${stakeholder.type} ${stakeholder.id}`);
}

export function printStakeholderCreated(
  body: StakeholderResponse,
  writeLine: (message: string) => void
): void {
  writeLine(`Stakeholder ${body.stakeholder.name} ${body.stakeholder.type}`);
  writeLine(`Stakeholder id ${body.stakeholder.id}`);
  writeLine(`Revision version ${String(body.revision.version_number)}`);
  writeLine(body.recommended_next_command);
}
