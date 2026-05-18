import { problem } from "./signup-support.js";

export function editorOwnerInviteProblem() {
  return problem(
    403,
    "Only workspace owners can invite owners",
    {},
    [
      {
        command: "vspec member invite --role editor",
        reason: "Invite the teammate as an editor or ask a workspace owner."
      }
    ]
  );
}

export function alreadyMemberProblem() {
  return problem(
    422,
    "Email already belongs to a workspace member",
    { code: "already_member" },
    [
      {
        command: "vspec member set-role",
        reason: "Change the existing member role instead of inviting again."
      }
    ]
  );
}
