import { Command } from "@oclif/core";
import { describe, expect, test } from "vitest";

import { ActorCommand } from "../../src/commands/actor.js";
import { AiGuideCommand } from "../../src/commands/ai-guide.js";
import { ApiKeyCommand } from "../../src/commands/api-key.js";
import { BranchCommand } from "../../src/commands/branch.js";
import { ChangeCommand } from "../../src/commands/change.js";
import { CommentCommand } from "../../src/commands/comment.js";
import { DiffCommand } from "../../src/commands/diff.js";
import { ExportCommand } from "../../src/commands/export.js";
import { GoalCommand } from "../../src/commands/goal.js";
import { HistoryCommand } from "../../src/commands/history.js";
import { ImpactCommand } from "../../src/commands/impact.js";
import { LoginCommand } from "../../src/commands/login.js";
import { LockCommand } from "../../src/commands/lock.js";
import { MemberCommand } from "../../src/commands/member.js";
import { MergeCommand } from "../../src/commands/merge.js";
import { ProjectCommand } from "../../src/commands/project.js";
import { PullCommand } from "../../src/commands/pull.js";
import { PushCommand } from "../../src/commands/push.js";
import { RevertCommand } from "../../src/commands/revert.js";
import { ScenarioCommand } from "../../src/commands/scenario.js";
import { SessionCommand } from "../../src/commands/session.js";
import { StakeholderCommand } from "../../src/commands/stakeholder.js";
import { StepCommand } from "../../src/commands/step.js";
import { SyncCommand } from "../../src/commands/sync.js";
import { UsecaseCommand } from "../../src/commands/usecase.js";
import { WhoCommand } from "../../src/commands/who.js";

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

  test("pull lives in a real oclif command module", () => {
    expect(PullCommand.prototype).toBeInstanceOf(Command);
  });

  test("push lives in a real oclif command module", () => {
    expect(PushCommand.prototype).toBeInstanceOf(Command);
  });

  test("diff lives in a real oclif command module", () => {
    expect(DiffCommand.prototype).toBeInstanceOf(Command);
  });

  test("history lives in a real oclif command module", () => {
    expect(HistoryCommand.prototype).toBeInstanceOf(Command);
  });

  test("lock lives in a real oclif command module", () => {
    expect(LockCommand.prototype).toBeInstanceOf(Command);
  });

  test("who lives in a real oclif command module", () => {
    expect(WhoCommand.prototype).toBeInstanceOf(Command);
  });

  test("revert lives in a real oclif command module", () => {
    expect(RevertCommand.prototype).toBeInstanceOf(Command);
  });

  test("impact lives in a real oclif command module", () => {
    expect(ImpactCommand.prototype).toBeInstanceOf(Command);
  });

  test("export lives in a real oclif command module", () => {
    expect(ExportCommand.prototype).toBeInstanceOf(Command);
  });
});
