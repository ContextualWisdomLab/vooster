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

export function printUsecase(body: UsecaseResponse, writeLine: (message: string) => void): void {
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
  writeLine(`Revision ${body.revision.severity} version ${String(body.revision.version_number)}`);
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
