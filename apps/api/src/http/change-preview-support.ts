import type { SignupState } from "./signup-types.js";
import type { StoredLock, StoredUseCase } from "../domain/entities/index.js";
import { problem } from "./signup-support.js";

export type ChangePreview = {
  base_revision: string;
  diff: ChangeDiff[];
  expires_at: string;
  id: string;
  severity: "NON_BREAKING";
  usecase_id: string;
};
type ChangeDiff = { after: string; before: string; entity_id: string;
  entity_type: "USECASE"; path: "title"; severity: "NON_BREAKING" };

const previewsByState = new WeakMap<SignupState, Map<string, ChangePreview>>();

export function previews(state: SignupState) {
  const existing = previewsByState.get(state);
  if (existing !== undefined) {
    return existing;
  }
  const created = new Map<string, ChangePreview>();
  previewsByState.set(state, created);
  return created;
}

export function previewProblem(status: number, title: string, reason: string) {
  return problem(status, title, {}, [{ command: "vspec change propose", reason }]);
}

export function hardLockProblem(usecase: StoredUseCase, lock: StoredLock) {
  return problem(
    409,
    "Use case has a HARD lock",
    { holding_session: lock.held_by_session_id ?? lock.holder },
    [
      { command: `vspec who ${usecase.key}`, reason: "Inspect the session holding the lock." },
      {
        command: `vspec unlock ${usecase.key}`,
        reason: "Owners can release the lock when appropriate."
      }
    ]
  );
}
