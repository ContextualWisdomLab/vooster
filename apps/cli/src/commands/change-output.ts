export type ChangePreviewResponse = {
  diff: Array<{
    after: string;
    before: string;
    entity_type: string;
    path: string;
    severity: string;
  }>;
  expires_at: string;
  impact: {
    affected_sessions: Array<{
      id: string;
      pinned_usecase_keys: string[];
    }>;
    severity: string;
  };
  preview_id: string;
  severity: string;
  suggested_next_actions: Array<{
    command: string;
  }>;
  warnings: Array<{
    message: string;
    type: string;
  }>;
};

export type ChangeCommitResponse = {
  revisions: Array<{
    entity_id: string;
    revision_id: string;
  }>;
  suggested_next_actions: Array<{
    command: string;
  }>;
};

export function printChangePreview(
  body: ChangePreviewResponse,
  writeLine: (message: string) => void
): void {
  writeLine(`Preview ${body.preview_id}`);
  writeLine(`Severity ${body.severity}`);
  writeLine(`Expires ${body.expires_at}`);
  writeLine(
    `Affected sessions ${formatPreviewAffectedSessions(body.impact.affected_sessions)}`
  );
  for (const diff of body.diff) {
    writeLine(`Diff ${diff.entity_type} ${diff.path} ${diff.severity}`);
    writeLine(`Before ${diff.before}`);
    writeLine(`After ${diff.after}`);
  }
  for (const warning of body.warnings) {
    writeLine(`Warning ${warning.type} ${warning.message}`);
  }
  for (const action of body.suggested_next_actions) {
    writeLine(action.command);
  }
}

export function printChangeCommit(
  body: ChangeCommitResponse,
  writeLine: (message: string) => void
): void {
  for (const revision of body.revisions) {
    writeLine(`Entity ${revision.entity_id}`);
    writeLine(`Revision ${revision.revision_id}`);
  }
  for (const action of body.suggested_next_actions) {
    writeLine(action.command);
  }
}

function formatPreviewAffectedSessions(
  sessions: ChangePreviewResponse["impact"]["affected_sessions"]
): string {
  if (sessions.length === 0) {
    return "none";
  }

  return sessions
    .map((session) => `${session.id} ${session.pinned_usecase_keys.join(",")}`)
    .join("; ");
}
