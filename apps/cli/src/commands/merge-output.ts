import type { MergeOpenResponse, MergeResolveResponse } from "@vooster/contracts";

export type { MergeOpenResponse, MergeResolveResponse };

export function printMergeOpen(
  body: MergeOpenResponse,
  writeLine: (message: string) => void
): void {
  writeLine(`Merge request ${body.merge_request.id}`);
  writeLine(`Status ${body.merge_request.status}`);
  writeLine(`Strategy ${body.merge_request.strategy}`);
  writeLine(`Conflicts ${String(body.merge_request.conflicts.length)}`);
  writeLine(
    `Impacted entities ${String(Object.keys(body.merge_request.impact.severity_by_entity).length)}`
  );
  writeLine(`Source branch ${body.source_branch.id} ${body.source_branch.status}`);
  writeLine(`Main heads ${String(Object.keys(body.main_head_revision_ids).length)}`);
  for (const action of body.suggested_next_actions) {
    writeLine(action.command);
  }
}

export function printMergeResolve(
  body: MergeResolveResponse,
  writeLine: (message: string) => void
): void {
  writeLine(`Merge request ${body.merge_request.id}`);
  writeLine(`Status ${body.merge_request.status}`);
  writeLine(`Conflicts ${String(body.merge_request.conflicts.length)}`);
  writeLine(`New revisions ${String(body.new_revisions.length)}`);
  writeLine(`Source branch ${body.source_branch.id} ${body.source_branch.status}`);
  writeLine(`Main heads ${String(Object.keys(body.main_head_revision_ids).length)}`);
  for (const action of body.suggested_next_actions) {
    writeLine(action.command);
  }
}
