import type {
  StakeholderInterestAddResponse,
  UsecaseArchiveResponse,
  UsecaseCreateResponse as ContractUsecaseResponse,
  UsecaseListResponse,
  UsecaseRestoreResponse,
  UsecaseShowResponse,
  UsecaseUpdateResponse
} from "@vooster/contracts";

export type {
  UsecaseArchiveResponse,
  UsecaseListResponse,
  UsecaseRestoreResponse,
  UsecaseShowResponse,
  UsecaseUpdateResponse
};
export type UsecaseResponse = ContractUsecaseResponse;

export type StakeholderInterestResponse = StakeholderInterestAddResponse;

export function printUsecase(
  body: UsecaseResponse,
  writeLine: (message: string) => void
): void {
  writeLine(`UseCase ${body.usecase.key}`);
  writeLine(`Title ${body.usecase.title ?? ""}`);
  writeLine(`Level ${body.usecase.level ?? ""}`);
  writeLine(`Format ${body.usecase.format ?? ""}`);
  writeLine(`Status ${body.usecase.status ?? ""}`);
  writeLine(`Priority ${body.usecase.priority ?? ""}`);
  writeLine(`Revision version ${String(body.revision.version_number)}`);
  for (const action of body.suggested_next_actions) {
    writeLine(action.command);
  }
}

export function printStakeholderInterest(
  body: StakeholderInterestResponse,
  writeLine: (message: string) => void
): void {
  writeLine(`Stakeholder ${body.stakeholder_interests.at(-1)?.stakeholder.name ?? ""}`);
  writeLine(`Interest ${body.stakeholder_interest.interest}`);
  writeLine(`Protection ${body.stakeholder_interest.protection_mechanism}`);
  writeLine(
    `Revision ${body.revision.severity} version ${String(body.revision.version_number)}`
  );
  for (const item of body.stakeholder_interests) {
    writeLine(`${item.stakeholder.name}: ${item.interest.interest}`);
  }
  if (body.next_missing_role_hint !== "") {
    writeLine(body.next_missing_role_hint);
  }
}

export function printUsecaseList(
  body: UsecaseListResponse,
  writeLine: (message: string) => void
): void {
  for (const item of body.items) {
    const archiveLabel = item.archived_at === undefined ? "" : " [archived]";
    writeLine(`${item.key}${archiveLabel} ${item.title}`);
    writeLine(`${item.status} ${item.level} ${item.primary_actor}`);
    if (item.archived_at !== undefined) {
      writeLine(`Archived at ${item.archived_at ?? ""}`);
    }
    if (item.trigger_excerpt !== "") {
      writeLine(item.trigger_excerpt);
    }
  }
  writeLine(`Next cursor ${body.next_cursor ?? ""}`);
  for (const action of body.suggested_next_actions ?? []) {
    writeLine(action.command);
  }
}

export function printUsecaseShow(
  body: UsecaseShowResponse,
  writeLine: (message: string) => void
): void {
  writeLine(`UseCase ${body.usecase.key}`);
  writeLine(`Title ${body.usecase.title ?? ""}`);
  writeLine(`Status ${body.usecase.status ?? ""}`);
  if (body.usecase.archived_at !== undefined && body.usecase.archived_at !== null) {
    writeLine(`Archived at ${body.usecase.archived_at}`);
  }
  writeLine(`Revision ${body.usecase.current_revision_id ?? ""}`);
  if ((body.stakeholder_interests ?? []).length > 0) {
    writeLine("Stakeholders and Interests");
    for (const interest of body.stakeholder_interests ?? []) {
      writeLine(`${interest.stakeholder}: ${interest.interest}`);
    }
  }

  const main = (body.scenarios ?? []).find(
    (scenario) => scenario.type === "MAIN_SUCCESS"
  );
  if (main !== undefined && main.steps.length > 0) {
    writeLine("Main Success Scenario");
    for (const step of main.steps) {
      writeLine(`${String(step.step_number)}. ${step.actor} ${step.action}`);
    }
  }

  const extensions = (body.scenarios ?? []).filter(
    (scenario) => scenario.type === "EXTENSION"
  );
  if (extensions.length > 0) {
    writeLine("Extensions");
    for (const scenario of extensions) {
      const point = scenario.extension_point ?? "*";
      const outcome =
        typeof scenario.outcome === "string" ? ` -> ${scenario.outcome}` : "";
      writeLine(`${point}. ${scenario.condition ?? "Extension"}${outcome}`);
      for (const step of scenario.steps) {
        writeLine(`${point}${String(step.step_number)}. ${step.actor} ${step.action}`);
      }
    }
  }
}

export function printUsecaseArchive(
  body: UsecaseArchiveResponse,
  writeLine: (message: string) => void
): void {
  writeLine(`UseCase ${body.usecase.key}`);
  writeLine(`Archived at ${body.usecase.archived_at ?? ""}`);
  writeLine(body.revision.change_summary ?? "");
  writeLine(`Affected sessions ${String(body.affected_sessions_count)}`);
  writeLine(`Active locks ${String(body.active_locks_count)}`);
  for (const action of body.suggested_next_actions) {
    writeLine(action.command);
  }
}

export function printUsecaseUpdate(
  body: UsecaseUpdateResponse,
  writeLine: (message: string) => void
): void {
  writeLine(`UseCase ${body.usecase.key}`);
  writeLine(`Title ${body.usecase.title ?? ""}`);
  writeLine(`Level ${body.usecase.level ?? ""}`);
  writeLine(`Format ${body.usecase.format ?? ""}`);
  writeLine(`Status ${body.usecase.status ?? ""}`);
  writeLine(`Priority ${body.usecase.priority ?? ""}`);
  writeLine(`Scope ${body.usecase.scope ?? ""}`);
}

export function printUsecaseRestore(
  body: UsecaseRestoreResponse,
  writeLine: (message: string) => void
): void {
  writeLine(`UseCase ${body.usecase.key}`);
  writeLine("Restored");
}
