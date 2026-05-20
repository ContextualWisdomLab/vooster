import { Command } from "@oclif/core";
import { describe, expect, test } from "vitest";

import { AiGuideCommand } from "../../src/cli/commands/ai-guide.js";
import { ApiKeyCommand } from "../../src/cli/commands/api-key.js";
import { LoginCommand } from "../../src/cli/commands/login.js";
import { MemberCommand } from "../../src/cli/commands/member.js";
import { ProjectCommand } from "../../src/cli/commands/project.js";

describe("CLI command split", () => {
  test("login lives in a real oclif command module", () => {
    expect(LoginCommand.prototype).toBeInstanceOf(Command);
  });

  test("ai-guide lives in a real oclif command module", () => {
    expect(AiGuideCommand.prototype).toBeInstanceOf(Command);
  });

  test("api-key lives in a real oclif command module", () => {
    expect(ApiKeyCommand.prototype).toBeInstanceOf(Command);
  });

  test("member lives in a real oclif command module", () => {
    expect(MemberCommand.prototype).toBeInstanceOf(Command);
  });

  test("project lives in a real oclif command module", () => {
    expect(ProjectCommand.prototype).toBeInstanceOf(Command);
  });
});
