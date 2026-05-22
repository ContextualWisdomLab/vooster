import { problem } from "./signup-support.js";

export function emptyBodyProblem() {
  return problem(422, "empty_body", { code: "empty_body" }, [
    {
      command: 'vspec comment add --body "<text>"',
      reason: "Provide a non-empty markdown body."
    }
  ]);
}

export function missingUseCaseProblem() {
  return problem(404, "Use case not found", {}, [
    { command: "vspec usecase list", reason: "Find a valid non-archived use case." }
  ]);
}

export function notOwnerProblem() {
  return problem(
    403,
    "Only the comment author can change this comment",
    { code: "not_owner" },
    [{ command: "vspec comment list", reason: "Find a comment you authored." }]
  );
}

export function commentWriteFailedProblem() {
  return problem(500, "Comment write failed", { code: "comment_write_failed" }, [
    {
      command: "vspec comment add --retry",
      reason: "Retry after storage is available."
    }
  ]);
}
