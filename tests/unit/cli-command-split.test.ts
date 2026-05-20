import { Command } from "@oclif/core";
import { describe, expect, test } from "vitest";

import { LoginCommand } from "../../src/cli/commands/login.js";

describe("CLI command split", () => {
  test("login lives in a real oclif command module", () => {
    expect(LoginCommand.prototype).toBeInstanceOf(Command);
  });
});
