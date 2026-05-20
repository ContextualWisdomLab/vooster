import { Command } from "@oclif/core";
import { describe, expect, test } from "vitest";

import { ActorCommand } from "../../src/cli/commands/actor.js";
import { AiGuideCommand } from "../../src/cli/commands/ai-guide.js";
import { ApiKeyCommand } from "../../src/cli/commands/api-key.js";
import { BranchCommand } from "../../src/cli/commands/branch.js";
import { ChangeCommand } from "../../src/cli/commands/change.js";
import { CommentCommand } from "../../src/cli/commands/comment.js";
import { ExportCommand } from "../../src/cli/commands/export.js";
import { GoalCommand } from "../../src/cli/commands/goal.js";
import { LoginCommand } from "../../src/cli/commands/login.js";
import { MemberCommand } from "../../src/cli/commands/member.js";
import { MergeCommand } from "../../src/cli/commands/merge.js";
import { ProjectCommand } from "../../src/cli/commands/project.js";
import { ScenarioCommand } from "../../src/cli/commands/scenario.js";
import { SessionCommand } from "../../src/cli/commands/session.js";
import { StakeholderCommand } from "../../src/cli/commands/stakeholder.js";
import { StepCommand } from "../../src/cli/commands/step.js";
import { SyncCommand } from "../../src/cli/commands/sync.js";
import { UsecaseCommand } from "../../src/cli/commands/usecase.js";

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

  test("branch lives in a real oclif command module", () => {
    expect(BranchCommand.prototype).toBeInstanceOf(Command);
  });

  test("comment lives in a real oclif command module", () => {
    expect(CommentCommand.prototype).toBeInstanceOf(Command);
  });

  test("goal lives in a real oclif command module", () => {
    expect(GoalCommand.prototype).toBeInstanceOf(Command);
  });

  test("actor lives in a real oclif command module", () => {
    expect(ActorCommand.prototype).toBeInstanceOf(Command);
  });

  test("stakeholder lives in a real oclif command module", () => {
    expect(StakeholderCommand.prototype).toBeInstanceOf(Command);
  });

  test("usecase lives in a real oclif command module", () => {
    expect(UsecaseCommand.prototype).toBeInstanceOf(Command);
  });

  test("session lives in a real oclif command module", () => {
    expect(SessionCommand.prototype).toBeInstanceOf(Command);
  });

  test("scenario lives in a real oclif command module", () => {
    expect(ScenarioCommand.prototype).toBeInstanceOf(Command);
  });

  test("step lives in a real oclif command module", () => {
    expect(StepCommand.prototype).toBeInstanceOf(Command);
  });

  test("merge lives in a real oclif command module", () => {
    expect(MergeCommand.prototype).toBeInstanceOf(Command);
  });

  test("change lives in a real oclif command module", () => {
    expect(ChangeCommand.prototype).toBeInstanceOf(Command);
  });

  test("sync lives in a real oclif command module", () => {
    expect(SyncCommand.prototype).toBeInstanceOf(Command);
  });

  test("export lives in a real oclif command module", () => {
    expect(ExportCommand.prototype).toBeInstanceOf(Command);
  });
});
