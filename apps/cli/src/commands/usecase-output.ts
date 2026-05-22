export type UsecaseResponse = {
  revision: {
    version_number: number;
  };
  suggested_next_actions: Array<{
    command: string;
  }>;
  usecase: {
    format: string;
    key: string;
    level: string;
    priority: string;
    status: string;
    title: string;
  };
};

export type UsecaseListResponse = {
  items: Array<{
    key: string;
    level: string;
    primary_actor: string;
    status: string;
    title: string;
    trigger_excerpt: string;
  }>;
  next_cursor: string | null;
  suggested_next_actions?: Array<{
    command: string;
  }>;
};

export type UsecaseShowResponse = {
  scenarios?: Array<{
    condition?: string | null;
    extension_point?: string | null;
    steps: Array<{ action: string; actor: string; step_number: number }>;
    type: string;
  }>;
  stakeholder_interests?: Array<{ interest: string; stakeholder: string }>;
  usecase: {
    current_revision_id: string;
    key: string;
    status: string;
    title: string;
  };
};

export type UsecaseUpdateResponse = {
  usecase: {
    key: string;
    status: string;
  };
};

export type UsecaseArchiveResponse = {
  active_locks_count: number;
  affected_sessions_count: number;
  revision: {
    change_summary: string;
  };
  suggested_next_actions: Array<{
    command: string;
  }>;
  usecase: {
    archived_at: string;
    key: string;
  };
};

export type UsecaseRestoreResponse = {
  usecase: {
    key: string;
  };
};

export type StakeholderInterestResponse = {
  next_missing_role_hint: string;
  revision: {
    severity: string;
    version_number: number;
  };
  stakeholder_interest: {
    interest: string;
    protection_mechanism: string;
  };
  stakeholder_interests: Array<{
    interest: {
      interest: string;
    };
    stakeholder: {
      name: string;
    };
  }>;
};

export function printUsecase(
  body: UsecaseResponse,
  writeLine: (message: string) => void
): void {
  writeLine(`UseCase ${body.usecase.key}`);
  writeLine(`Title ${body.usecase.title}`);
  writeLine(`Level ${body.usecase.level}`);
  writeLine(`Format ${body.usecase.format}`);
  writeLine(`Status ${body.usecase.status}`);
  writeLine(`Priority ${body.usecase.priority}`);
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
    writeLine(`${item.key} ${item.title}`);
    writeLine(`${item.status} ${item.level} ${item.primary_actor}`);
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
  writeLine(`Title ${body.usecase.title}`);
  writeLine(`Status ${body.usecase.status}`);
  writeLine(`Revision ${body.usecase.current_revision_id}`);
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
  if (extensions.some((scenario) => scenario.steps.length > 0)) {
    writeLine("Extensions");
    for (const scenario of extensions) {
      const point = scenario.extension_point ?? "*";
      writeLine(`${point}. ${scenario.condition ?? "Extension"}`);
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
  writeLine(`Archived at ${body.usecase.archived_at}`);
  writeLine(body.revision.change_summary);
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
  writeLine(`Status ${body.usecase.status}`);
}

export function printUsecaseRestore(
  body: UsecaseRestoreResponse,
  writeLine: (message: string) => void
): void {
  writeLine(`UseCase ${body.usecase.key}`);
  writeLine("Restored");
}
