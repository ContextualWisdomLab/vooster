import { describe, expect, it } from "vitest";

import { commandRouteKeys } from "../../src/index.js";

describe("CLI dispatcher routes", () => {
  it("exposes the implemented command surface as route keys", () => {
    expect(commandRouteKeys()).toEqual([
      "actor archive",
      "actor create",
      "actor edit",
      "actor list",
      "actor show",
      "ai-guide",
      "api-key create",
      "api-key list",
      "api-key revoke",
      "branch create",
      "change commit",
      "change propose",
      "comment add",
      "comment delete",
      "comment edit",
      "comment list",
      "comment resolve",
      "diff",
      "doctor",
      "export gherkin",
      "export markdown",
      "goal create",
      "goal list",
      "goal promote",
      "goal reject",
      "goal show",
      "history",
      "impact",
      "init",
      "lock acquire",
      "lock release",
      "lock renew",
      "login",
      "logout",
      "member invite",
      "merge open",
      "merge resolve",
      "project create",
      "project list",
      "project switch",
      "pull",
      "push",
      "revert",
      "scenario add",
      "session complete",
      "session list",
      "session start",
      "stakeholder archive",
      "stakeholder create",
      "stakeholder edit",
      "stakeholder list",
      "stakeholder show",
      "status",
      "step add",
      "step edit",
      "step move",
      "sync",
      "usecase add-stakeholder",
      "usecase archive",
      "usecase create",
      "usecase list",
      "usecase restore",
      "usecase set",
      "usecase show",
      "usecase verify",
      "verify",
      "who",
      "workspace switch"
    ]);
  });

  it("keeps route keys unique", () => {
    const keys = commandRouteKeys();

    expect(new Set(keys).size).toBe(keys.length);
  });
});
