import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Args, Command, Flags, flush, handle } from "@oclif/core";

const root = dirname(fileURLToPath(import.meta.url));

export class VspecCommand extends Command {
  static override description = "Cockburn-style use case management for concurrent agents.";

  static override args = {
    command: Args.string()
  };

  static override flags = {
    "api-url": Flags.string(),
    aliases: Flags.string(),
    action: Flags.string(),
    actor: Flags.string(),
    "actor-id": Flags.string(),
    at: Flags.string(),
    "base-revision": Flags.string(),
    "agent-type": Flags.string(),
    "auto-branch": Flags.boolean(),
    body: Flags.string(),
    "branch-name": Flags.string(),
    condition: Flags.string(),
    cursor: Flags.string(),
    description: Flags.string(),
    email: Flags.string(),
    "entity-id": Flags.string(),
    field: Flags.string(),
    force: Flags.boolean(),
    format: Flags.string(),
    from: Flags.string(),
    "github-code": Flags.string(),
    help: Flags.help({ char: "h" }),
    intent: Flags.string(),
    into: Flags.string(),
    interest: Flags.string(),
    key: Flags.string(),
    level: Flags.string(),
    limit: Flags.string(),
    name: Flags.string(),
    "no-merge": Flags.boolean(),
    priority: Flags.string(),
    "primary-actor": Flags.string(),
    "project-id": Flags.string(),
    "proposed-change": Flags.string(),
    "protection-mechanism": Flags.string(),
    outcome: Flags.string(),
    pin: Flags.string(),
    q: Flags.string(),
    reason: Flags.string(),
    role: Flags.string(),
    session: Flags.string(),
    "session-cookie": Flags.string(),
    stakeholder: Flags.string(),
    status: Flags.string(),
    strategy: Flags.string(),
    summary: Flags.string(),
    title: Flags.string(),
    to: Flags.string(),
    ttl: Flags.string(),
    type: Flags.string(),
    version: Flags.version({ char: "v" }),
    visibility: Flags.string(),
    "workspace-id": Flags.string(),
    "workspace-name": Flags.string(),
    "workspace-slug": Flags.string()
  };

  static override strict = false;

  override async run(): Promise<void> {
    const parsed = await this.parse(VspecCommand);

    if (parsed.args.command === "login") {
      await this.login(parsed.flags);
      return;
    }
    if (parsed.args.command === "member" && this.argv[1] === "invite") {
      await this.inviteMember(parsed.flags);
      return;
    }
    if (parsed.args.command === "project" && this.argv[1] === "create") {
      await this.createProject(parsed.flags);
      return;
    }
    if (parsed.args.command === "branch" && this.argv[1] === "create") {
      await this.createBranch(parsed.flags);
      return;
    }
    if (parsed.args.command === "merge" && this.argv[1] === "open") {
      await this.openMerge(parsed.flags);
      return;
    }
    if (parsed.args.command === "merge" && this.argv[1] === "resolve") {
      await this.resolveMerge(parsed.flags);
      return;
    }
    if (parsed.args.command === "lock" && this.argv[1] !== "renew") {
      await this.createLock(parsed.flags);
      return;
    }
    if (parsed.args.command === "who") {
      await this.showWho(parsed.flags);
      return;
    }
    if (parsed.args.command === "history") {
      await this.listHistory(parsed.flags);
      return;
    }
    if (parsed.args.command === "diff") {
      await this.compareRevisions(parsed.flags);
      return;
    }
    if (parsed.args.command === "revert") {
      await this.revertRevision(parsed.flags);
      return;
    }
    if (parsed.args.command === "impact") {
      await this.previewImpact(parsed.flags);
      return;
    }
    if (parsed.args.command === "comment" && this.argv[1] === "add") {
      await this.addComment(parsed.flags);
      return;
    }
    if (parsed.args.command === "comment" && this.argv[1] === "list") {
      await this.listComments(parsed.flags);
      return;
    }
    if (parsed.args.command === "comment" && this.argv[1] === "edit") {
      await this.editComment(parsed.flags);
      return;
    }
    if (parsed.args.command === "comment" && this.argv[1] === "resolve") {
      await this.resolveComment(parsed.flags);
      return;
    }
    if (parsed.args.command === "comment" && this.argv[1] === "delete") {
      await this.deleteComment(parsed.flags);
      return;
    }
    if (parsed.args.command === "actor" && this.argv[1] === "create") {
      await this.createActor(parsed.flags);
      return;
    }
    if (parsed.args.command === "stakeholder" && this.argv[1] === "create") {
      await this.createStakeholder(parsed.flags);
      return;
    }
    if (parsed.args.command === "goal" && this.argv[1] === "create") {
      await this.createGoal(parsed.flags);
      return;
    }
    if (parsed.args.command === "goal" && this.argv[1] === "list") {
      await this.listGoals(parsed.flags);
      return;
    }
    if (parsed.args.command === "goal" && this.argv[1] === "promote") {
      await this.promoteGoal(parsed.flags);
      return;
    }
    if (parsed.args.command === "usecase" && this.argv[1] === "create") {
      await this.createUseCase(parsed.flags);
      return;
    }
    if (parsed.args.command === "usecase" && this.argv[1] === "add-stakeholder") {
      await this.addStakeholderInterest(parsed.flags);
      return;
    }
    if (parsed.args.command === "usecase" && this.argv[1] === "list") {
      await this.listUseCases(parsed.flags);
      return;
    }
    if (parsed.args.command === "usecase" && this.argv[1] === "archive") {
      await this.archiveUseCase(parsed.flags);
      return;
    }
    if (parsed.args.command === "scenario" && this.argv[1] === "add") {
      await this.createScenario(parsed.flags);
      return;
    }
    if (parsed.args.command === "step" && this.argv[1] === "add") {
      await this.addStep(parsed.flags);
      return;
    }
    if (parsed.args.command === "step" && this.argv[1] === "edit") {
      await this.editStep(parsed.flags);
      return;
    }
    if (parsed.args.command === "session" && this.argv[1] === "complete") {
      await this.completeSession(parsed.flags);
      return;
    }
    if (parsed.args.command === "session" && this.argv[1] === "list") {
      await this.listSessions(parsed.flags);
      return;
    }
    if (parsed.args.command === "session" && this.argv[1] === "start") {
      await this.startSession(parsed.flags);
      return;
    }

    this.log("vspec CLI");
  }

  private async login(flags: ParsedFlags): Promise<void> {
    const oauthFlags = oauthFlagsFrom(flags);
    const signupFlags = signupFlagsFrom(flags);
    const start = await postJson(
      `${oauthFlags.apiUrl}/v1/auth/github/start`,
      signupFlags === undefined
        ? { flow: "login" }
        : {
            workspace: {
              name: signupFlags.workspaceName,
              slug: signupFlags.workspaceSlug
            }
          }
    );
    const startBody = start.body as OAuthStartResponse;
    const callbackUrl = new URL("/v1/auth/github/callback", oauthFlags.apiUrl);
    callbackUrl.searchParams.set("code", oauthFlags.githubCode);
    callbackUrl.searchParams.set("state", startBody.state);

    const callback = await fetchJson(callbackUrl, {
      headers: {
        Cookie: start.cookie
      }
    });
    if (signupFlags === undefined) {
      this.printLogin(callback.body as LoginResponse);
      return;
    }

    this.printSignup(callback.body as SignupResponse);
  }

  private printSignup(callbackBody: SignupResponse): void {
    this.log(`Signed up ${callbackBody.user.email}`);
    this.log(`Workspace ${callbackBody.workspace.slug}`);
    this.log(callbackBody.recommended_next_command);
  }

  private printLogin(callbackBody: LoginResponse): void {
    this.log(`Logged in ${callbackBody.user.github_id}`);
    for (const workspace of callbackBody.workspaces) {
      this.log(`Workspace ${workspace.slug} ${workspace.role}`);
    }
    if (callbackBody.recommended_next_command !== undefined) {
      this.log(callbackBody.recommended_next_command);
    }
  }

  private async inviteMember(flags: ParsedFlags): Promise<void> {
    const inviteFlags = inviteFlagsFrom(flags);
    const response = await postJson(
      `${inviteFlags.apiUrl}/v1/workspaces/${inviteFlags.workspaceId}/invitations`,
      {
        email: inviteFlags.email,
        role: inviteFlags.role
      },
      {
        Cookie: inviteFlags.sessionCookie
      }
    );
    const body = response.body as InvitationResponse;

    this.log(`Invited ${body.invitation.email}`);
    this.log(`Role ${body.invitation.role}`);
    for (const action of body.suggested_next_actions) {
      this.log(action.command);
    }
  }

  private async createProject(flags: ParsedFlags): Promise<void> {
    const projectFlags = projectFlagsFrom(flags);
    const response = await postJson(
      `${projectFlags.apiUrl}/v1/workspaces/${projectFlags.workspaceId}/projects`,
      {
        key: projectFlags.key,
        name: projectFlags.name,
        visibility: projectFlags.visibility
      },
      {
        Cookie: projectFlags.sessionCookie
      }
    );
    const body = response.body as ProjectResponse;

    this.log(`Project ${body.project.name} ${body.project.key}`);
    this.log(`Branch ${body.default_branch.name}`);
    this.log(body.recommended_next_command);
  }

  private async createBranch(flags: ParsedFlags): Promise<void> {
    const branchFlags = branchCreateFlagsFrom(flags, this.argv[2]);
    const response = await postJson(
      `${branchFlags.apiUrl}/v1/projects/${branchFlags.projectId}/branches`,
      {
        from: branchFlags.from,
        name: branchFlags.name
      },
      {
        Cookie: branchFlags.sessionCookie
      }
    );
    const body = response.body as BranchCreateResponse;

    this.log(`Branch ${body.branch.id}`);
    this.log(`Name ${body.branch.name}`);
    this.log(`Status ${body.branch.status}`);
    this.log(`Owner ${body.branch.owner_type}`);
    this.log(`Base revisions ${String(Object.keys(body.branch.base_revision_ids).length)}`);
    this.log(`Head revisions ${String(Object.keys(body.branch.head_revision_ids).length)}`);
    for (const warning of body.warnings ?? []) {
      this.log(`Warning ${warning.type} ${warning.merge_request_id}`);
    }
    for (const action of body.suggested_next_actions) {
      this.log(action.command);
    }
  }

  private async openMerge(flags: ParsedFlags): Promise<void> {
    const mergeFlags = mergeOpenFlagsFrom(flags, this.argv[2]);
    const response = await postJson(
      `${mergeFlags.apiUrl}/v1/merges`,
      {
        source_branch_id: mergeFlags.sourceBranchId,
        ...(mergeFlags.strategy === undefined ? {} : { strategy: mergeFlags.strategy }),
        target: mergeFlags.target
      },
      {
        Cookie: mergeFlags.sessionCookie
      }
    );
    const body = response.body as MergeOpenResponse;

    this.log(`Merge request ${body.merge_request.id}`);
    this.log(`Status ${body.merge_request.status}`);
    this.log(`Strategy ${body.merge_request.strategy}`);
    this.log(`Conflicts ${String(body.merge_request.conflicts.length)}`);
    this.log(`Impacted entities ${String(Object.keys(body.merge_request.impact.severity_by_entity).length)}`);
    this.log(`Source branch ${body.source_branch.id} ${body.source_branch.status}`);
    this.log(`Main heads ${String(Object.keys(body.main_head_revision_ids).length)}`);
    for (const action of body.suggested_next_actions) {
      this.log(action.command);
    }
  }

  private async resolveMerge(flags: ParsedFlags): Promise<void> {
    const mergeFlags = mergeResolveFlagsFrom(flags, this.argv[2]);
    const response = await postJson(
      `${mergeFlags.apiUrl}/v1/merges/${mergeFlags.mergeId}/resolve`,
      {
        base_revision: mergeFlags.baseRevision,
        resolutions: [
          {
            entity_id: mergeFlags.entityId,
            field: mergeFlags.field,
            strategy: mergeFlags.strategy,
            ...(mergeFlags.value === undefined ? {} : { value: mergeFlags.value })
          }
        ]
      },
      {
        Cookie: mergeFlags.sessionCookie
      }
    );
    const body = response.body as MergeResolveResponse;

    this.log(`Merge request ${body.merge_request.id}`);
    this.log(`Status ${body.merge_request.status}`);
    this.log(`Conflicts ${String(body.merge_request.conflicts.length)}`);
    this.log(`New revisions ${String(body.new_revisions.length)}`);
    this.log(`Source branch ${body.source_branch.id} ${body.source_branch.status}`);
    this.log(`Main heads ${String(Object.keys(body.main_head_revision_ids).length)}`);
    for (const action of body.suggested_next_actions) {
      this.log(action.command);
    }
  }

  private async createLock(flags: ParsedFlags): Promise<void> {
    const lockFlags = lockCreateFlagsFrom(flags, this.argv[1]);
    const response = await postJson(
      `${lockFlags.apiUrl}/v1/locks`,
      {
        lock_type: lockFlags.type,
        reason: lockFlags.reason,
        target_id: lockFlags.targetId,
        target_type: "USECASE",
        ttl_minutes: lockFlags.ttlMinutes
      },
      {
        Cookie: lockFlags.sessionCookie,
        ...(lockFlags.sessionId === undefined ? {} : { "X-Vspec-Session": lockFlags.sessionId })
      }
    );
    const body = response.body as LockCreateResponse;

    this.log(`Lock ${body.lock.id}`);
    this.log(`Type ${body.lock.lock_type}`);
    this.log(`Target ${body.lock.target_id}`);
    this.log(`Holder ${body.lock.held_by_session_id ?? body.lock.held_by_user_id}`);
    this.log(`Auto release ${String(body.lock.auto_release)}`);
    this.log(`Expires at ${body.lock.expires_at}`);
    for (const action of body.suggested_next_actions) {
      this.log(action.command);
    }
  }

  private async showWho(flags: ParsedFlags): Promise<void> {
    const whoFlags = whoFlagsFrom(flags, this.argv[1]);
    const response = await fetchJson(`${whoFlags.apiUrl}/v1/usecases/${whoFlags.usecaseId}/who`, {
      headers: {
        Cookie: whoFlags.sessionCookie
      }
    });
    const body = response.body as WhoResponse;

    this.log(`UseCase ${body.usecase.key}`);
    this.log(`Sessions ${String(body.sessions.length)}`);
    for (const session of body.sessions) {
      this.log(`Session ${session.id}`);
      this.log(`Agent ${session.agent_type}`);
      this.log(`Intent ${session.intent}`);
      if ((session.markers ?? []).length > 0) {
        this.log(`Markers ${(session.markers ?? []).join(", ")}`);
      }
    }
    this.log(`Locks ${String(body.locks.length)}`);
    for (const lock of body.locks) {
      this.log(`Lock ${lock.id}`);
      this.log(`Type ${lock.lock_type}`);
      this.log(`Holder ${lock.held_by_session_id ?? lock.held_by_user_id}`);
      this.log(`Expires at ${lock.expires_at}`);
    }
    this.log(`Merge requests ${String(body.merge_requests.length)}`);
    for (const merge of body.merge_requests) {
      this.log(`Merge request ${merge.id}`);
      this.log(`Source branch ${merge.source_branch_id}`);
      this.log(`Status ${merge.status}`);
      this.log(`Conflicts ${String(merge.conflict_count)}`);
    }
    for (const action of body.suggested_next_actions) {
      this.log(action.command);
    }
  }

  private async listHistory(flags: ParsedFlags): Promise<void> {
    const historyFlags = historyFlagsFrom(flags, this.argv[1]);
    const url = new URL(`/v1/usecases/${historyFlags.usecaseId}/revisions`, historyFlags.apiUrl);
    setSearchParam(url, "limit", historyFlags.limit);

    const response = await fetchJson(url, {
      headers: {
        Cookie: historyFlags.sessionCookie
      }
    });
    const body = response.body as HistoryResponse;

    this.log(`UseCase ${body.usecase.key}`);
    this.log(`Limit ${String(body.limit)}`);
    this.log(`Truncated ${String(body.truncated)}`);
    this.log(`Suppressed ${String(body.suppressed_count)}`);
    for (const revision of body.revisions) {
      this.log(`Revision ${revision.revision}`);
      this.log(`Version ${String(revision.version_number)}`);
      this.log(`Entity ${revision.entity_type} ${revision.entity_id}`);
      this.log(`Author ${revision.author}`);
      this.log(`Timestamp ${revision.timestamp}`);
      if (revision.change_summary !== undefined) {
        this.log(revision.change_summary);
      }
    }
    for (const action of body.suggested_next_actions) {
      this.log(action.command);
    }
  }

  private async compareRevisions(flags: ParsedFlags): Promise<void> {
    const diffFlags = diffFlagsFrom(flags, this.argv[1], this.argv[2], this.argv[3]);
    const url = new URL(`/v1/usecases/${diffFlags.usecaseId}/diff`, diffFlags.apiUrl);
    url.searchParams.set("from", diffFlags.fromRevision);
    url.searchParams.set("to", diffFlags.toRevision);
    url.searchParams.set("format", diffFlags.format);

    const response = await fetchJson(url, {
      headers: {
        Cookie: diffFlags.sessionCookie
      }
    });
    const body = response.body as DiffResponse;

    this.log(`UseCase ${body.usecase.key}`);
    this.log(`Format ${body.format}`);
    this.log(`From ${body.from_revision}`);
    this.log(`To ${body.to_revision}`);
    this.log(
      `Summary breaking ${String(body.summary.breaking)} ` +
        `non_breaking ${String(body.summary.non_breaking)} ` +
        `cosmetic ${String(body.summary.cosmetic)}`
    );
    if (body.cross_branch === true) {
      this.log("Cross branch true");
    }
    for (const warning of body.warnings ?? []) {
      this.log(`Warning ${warning.type} ${warning.from_branch} ${warning.to_branch}`);
    }
    for (const change of body.changes) {
      this.log(`Change ${change.change_type} ${change.entity_type} ${change.path}`);
      this.log(`Revision ${change.revision}`);
      this.log(`Severity ${change.severity}`);
      if (change.source_branch !== undefined) {
        this.log(`Source branch ${change.source_branch}`);
      }
    }
    if (body.note !== undefined) {
      this.log(body.note);
    }
    for (const action of body.suggested_next_actions) {
      this.log(action.command);
    }
  }

  private async revertRevision(flags: ParsedFlags): Promise<void> {
    const revertFlags = revertFlagsFrom(flags, this.argv[1]);
    const response = await postJson(
      `${revertFlags.apiUrl}/v1/usecases/${revertFlags.usecaseId}/revert`,
      {
        force: revertFlags.force,
        revision_id: revertFlags.revisionId,
        ...(revertFlags.summary === undefined ? {} : { summary: revertFlags.summary })
      },
      {
        Cookie: revertFlags.sessionCookie
      }
    );
    const body = response.body as RevertResponse;

    this.log(`UseCase ${body.usecase.id}`);
    this.log(`Title ${body.usecase.title}`);
    this.log(`Current revision ${body.usecase.current_revision_id}`);
    this.log(`Revision ${body.revision.id}`);
    this.log(`Parent ${body.revision.parent_revision_id}`);
    this.log(`Change ${body.revision.change_summary}`);
    this.log(`Version ${String(body.revision.version_number)}`);
    this.log(`Severity ${body.revision.severity}`);
    this.log(`Impact ${body.impact.severity}`);
    this.log(`Affected sessions ${body.impact.affected_sessions.join(", ") || "none"}`);
    this.log(`Affected branches ${body.impact.affected_branches.join(", ") || "none"}`);
    for (const warning of body.warnings ?? []) {
      this.log(`Warning ${warning.type} ${warning.message}`);
    }
    for (const action of body.suggested_next_actions) {
      this.log(action.command);
    }
  }

  private async previewImpact(flags: ParsedFlags): Promise<void> {
    const impactFlags = impactFlagsFrom(flags, this.argv[1]);
    const history = await latestUseCaseRevision(impactFlags);
    const proposedChange = await proposedChangePayload(impactFlags.proposedChangePath);
    const response = await postJson(
      `${impactFlags.apiUrl}/v1/changes/preview`,
      {
        base_revision: history.revision,
        entity_id: impactFlags.usecaseId,
        entity_type: "USECASE",
        ...proposedChange
      },
      {
        Cookie: impactFlags.sessionCookie
      }
    );
    const body = response.body as ImpactResponse;

    this.log(`Preview ${body.preview_id}`);
    this.log(`Cached ${String(body.cached)}`);
    this.log(`Severity ${body.impact.severity}`);
    this.log(`Confidence ${String(body.impact.confidence)}`);
    this.log(`Affected sessions ${formatAffectedSessions(body.impact.affected_sessions)}`);
    this.log(`Affected branches ${body.impact.affected_branches.join(", ") || "none"}`);
    this.log(`Affected tests ${body.impact.affected_tests.join(", ") || "none"}`);
    this.log(`Input hash ${body.impact.input_hash}`);
    for (const action of body.suggested_next_actions) {
      this.log(action.command);
    }
  }

  private async addComment(flags: ParsedFlags): Promise<void> {
    const commentFlags = commentBodyFlagsFrom(flags, this.argv[2], "usecase-id");
    const response = await postJson(
      `${commentFlags.apiUrl}/v1/usecases/${commentFlags.targetId}/comments`,
      { body: commentFlags.body },
      {
        Cookie: commentFlags.sessionCookie
      }
    );
    this.printCommentResponse(response.body as CommentResponse);
  }

  private async listComments(flags: ParsedFlags): Promise<void> {
    const commentFlags = commentTargetFlagsFrom(flags, this.argv[2], "usecase-id");
    const response = await fetchJson(
      `${commentFlags.apiUrl}/v1/usecases/${commentFlags.targetId}/comments`,
      {
        headers: {
          Cookie: commentFlags.sessionCookie
        }
      }
    );
    const body = response.body as CommentListResponse;

    this.log(`Comments ${String(body.comments.length)}`);
    for (const comment of body.comments) {
      this.printComment(comment);
    }
  }

  private async editComment(flags: ParsedFlags): Promise<void> {
    const commentFlags = commentBodyFlagsFrom(flags, this.argv[2], "comment-id");
    const response = await patchJson(
      `${commentFlags.apiUrl}/v1/comments/${commentFlags.targetId}`,
      { body: commentFlags.body },
      {
        Cookie: commentFlags.sessionCookie
      }
    );
    this.printCommentResponse(response.body as CommentResponse);
  }

  private async resolveComment(flags: ParsedFlags): Promise<void> {
    const commentFlags = commentTargetFlagsFrom(flags, this.argv[2], "comment-id");
    const response = await patchJson(
      `${commentFlags.apiUrl}/v1/comments/${commentFlags.targetId}`,
      { resolved: true },
      {
        Cookie: commentFlags.sessionCookie
      }
    );
    this.printCommentResponse(response.body as CommentResponse);
  }

  private async deleteComment(flags: ParsedFlags): Promise<void> {
    const commentFlags = commentTargetFlagsFrom(flags, this.argv[2], "comment-id");
    const response = await deleteJson(
      `${commentFlags.apiUrl}/v1/comments/${commentFlags.targetId}`,
      {
        Cookie: commentFlags.sessionCookie
      }
    );
    this.printCommentResponse(response.body as CommentResponse);
    this.log("Deleted true");
  }

  private printCommentResponse(body: CommentResponse): void {
    this.printComment(body.comment);
    for (const action of body.suggested_next_actions) {
      this.log(action.command);
    }
  }

  private printComment(comment: CommentPayload): void {
    this.log(`Comment ${comment.id}`);
    this.log(`Target ${comment.target_id}`);
    this.log(`Author ${comment.author_id}`);
    this.log(`Resolved ${String(comment.resolved)}`);
    this.log(`Resolved at ${comment.resolved_at ?? ""}`);
    this.log(`Updated at ${comment.updated_at ?? ""}`);
    this.log(`Body ${comment.body}`);
  }

  private async createActor(flags: ParsedFlags): Promise<void> {
    const actorFlags = actorFlagsFrom(flags);
    const response = await postJson(
      `${actorFlags.apiUrl}/v1/projects/${actorFlags.projectId}/actors`,
      {
        aliases: actorFlags.aliases,
        description: actorFlags.description,
        is_human: true,
        name: actorFlags.name,
        type: actorFlags.type
      },
      {
        Cookie: actorFlags.sessionCookie
      }
    );
    const body = response.body as ActorResponse;

    this.log(`Actor ${body.actor.name} ${body.actor.type}`);
    this.log(`Revision version ${String(body.revision.version_number)}`);
    this.log(body.recommended_next_command);
  }

  private async createStakeholder(flags: ParsedFlags): Promise<void> {
    const stakeholderFlags = stakeholderFlagsFrom(flags);
    const response = await postJson(
      `${stakeholderFlags.apiUrl}/v1/projects/${stakeholderFlags.projectId}/stakeholders`,
      {
        description: stakeholderFlags.description,
        name: stakeholderFlags.name,
        type: stakeholderFlags.type
      },
      {
        Cookie: stakeholderFlags.sessionCookie
      }
    );
    const body = response.body as StakeholderResponse;

    this.log(`Stakeholder ${body.stakeholder.name} ${body.stakeholder.type}`);
    this.log(`Revision version ${String(body.revision.version_number)}`);
    this.log(body.recommended_next_command);
  }

  private async createGoal(flags: ParsedFlags): Promise<void> {
    const goalFlags = goalCreateFlagsFrom(flags);
    const response = await postJson(
      `${goalFlags.apiUrl}/v1/projects/${goalFlags.projectId}/goals`,
      {
        actor_id: goalFlags.actorId,
        description: goalFlags.description,
        level: goalFlags.level,
        priority: goalFlags.priority
      },
      {
        Cookie: goalFlags.sessionCookie
      }
    );
    const body = response.body as GoalResponse;

    this.log(`Goal ${body.goal.description}`);
    this.log(`Status ${body.goal.status} ${body.goal.priority}`);
    this.log(`Revision version ${String(body.revision.version_number)}`);
    for (const warning of body.warnings ?? []) {
      this.log(`Warning ${warning.command}`);
    }
    this.log(body.recommended_next_command);
  }

  private async listGoals(flags: ParsedFlags): Promise<void> {
    const goalFlags = goalListFlagsFrom(flags);
    const url = new URL(`/v1/projects/${goalFlags.projectId}/goals`, goalFlags.apiUrl);
    if (goalFlags.actorId !== undefined) {
      url.searchParams.set("actor_id", goalFlags.actorId);
    }

    const response = await fetchJson(url, {
      headers: {
        Cookie: goalFlags.sessionCookie
      }
    });
    const body = response.body as GoalListResponse;

    for (const actorGoals of body.actors) {
      this.log(`Actor ${actorGoals.actor.name}`);
      for (const goal of actorGoals.goals) {
        this.log(`${goal.description} ${goal.priority} ${goal.status}`);
      }
    }
  }

  private async promoteGoal(flags: ParsedFlags): Promise<void> {
    const goalFlags = goalPromoteFlagsFrom(flags, this.argv[2]);
    const response = await postJson(
      `${goalFlags.apiUrl}/v1/goals/${goalFlags.goalId}/promote`,
      {},
      {
        Cookie: goalFlags.sessionCookie
      }
    );
    const body = response.body as GoalPromotionResponse;

    this.log(`UseCase ${body.usecase.key}`);
    this.log(`Title ${body.usecase.title}`);
    this.log(`Format ${body.usecase.format}`);
    this.log(`Revision version ${String(body.revision.version_number)}`);
    this.log(`Goal ${body.goal.status}`);
    for (const warning of body.warnings ?? []) {
      this.log(`Warning ${warning.message}`);
    }
    for (const action of body.suggested_next_actions) {
      this.log(action.command);
    }
  }

  private async createUseCase(flags: ParsedFlags): Promise<void> {
    const useCaseFlags = useCaseCreateFlagsFrom(flags);
    const response = await postJson(
      `${useCaseFlags.apiUrl}/v1/projects/${useCaseFlags.projectId}/usecases`,
      {
        primary_actor: useCaseFlags.primaryActor,
        title: useCaseFlags.title
      },
      {
        Cookie: useCaseFlags.sessionCookie
      }
    );
    const body = response.body as UseCaseResponse;

    this.log(`UseCase ${body.usecase.key}`);
    this.log(`Title ${body.usecase.title}`);
    this.log(`Level ${body.usecase.level}`);
    this.log(`Format ${body.usecase.format}`);
    this.log(`Status ${body.usecase.status}`);
    this.log(`Priority ${body.usecase.priority}`);
    this.log(`Revision version ${String(body.revision.version_number)}`);
    for (const action of body.suggested_next_actions) {
      this.log(action.command);
    }
  }

  private async addStakeholderInterest(flags: ParsedFlags): Promise<void> {
    const interestFlags = stakeholderInterestFlagsFrom(flags, this.argv[2]);
    const response = await postJson(
      `${interestFlags.apiUrl}/v1/usecases/${interestFlags.usecaseId}/stakeholder-interests`,
      {
        interest: interestFlags.interest,
        protection_mechanism: interestFlags.protectionMechanism,
        stakeholder: interestFlags.stakeholder
      },
      {
        Cookie: interestFlags.sessionCookie
      }
    );
    const body = response.body as StakeholderInterestResponse;

    this.log(`Stakeholder ${body.stakeholder_interests.at(-1)?.stakeholder.name ?? ""}`);
    this.log(`Interest ${body.stakeholder_interest.interest}`);
    this.log(`Protection ${body.stakeholder_interest.protection_mechanism}`);
    this.log(`Revision ${body.revision.severity} version ${String(body.revision.version_number)}`);
    for (const item of body.stakeholder_interests) {
      this.log(`${item.stakeholder.name}: ${item.interest.interest}`);
    }
    if (body.next_missing_role_hint !== "") {
      this.log(body.next_missing_role_hint);
    }
  }

  private async listUseCases(flags: ParsedFlags): Promise<void> {
    const listFlags = useCaseListFlagsFrom(flags);
    const url = new URL(`/v1/projects/${listFlags.projectId}/usecases`, listFlags.apiUrl);
    setSearchParam(url, "actor_id", listFlags.actorId);
    setSearchParam(url, "cursor", listFlags.cursor);
    setSearchParam(url, "level", listFlags.level);
    setSearchParam(url, "limit", listFlags.limit);
    setSearchParam(url, "q", listFlags.q);
    setSearchParam(url, "status", listFlags.status);

    const response = await fetchJson(url, {
      headers: {
        Cookie: listFlags.sessionCookie
      }
    });
    const body = response.body as UseCaseListResponse;

    for (const item of body.items) {
      this.log(`${item.key} ${item.title}`);
      this.log(`${item.status} ${item.level} ${item.primary_actor}`);
      if (item.trigger_excerpt !== "") {
        this.log(item.trigger_excerpt);
      }
    }
    this.log(`Next cursor ${body.next_cursor ?? ""}`);
    for (const action of body.suggested_next_actions ?? []) {
      this.log(action.command);
    }
  }

  private async archiveUseCase(flags: ParsedFlags): Promise<void> {
    const archiveFlags = useCaseArchiveFlagsFrom(flags, this.argv[2]);
    const response = await deleteJson(
      `${archiveFlags.apiUrl}/v1/usecases/${archiveFlags.usecaseId}`,
      {
        Cookie: archiveFlags.sessionCookie
      }
    );
    const body = response.body as UseCaseArchiveResponse;

    this.log(`UseCase ${body.usecase.key}`);
    this.log(`Archived at ${body.usecase.archived_at}`);
    this.log(body.revision.change_summary);
    this.log(`Affected sessions ${String(body.affected_sessions_count)}`);
    this.log(`Active locks ${String(body.active_locks_count)}`);
    for (const action of body.suggested_next_actions) {
      this.log(action.command);
    }
  }

  private async createScenario(flags: ParsedFlags): Promise<void> {
    const scenarioFlags = scenarioCreateFlagsFrom(flags, this.argv[2]);
    const response = await postJson(
      `${scenarioFlags.apiUrl}/v1/usecases/${scenarioFlags.usecaseId}/scenarios`,
      {
        condition: scenarioFlags.condition,
        extension_point: scenarioFlags.extensionPoint,
        outcome: scenarioFlags.outcome,
        type: scenarioFlags.type
      },
      {
        Cookie: scenarioFlags.sessionCookie
      }
    );
    const body = response.body as ScenarioResponse;

    this.log(`Scenario ${body.scenario.id}`);
    this.log(`Type ${body.scenario.type}`);
    if (body.scenario.extension_point !== null) {
      this.log(`At ${body.scenario.extension_point}`);
    }
    if (body.scenario.condition !== null) {
      this.log(`Condition ${body.scenario.condition}`);
    }
    this.log(`Outcome ${body.scenario.outcome}`);
    this.log(`Revision ${body.revision.severity} version ${String(body.revision.version_number)}`);
  }

  private async addStep(flags: ParsedFlags): Promise<void> {
    const stepFlags = stepCreateFlagsFrom(flags, this.argv[2]);
    const response = await postJson(
      `${stepFlags.apiUrl}/v1/scenarios/${stepFlags.scenarioId}/steps`,
      {
        action: stepFlags.action,
        actor: stepFlags.actor
      },
      {
        Cookie: stepFlags.sessionCookie
      }
    );
    const body = response.body as StepResponse;

    this.log(`${String(body.step.step_number)}. ${stepFlags.actor} ${body.step.action}`);
    this.log(`Revision ${body.revision.severity} version ${String(body.revision.version_number)}`);
    for (const step of body.scenario_steps) {
      this.log(`${String(step.step_number)}. ${step.action}`);
    }
  }

  private async editStep(flags: ParsedFlags): Promise<void> {
    const stepFlags = stepEditFlagsFrom(flags, this.argv[2]);
    const response = await patchJson(
      `${stepFlags.apiUrl}/v1/steps/${stepFlags.stepId}`,
      {
        action: stepFlags.action,
        base_revision: stepFlags.baseRevision
      },
      {
        Cookie: stepFlags.sessionCookie
      }
    );
    const body = response.body as StepEditResponse;

    this.log(`Step ${body.step.id}`);
    this.log(`Action ${body.step.action}`);
    this.log(`Revision ${body.revision.severity} version ${String(body.revision.version_number)}`);
    this.log(`Affected sessions ${body.affected_sessions.join(", ") || "none"}`);
  }

  private async startSession(flags: ParsedFlags): Promise<void> {
    const sessionFlags = sessionStartFlagsFrom(flags);
    const response = await postJson(
      `${sessionFlags.apiUrl}/v1/sessions`,
      {
        agent_type: sessionFlags.agentType,
        auto_branch: sessionFlags.autoBranch,
        ...(sessionFlags.branchName === undefined ? {} : { branch_name: sessionFlags.branchName }),
        intent: sessionFlags.intent,
        pins: sessionFlags.pins,
        project_id: sessionFlags.projectId
      },
      {
        Cookie: sessionFlags.sessionCookie,
        "X-Vspec-Agent": "codex-cli"
      }
    );
    const body = response.body as SessionStartResponse;

    this.log(`Session ${body.session.id}`);
    this.log(`Intent ${body.session.intent}`);
    this.log(`Agent ${body.session.agent_type} ${body.session.agent_identifier}`);
    this.log(`Pinned revisions ${String(Object.keys(body.session.pinned_revisions).length)}`);
    this.log(`Session file ${body.session_file.path}`);
    for (const action of body.suggested_next_actions) {
      this.log(action.command);
    }
  }

  private async listSessions(flags: ParsedFlags): Promise<void> {
    const sessionFlags = sessionListFlagsFrom(flags);
    const url = new URL("/v1/sessions", sessionFlags.apiUrl);
    url.searchParams.set("workspace_id", sessionFlags.workspaceId);
    setSearchParam(url, "project_id", sessionFlags.projectId);
    setSearchParam(url, "status", sessionFlags.status);

    const response = await fetchJson(url, {
      headers: {
        Cookie: sessionFlags.sessionCookie
      }
    });
    const body = response.body as SessionListResponse;

    this.log(`Total sessions ${String(body.total)}`);
    this.log(`Total conflicts ${String(body.summary.total_conflicts)}`);
    for (const session of body.sessions) {
      this.log(`Session ${session.id}`);
      this.log(`Status ${session.status}`);
      this.log(`Agent ${session.agent_type} ${session.agent_identifier}`);
      this.log(`Intent ${session.intent}`);
      this.log(`Pins ${session.pinned_keys.join(", ") || "none"}`);
      this.log(`Branch ${session.branch_name ?? "none"}`);
      this.log(`Idle seconds ${String(session.idle_seconds)}`);
      this.log(`Locks ${String(session.lock_count)}`);
      this.log(`Conflicts ${String(session.conflict_markers.length)}`);
      if (session.markers.length > 0) {
        this.log(`Markers ${session.markers.join(", ")}`);
      }
    }
    for (const action of body.suggested_next_actions ?? []) {
      this.log(action.command);
    }
  }

  private async completeSession(flags: ParsedFlags): Promise<void> {
    const sessionFlags = sessionCompleteFlagsFrom(flags, this.argv[2]);
    const response = await postJson(
      `${sessionFlags.apiUrl}/v1/sessions/${sessionFlags.sessionId}/complete`,
      {
        no_merge: sessionFlags.noMerge,
        ...(sessionFlags.summary === undefined ? {} : { summary: sessionFlags.summary })
      },
      {
        Cookie: sessionFlags.sessionCookie
      }
    );
    const body = response.body as SessionCompleteResponse;

    this.log(`Session ${body.session.id}`);
    this.log(`Status ${body.session.status}`);
    this.log(`Ended at ${body.session.ended_at}`);
    this.log(`Released locks ${body.released_lock_ids.join(", ") || "none"}`);
    if (body.merge_request !== undefined) {
      this.log(`Merge request ${body.merge_request.id}`);
      this.log(`Merge status ${body.merge_request.status}`);
      this.log(`Strategy ${body.merge_request.strategy}`);
      this.log(`Conflicts ${String(body.merge_request.conflicts.length)}`);
    }
    this.log(`Session file ${body.session_file.path} cleared`);
    for (const warning of body.warnings ?? []) {
      this.log(`Warning ${warning.type} ${warning.lock_id}`);
    }
    for (const action of body.suggested_next_actions) {
      this.log(action.command);
    }
  }
}

type OAuthFlags = {
  apiUrl: string;
  githubCode: string;
};

type SignupFlags = {
  workspaceName: string;
  workspaceSlug: string;
};

type InviteFlags = {
  apiUrl: string;
  email: string;
  role: "EDITOR" | "OWNER";
  sessionCookie: string;
  workspaceId: string;
};

type ProjectFlags = {
  apiUrl: string;
  key: string;
  name: string;
  sessionCookie: string;
  visibility: "INTERNAL" | "PRIVATE";
  workspaceId: string;
};

type BranchCreateFlags = {
  apiUrl: string;
  from: string;
  name: string;
  projectId: string;
  sessionCookie: string;
};

type MergeOpenFlags = {
  apiUrl: string;
  sessionCookie: string;
  sourceBranchId: string;
  strategy: "FAST_FORWARD" | "SQUASH" | undefined;
  target: "main";
};

type MergeResolveFlags = {
  apiUrl: string;
  baseRevision: string;
  entityId: string;
  field: string;
  mergeId: string;
  sessionCookie: string;
  strategy: "MANUAL" | "MINE" | "THEIRS";
  value: string | undefined;
};

type LockCreateFlags = {
  apiUrl: string;
  reason: string;
  sessionCookie: string;
  sessionId: string | undefined;
  targetId: string;
  ttlMinutes: number;
  type: "HARD" | "SEMANTIC" | "SOFT";
};

type WhoFlags = {
  apiUrl: string;
  sessionCookie: string;
  usecaseId: string;
};

type HistoryFlags = {
  apiUrl: string;
  limit: string | undefined;
  sessionCookie: string;
  usecaseId: string;
};

type DiffFlags = {
  apiUrl: string;
  format: "agent" | "human" | "json";
  fromRevision: string;
  sessionCookie: string;
  toRevision: string;
  usecaseId: string;
};

type RevertFlags = {
  apiUrl: string;
  force: boolean;
  revisionId: string;
  sessionCookie: string;
  summary: string | undefined;
  usecaseId: string;
};

type ImpactFlags = {
  apiUrl: string;
  proposedChangePath: string | undefined;
  sessionCookie: string;
  usecaseId: string;
};

type CommentTargetFlags = {
  apiUrl: string;
  sessionCookie: string;
  targetId: string;
};

type CommentBodyFlags = CommentTargetFlags & {
  body: string;
};

type ActorFlags = {
  aliases: string[];
  apiUrl: string;
  description: string;
  name: string;
  projectId: string;
  sessionCookie: string;
  type: "OFFSTAGE" | "PRIMARY" | "SUPPORTING";
};

type StakeholderFlags = {
  apiUrl: string;
  description: string;
  name: string;
  projectId: string;
  sessionCookie: string;
  type: "EXTERNAL" | "INTERNAL" | "REGULATORY";
};

type GoalCreateFlags = {
  actorId: string;
  apiUrl: string;
  description: string;
  level: "SUMMARY" | "USER_GOAL" | "SUBFUNCTION";
  priority: "P0" | "P1" | "P2" | "P3";
  projectId: string;
  sessionCookie: string;
};

type GoalListFlags = {
  actorId: string | undefined;
  apiUrl: string;
  projectId: string;
  sessionCookie: string;
};

type GoalPromoteFlags = {
  apiUrl: string;
  goalId: string;
  sessionCookie: string;
};

type UseCaseCreateFlags = {
  apiUrl: string;
  primaryActor: string;
  projectId: string;
  sessionCookie: string;
  title: string;
};

type UseCaseListFlags = {
  actorId: string | undefined;
  apiUrl: string;
  cursor: string | undefined;
  level: string | undefined;
  limit: string | undefined;
  projectId: string;
  q: string | undefined;
  sessionCookie: string;
  status: string | undefined;
};

type UseCaseArchiveFlags = {
  apiUrl: string;
  sessionCookie: string;
  usecaseId: string;
};

type StakeholderInterestFlags = {
  apiUrl: string;
  interest: string;
  protectionMechanism: string;
  sessionCookie: string;
  stakeholder: string;
  usecaseId: string;
};

type ScenarioCreateFlags = {
  apiUrl: string;
  condition: string | undefined;
  extensionPoint: string | undefined;
  outcome: "FAILURE" | "PARTIAL" | "SUCCESS" | undefined;
  sessionCookie: string;
  type: "EXTENSION" | "MAIN_SUCCESS";
  usecaseId: string;
};

type StepCreateFlags = {
  action: string;
  actor: string;
  apiUrl: string;
  scenarioId: string;
  sessionCookie: string;
};

type StepEditFlags = {
  action: string;
  apiUrl: string;
  baseRevision: string;
  sessionCookie: string;
  stepId: string;
};

type SessionStartFlags = {
  agentType: string;
  apiUrl: string;
  autoBranch: boolean;
  branchName: string | undefined;
  intent: string;
  pins: string[];
  projectId: string;
  sessionCookie: string;
};

type SessionListFlags = {
  apiUrl: string;
  projectId: string | undefined;
  sessionCookie: string;
  status: string | undefined;
  workspaceId: string;
};

type SessionCompleteFlags = {
  apiUrl: string;
  noMerge: boolean;
  sessionCookie: string;
  sessionId: string;
  summary: string | undefined;
};

type ParsedFlags = {
  "api-url"?: string;
  "agent-type"?: string;
  "auto-branch"?: boolean;
  action?: string;
  actor?: string;
  aliases?: string;
  "actor-id"?: string;
  at?: string;
  "base-revision"?: string;
  body?: string;
  "branch-name"?: string;
  condition?: string;
  cursor?: string;
  description?: string;
  email?: string;
  "entity-id"?: string;
  field?: string;
  force?: boolean;
  format?: string;
  from?: string;
  "github-code"?: string;
  intent?: string;
  into?: string;
  interest?: string;
  key?: string;
  level?: string;
  limit?: string;
  name?: string;
  "no-merge"?: boolean;
  priority?: string;
  "primary-actor"?: string;
  "project-id"?: string;
  "proposed-change"?: string;
  "protection-mechanism"?: string;
  outcome?: string;
  pin?: string;
  q?: string;
  reason?: string;
  role?: string;
  session?: string;
  "session-cookie"?: string;
  stakeholder?: string;
  status?: string;
  strategy?: string;
  summary?: string;
  title?: string;
  to?: string;
  ttl?: string;
  type?: string;
  value?: string;
  visibility?: string;
  "workspace-id"?: string;
  "workspace-name"?: string;
  "workspace-slug"?: string;
};

type OAuthStartResponse = {
  state: string;
};

type SignupResponse = {
  recommended_next_command: string;
  user: {
    email: string;
  };
  workspace: {
    slug: string;
  };
};

type LoginResponse = {
  recommended_next_command?: string;
  user: {
    github_id: string;
  };
  workspaces: Array<{
    role: string;
    slug: string;
  }>;
};

type InvitationResponse = {
  invitation: {
    email: string;
    role: string;
  };
  suggested_next_actions: Array<{
    command: string;
  }>;
};

type ProjectResponse = {
  default_branch: {
    name: string;
  };
  project: {
    key: string;
    name: string;
  };
  recommended_next_command: string;
};

type BranchCreateResponse = {
  branch: {
    base_revision_ids: Record<string, string>;
    head_revision_ids: Record<string, string>;
    id: string;
    name: string;
    owner_type: string;
    status: string;
  };
  suggested_next_actions: Array<{
    command: string;
  }>;
  warnings?: Array<{
    merge_request_id: string;
    type: string;
  }>;
};

type MergeOpenResponse = {
  main_head_revision_ids: Record<string, string>;
  merge_request: {
    conflicts: unknown[];
    id: string;
    impact: {
      severity_by_entity: Record<string, string>;
    };
    status: string;
    strategy: string;
  };
  source_branch: {
    id: string;
    status: string;
  };
  suggested_next_actions: Array<{
    command: string;
  }>;
};

type MergeResolveResponse = {
  main_head_revision_ids: Record<string, string>;
  merge_request: {
    conflicts: unknown[];
    id: string;
    status: string;
  };
  new_revisions: unknown[];
  source_branch: {
    id: string;
    status: string;
  };
  suggested_next_actions: Array<{
    command: string;
  }>;
};

type LockCreateResponse = {
  lock: {
    auto_release: boolean;
    expires_at: string;
    held_by_session_id: null | string;
    held_by_user_id: string;
    id: string;
    lock_type: string;
    target_id: string;
  };
  suggested_next_actions: Array<{
    command: string;
  }>;
};

type WhoResponse = {
  locks: Array<{
    expires_at: string;
    held_by_session_id: null | string;
    held_by_user_id: string;
    id: string;
    lock_type: string;
  }>;
  merge_requests: Array<{
    conflict_count: number;
    id: string;
    source_branch_id: string;
    status: string;
  }>;
  sessions: Array<{
    agent_type: string;
    id: string;
    intent: string;
    markers?: string[];
  }>;
  suggested_next_actions: Array<{
    command: string;
  }>;
  usecase: {
    key: string;
  };
};

type HistoryResponse = {
  limit: number;
  revisions: Array<{
    author: string;
    change_summary?: string;
    entity_id: string;
    entity_type: string;
    revision: string;
    timestamp: string;
    version_number: number;
  }>;
  suggested_next_actions: Array<{
    command: string;
  }>;
  suppressed_count: number;
  truncated: boolean;
  usecase: {
    key: string;
  };
};

type DiffResponse = {
  changes: Array<{
    change_type: string;
    entity_type: string;
    path: string;
    revision: string;
    severity: string;
    source_branch?: string;
  }>;
  cross_branch?: boolean;
  format: string;
  from_revision: string;
  note?: string;
  suggested_next_actions: Array<{
    command: string;
  }>;
  summary: {
    breaking: number;
    cosmetic: number;
    non_breaking: number;
  };
  to_revision: string;
  usecase: {
    key: string;
  };
  warnings?: Array<{
    from_branch: string;
    to_branch: string;
    type: string;
  }>;
};

type RevertResponse = {
  impact: {
    affected_branches: string[];
    affected_sessions: string[];
    severity: string;
  };
  revision: {
    change_summary: string;
    id: string;
    parent_revision_id: string;
    severity: string;
    version_number: number;
  };
  suggested_next_actions: Array<{
    command: string;
  }>;
  usecase: {
    current_revision_id: string;
    id: string;
    title: string;
  };
  warnings?: Array<{
    message: string;
    type: string;
  }>;
};

type ImpactResponse = {
  cached: boolean;
  impact: {
    affected_branches: string[];
    affected_sessions: Array<{
      agent_type: string;
      id: string;
      owner: string;
      pinned_revision: string;
    }>;
    affected_tests: string[];
    confidence: number;
    input_hash: string;
    severity: string;
  };
  preview_id: string;
  suggested_next_actions: Array<{
    command: string;
  }>;
};

type CommentPayload = {
  author_id: string;
  body: string;
  created_at: string;
  id: string;
  resolved: boolean;
  resolved_at: null | string;
  target_id: string;
  target_type: string;
  updated_at: null | string;
};

type CommentResponse = {
  comment: CommentPayload;
  suggested_next_actions: Array<{
    command: string;
  }>;
};

type CommentListResponse = {
  comments: CommentPayload[];
};

type ActorResponse = {
  actor: {
    name: string;
    type: string;
  };
  recommended_next_command: string;
  revision: {
    version_number: number;
  };
};

type StakeholderResponse = {
  recommended_next_command: string;
  revision: {
    version_number: number;
  };
  stakeholder: {
    name: string;
    type: string;
  };
};

type GoalResponse = {
  goal: {
    description: string;
    priority: string;
    status: string;
  };
  recommended_next_command: string;
  revision: {
    version_number: number;
  };
  warnings?: Array<{
    command: string;
  }>;
};

type GoalListResponse = {
  actors: Array<{
    actor: {
      name: string;
    };
    goals: Array<{
      description: string;
      priority: string;
      status: string;
    }>;
  }>;
};

type GoalPromotionResponse = {
  goal: {
    status: string;
  };
  revision: {
    version_number: number;
  };
  suggested_next_actions: Array<{
    command: string;
  }>;
  usecase: {
    format: string;
    key: string;
    title: string;
  };
  warnings?: Array<{
    message: string;
  }>;
};

type UseCaseResponse = {
  revision: {
    version_number: number;
  };
  suggested_next_actions: Array<{
    command: string;
  }>;
  usecase: {
    format: string;
    key: string;
    level: string;
    priority: string;
    status: string;
    title: string;
  };
};

type UseCaseListResponse = {
  items: Array<{
    key: string;
    level: string;
    primary_actor: string;
    status: string;
    title: string;
    trigger_excerpt: string;
  }>;
  next_cursor: string | null;
  suggested_next_actions?: Array<{
    command: string;
  }>;
};

type UseCaseArchiveResponse = {
  active_locks_count: number;
  affected_sessions_count: number;
  revision: {
    change_summary: string;
  };
  suggested_next_actions: Array<{
    command: string;
  }>;
  usecase: {
    archived_at: string;
    key: string;
  };
};

type StakeholderInterestResponse = {
  next_missing_role_hint: string;
  revision: {
    severity: string;
    version_number: number;
  };
  stakeholder_interest: {
    interest: string;
    protection_mechanism: string;
  };
  stakeholder_interests: Array<{
    interest: {
      interest: string;
    };
    stakeholder: {
      name: string;
    };
  }>;
};

type ScenarioResponse = {
  revision: {
    severity: string;
    version_number: number;
  };
  scenario: {
    condition: string | null;
    extension_point: string | null;
    id: string;
    outcome: string;
    type: string;
  };
};

type StepResponse = {
  revision: {
    severity: string;
    version_number: number;
  };
  scenario_steps: Array<{
    action: string;
    step_number: number;
  }>;
  step: {
    action: string;
    step_number: number;
  };
};

type StepEditResponse = {
  affected_sessions: string[];
  revision: {
    severity: string;
    version_number: number;
  };
  step: {
    action: string;
    id: string;
  };
};

type SessionStartResponse = {
  session: {
    agent_identifier: string;
    agent_type: string;
    id: string;
    intent: string;
    pinned_revisions: Record<string, string>;
  };
  session_file: {
    path: string;
  };
  suggested_next_actions: Array<{
    command: string;
  }>;
};

type SessionListResponse = {
  sessions: Array<{
    agent_identifier: string;
    agent_type: string;
    branch_name: null | string;
    conflict_markers: string[];
    id: string;
    idle_seconds: number;
    intent: string;
    lock_count: number;
    markers: string[];
    pinned_keys: string[];
    status: string;
  }>;
  suggested_next_actions?: Array<{
    command: string;
  }>;
  summary: {
    total_conflicts: number;
  };
  total: number;
};

type SessionCompleteResponse = {
  merge_request?: {
    conflicts: unknown[];
    id: string;
    status: string;
    strategy: string;
  };
  released_lock_ids: string[];
  session: {
    ended_at: string;
    id: string;
    status: string;
  };
  session_file: {
    path: string;
  };
  suggested_next_actions: Array<{
    command: string;
  }>;
  warnings?: Array<{
    lock_id: string;
    type: string;
  }>;
};

function oauthFlagsFrom(flags: ParsedFlags): OAuthFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    githubCode: requiredFlag(flags, "github-code")
  };
}

function signupFlagsFrom(flags: ParsedFlags): SignupFlags | undefined {
  if (flags["workspace-name"] === undefined && flags["workspace-slug"] === undefined) {
    return undefined;
  }

  return {
    workspaceName: requiredFlag(flags, "workspace-name"),
    workspaceSlug: requiredFlag(flags, "workspace-slug")
  };
}

function inviteFlagsFrom(flags: ParsedFlags): InviteFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    email: requiredFlag(flags, "email"),
    role: invitationRole(requiredFlag(flags, "role")),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    workspaceId: requiredFlag(flags, "workspace-id")
  };
}

function projectFlagsFrom(flags: ParsedFlags): ProjectFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    key: requiredFlag(flags, "key"),
    name: requiredFlag(flags, "name"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    visibility: projectVisibility(flags.visibility ?? "PRIVATE"),
    workspaceId: requiredFlag(flags, "workspace-id")
  };
}

function branchCreateFlagsFrom(
  flags: ParsedFlags,
  name: string | undefined
): BranchCreateFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    from: flags.from ?? "main",
    name: requiredArgument(name, "branch-name"),
    projectId: requiredFlag(flags, "project-id"),
    sessionCookie: requiredFlag(flags, "session-cookie")
  };
}

function mergeOpenFlagsFrom(
  flags: ParsedFlags,
  sourceBranchId: string | undefined
): MergeOpenFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    sourceBranchId: requiredArgument(sourceBranchId, "branch-id"),
    strategy: mergeStrategy(optionalFlag(flags, "strategy")),
    target: mergeTarget(flags.into ?? "main")
  };
}

function mergeResolveFlagsFrom(
  flags: ParsedFlags,
  mergeId: string | undefined
): MergeResolveFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    baseRevision: requiredFlag(flags, "base-revision"),
    entityId: requiredFlag(flags, "entity-id"),
    field: requiredFlag(flags, "field"),
    mergeId: requiredArgument(mergeId, "merge-id"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    strategy: resolutionStrategy(requiredFlag(flags, "strategy")),
    value: optionalFlag(flags, "value")
  };
}

function lockCreateFlagsFrom(flags: ParsedFlags, targetId: string | undefined): LockCreateFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    reason: requiredFlag(flags, "reason"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    sessionId: optionalFlag(flags, "session"),
    targetId: requiredArgument(targetId, "usecase-id"),
    ttlMinutes: ttlMinutes(flags.ttl),
    type: lockType(requiredFlag(flags, "type"))
  };
}

function whoFlagsFrom(flags: ParsedFlags, usecaseId: string | undefined): WhoFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    usecaseId: requiredArgument(usecaseId, "usecase-id")
  };
}

function historyFlagsFrom(flags: ParsedFlags, usecaseId: string | undefined): HistoryFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    limit: optionalFlag(flags, "limit"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    usecaseId: requiredArgument(usecaseId, "usecase-id")
  };
}

function diffFlagsFrom(
  flags: ParsedFlags,
  usecaseId: string | undefined,
  fromRevision: string | undefined,
  toRevision: string | undefined
): DiffFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    format: diffFormat(flags.format ?? "human"),
    fromRevision: requiredArgument(fromRevision, "from-revision"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    toRevision: requiredArgument(toRevision, "to-revision"),
    usecaseId: requiredArgument(usecaseId, "usecase-id")
  };
}

function revertFlagsFrom(flags: ParsedFlags, usecaseId: string | undefined): RevertFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    force: flags.force ?? false,
    revisionId: requiredFlag(flags, "to"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    summary: optionalFlag(flags, "summary"),
    usecaseId: requiredArgument(usecaseId, "usecase-id")
  };
}

function impactFlagsFrom(flags: ParsedFlags, usecaseId: string | undefined): ImpactFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    proposedChangePath: optionalFlag(flags, "proposed-change"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    usecaseId: requiredArgument(usecaseId, "usecase-id")
  };
}

function commentTargetFlagsFrom(
  flags: ParsedFlags,
  targetId: string | undefined,
  argumentName: string
): CommentTargetFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    targetId: requiredArgument(targetId, argumentName)
  };
}

function commentBodyFlagsFrom(
  flags: ParsedFlags,
  targetId: string | undefined,
  argumentName: string
): CommentBodyFlags {
  return {
    ...commentTargetFlagsFrom(flags, targetId, argumentName),
    body: requiredFlag(flags, "body")
  };
}

function actorFlagsFrom(flags: ParsedFlags): ActorFlags {
  return {
    aliases: aliasesFrom(flags.aliases),
    apiUrl: requiredFlag(flags, "api-url"),
    description: flags.description ?? "",
    name: requiredFlag(flags, "name"),
    projectId: requiredFlag(flags, "project-id"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    type: actorType(requiredFlag(flags, "type"))
  };
}

function stakeholderFlagsFrom(flags: ParsedFlags): StakeholderFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    description: flags.description ?? "",
    name: requiredFlag(flags, "name"),
    projectId: requiredFlag(flags, "project-id"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    type: stakeholderType(requiredFlag(flags, "type"))
  };
}

function goalCreateFlagsFrom(flags: ParsedFlags): GoalCreateFlags {
  return {
    actorId: requiredFlag(flags, "actor-id"),
    apiUrl: requiredFlag(flags, "api-url"),
    description: requiredFlag(flags, "description"),
    level: goalLevel(requiredFlag(flags, "level")),
    priority: goalPriority(requiredFlag(flags, "priority")),
    projectId: requiredFlag(flags, "project-id"),
    sessionCookie: requiredFlag(flags, "session-cookie")
  };
}

function goalListFlagsFrom(flags: ParsedFlags): GoalListFlags {
  return {
    actorId: optionalFlag(flags, "actor-id"),
    apiUrl: requiredFlag(flags, "api-url"),
    projectId: requiredFlag(flags, "project-id"),
    sessionCookie: requiredFlag(flags, "session-cookie")
  };
}

function goalPromoteFlagsFrom(
  flags: ParsedFlags,
  goalId: string | undefined
): GoalPromoteFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    goalId: requiredArgument(goalId, "goal-id"),
    sessionCookie: requiredFlag(flags, "session-cookie")
  };
}

function useCaseCreateFlagsFrom(flags: ParsedFlags): UseCaseCreateFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    primaryActor: requiredFlag(flags, "primary-actor"),
    projectId: requiredFlag(flags, "project-id"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    title: requiredFlag(flags, "title")
  };
}

function useCaseListFlagsFrom(flags: ParsedFlags): UseCaseListFlags {
  return {
    actorId: optionalFlag(flags, "actor-id"),
    apiUrl: requiredFlag(flags, "api-url"),
    cursor: optionalFlag(flags, "cursor"),
    level: optionalFlag(flags, "level"),
    limit: optionalFlag(flags, "limit"),
    projectId: requiredFlag(flags, "project-id"),
    q: optionalFlag(flags, "q"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    status: optionalFlag(flags, "status")
  };
}

function useCaseArchiveFlagsFrom(
  flags: ParsedFlags,
  usecaseId: string | undefined
): UseCaseArchiveFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    usecaseId: requiredArgument(usecaseId, "usecase-id")
  };
}

function stakeholderInterestFlagsFrom(
  flags: ParsedFlags,
  usecaseId: string | undefined
): StakeholderInterestFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    interest: requiredFlag(flags, "interest"),
    protectionMechanism: flags["protection-mechanism"] ?? "",
    sessionCookie: requiredFlag(flags, "session-cookie"),
    stakeholder: requiredFlag(flags, "stakeholder"),
    usecaseId: requiredArgument(usecaseId, "usecase-id")
  };
}

function scenarioCreateFlagsFrom(
  flags: ParsedFlags,
  usecaseId: string | undefined
): ScenarioCreateFlags {
  const type = scenarioType(requiredFlag(flags, "type"));
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    condition: scenarioCondition(flags, type),
    extensionPoint: scenarioExtensionPoint(flags, type),
    outcome: scenarioOutcome(flags.outcome),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    type,
    usecaseId: requiredArgument(usecaseId, "usecase-id")
  };
}

function stepCreateFlagsFrom(
  flags: ParsedFlags,
  scenarioId: string | undefined
): StepCreateFlags {
  return {
    action: requiredFlag(flags, "action"),
    actor: requiredFlag(flags, "actor"),
    apiUrl: requiredFlag(flags, "api-url"),
    scenarioId: requiredArgument(scenarioId, "scenario-id"),
    sessionCookie: requiredFlag(flags, "session-cookie")
  };
}

function stepEditFlagsFrom(
  flags: ParsedFlags,
  stepId: string | undefined
): StepEditFlags {
  return {
    action: requiredFlag(flags, "action"),
    apiUrl: requiredFlag(flags, "api-url"),
    baseRevision: requiredFlag(flags, "base-revision"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    stepId: requiredArgument(stepId, "step-id")
  };
}

function sessionStartFlagsFrom(flags: ParsedFlags): SessionStartFlags {
  return {
    agentType: agentType(flags["agent-type"] ?? "OTHER"),
    apiUrl: requiredFlag(flags, "api-url"),
    autoBranch: flags["auto-branch"] ?? false,
    branchName: optionalFlag(flags, "branch-name"),
    intent: requiredFlag(flags, "intent"),
    pins: pinsFrom(requiredFlag(flags, "pin")),
    projectId: requiredFlag(flags, "project-id"),
    sessionCookie: requiredFlag(flags, "session-cookie")
  };
}

function sessionListFlagsFrom(flags: ParsedFlags): SessionListFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    projectId: optionalFlag(flags, "project-id"),
    sessionCookie: requiredFlag(flags, "session-cookie"),
    status: optionalFlag(flags, "status"),
    workspaceId: requiredFlag(flags, "workspace-id")
  };
}

function sessionCompleteFlagsFrom(
  flags: ParsedFlags,
  sessionId: string | undefined
): SessionCompleteFlags {
  return {
    apiUrl: requiredFlag(flags, "api-url"),
    noMerge: flags["no-merge"] ?? false,
    sessionCookie: requiredFlag(flags, "session-cookie"),
    sessionId: requiredArgument(sessionId, "session-id"),
    summary: optionalFlag(flags, "summary")
  };
}

function invitationRole(rawRole: string): "EDITOR" | "OWNER" {
  const role = rawRole.toUpperCase();
  if (role === "EDITOR" || role === "OWNER") {
    return role;
  }

  throw new Error("Role must be EDITOR or OWNER.");
}

function projectVisibility(rawVisibility: string): "INTERNAL" | "PRIVATE" {
  const visibility = rawVisibility.toUpperCase();
  if (visibility === "INTERNAL" || visibility === "PRIVATE") {
    return visibility;
  }

  throw new Error("Visibility must be INTERNAL or PRIVATE.");
}

function actorType(rawType: string): "OFFSTAGE" | "PRIMARY" | "SUPPORTING" {
  const type = rawType.toUpperCase();
  if (type === "OFFSTAGE" || type === "PRIMARY" || type === "SUPPORTING") {
    return type;
  }

  throw new Error("Actor type must be PRIMARY, SUPPORTING, or OFFSTAGE.");
}

function stakeholderType(rawType: string): "EXTERNAL" | "INTERNAL" | "REGULATORY" {
  const type = rawType.toUpperCase();
  if (type === "EXTERNAL" || type === "INTERNAL" || type === "REGULATORY") {
    return type;
  }

  throw new Error("Stakeholder type must be INTERNAL, EXTERNAL, or REGULATORY.");
}

function goalLevel(rawLevel: string): "SUMMARY" | "USER_GOAL" | "SUBFUNCTION" {
  const level = rawLevel.toUpperCase();
  if (level === "SUMMARY" || level === "USER_GOAL" || level === "SUBFUNCTION") {
    return level;
  }

  throw new Error("Goal level must be SUMMARY, USER_GOAL, or SUBFUNCTION.");
}

function goalPriority(rawPriority: string): "P0" | "P1" | "P2" | "P3" {
  const priority = rawPriority.toUpperCase();
  if (priority === "P0" || priority === "P1" || priority === "P2" || priority === "P3") {
    return priority;
  }

  throw new Error("Goal priority must be P0, P1, P2, or P3.");
}

function mergeStrategy(rawStrategy: string | undefined): "FAST_FORWARD" | "SQUASH" | undefined {
  if (rawStrategy === undefined) {
    return undefined;
  }
  const strategy = rawStrategy.toUpperCase().replaceAll("-", "_");
  if (strategy === "FAST_FORWARD" || strategy === "SQUASH") {
    return strategy;
  }

  throw new Error("Merge strategy must be FAST_FORWARD or SQUASH.");
}

function resolutionStrategy(rawStrategy: string): "MANUAL" | "MINE" | "THEIRS" {
  const strategy = rawStrategy.toUpperCase();
  if (strategy === "MANUAL" || strategy === "MINE" || strategy === "THEIRS") {
    return strategy;
  }

  throw new Error("Resolution strategy must be MANUAL, MINE, or THEIRS.");
}

function lockType(rawType: string): "HARD" | "SEMANTIC" | "SOFT" {
  const type = rawType.toUpperCase();
  if (type === "HARD" || type === "SEMANTIC" || type === "SOFT") {
    return type;
  }

  throw new Error("Lock type must be HARD, SEMANTIC, or SOFT.");
}

function ttlMinutes(rawTtl: string | undefined): number {
  if (rawTtl === undefined) {
    return 30;
  }
  const parsed = Number(rawTtl);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  throw new Error("Lock TTL must be a positive number.");
}

function mergeTarget(rawTarget: string): "main" {
  if (rawTarget === "main") {
    return rawTarget;
  }

  throw new Error("Merge target must be main.");
}

function diffFormat(rawFormat: string): "agent" | "human" | "json" {
  const format = rawFormat.toLowerCase();
  if (format === "agent" || format === "human" || format === "json") {
    return format;
  }

  throw new Error("Diff format must be human, json, or agent.");
}

function scenarioType(rawType: string): "EXTENSION" | "MAIN_SUCCESS" {
  const type = rawType.toUpperCase().replaceAll("-", "_");
  if (type === "EXTENSION" || type === "MAIN_SUCCESS") {
    return type;
  }

  throw new Error("Scenario type must be MAIN_SUCCESS or EXTENSION.");
}

function scenarioOutcome(
  rawOutcome: string | undefined
): "FAILURE" | "PARTIAL" | "SUCCESS" | undefined {
  if (rawOutcome === undefined || rawOutcome.trim() === "") {
    return undefined;
  }

  const outcome = rawOutcome.toUpperCase();
  if (outcome === "FAILURE" || outcome === "PARTIAL" || outcome === "SUCCESS") {
    return outcome;
  }

  throw new Error("Scenario outcome must be FAILURE, PARTIAL, or SUCCESS.");
}

function scenarioCondition(
  flags: ParsedFlags,
  type: "EXTENSION" | "MAIN_SUCCESS"
): string | undefined {
  return type === "EXTENSION" ? requiredFlag(flags, "condition") : undefined;
}

function scenarioExtensionPoint(
  flags: ParsedFlags,
  type: "EXTENSION" | "MAIN_SUCCESS"
): string | undefined {
  return type === "EXTENSION" ? requiredFlag(flags, "at") : undefined;
}

function aliasesFrom(rawAliases: string | undefined): string[] {
  if (rawAliases === undefined || rawAliases.trim() === "") {
    return [];
  }

  return rawAliases.split(",").map((alias) => alias.trim()).filter(Boolean);
}

function pinsFrom(rawPins: string): string[] {
  return rawPins.split(",").map((pin) => pin.trim()).filter(Boolean);
}

function agentType(rawAgentType: string): string {
  return rawAgentType.toUpperCase().replaceAll("-", "_");
}

function optionalFlag(values: ParsedFlags, name: keyof ParsedFlags): string | undefined {
  const value = values[name];
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  return value;
}

function setSearchParam(url: URL, name: string, value: string | undefined): void {
  if (value !== undefined) {
    url.searchParams.set(name, value);
  }
}

function requiredFlag(values: ParsedFlags, name: keyof ParsedFlags): string {
  const value = values[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing --${name}.`);
  }

  return value;
}

function requiredArgument(value: string | undefined, name: string): string {
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

async function latestUseCaseRevision(
  flags: Pick<ImpactFlags, "apiUrl" | "sessionCookie" | "usecaseId">
): Promise<{ revision: string }> {
  const url = new URL(`/v1/usecases/${flags.usecaseId}/revisions`, flags.apiUrl);
  url.searchParams.set("limit", "1");
  const response = await fetchJson(url, {
    headers: {
      Cookie: flags.sessionCookie
    }
  });
  const body = response.body as Pick<HistoryResponse, "revisions">;
  const latest = body.revisions[0];
  if (latest === undefined) {
    throw new Error("Use case has no revisions.");
  }

  return { revision: latest.revision };
}

async function proposedChangePayload(path: string | undefined): Promise<Record<string, string>> {
  if (path === undefined) {
    return {};
  }

  return {
    proposed_change_content: await readFile(path, "utf8"),
    proposed_change_path: path
  };
}

function formatAffectedSessions(sessions: ImpactResponse["impact"]["affected_sessions"]): string {
  if (sessions.length === 0) {
    return "none";
  }

  return sessions
    .map((session) =>
      `${session.id} ${session.agent_type} ${session.owner} ${session.pinned_revision}`
    )
    .join(", ");
}

type JsonResponse = {
  body: unknown;
  cookie: string;
};

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<JsonResponse> {
  return fetchJson(url, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    method: "POST"
  });
}

async function patchJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<JsonResponse> {
  return fetchJson(url, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    method: "PATCH"
  });
}

async function deleteJson(
  url: string,
  headers: Record<string, string> = {}
): Promise<JsonResponse> {
  return fetchJson(url, {
    headers,
    method: "DELETE"
  });
}

async function fetchJson(
  url: URL | string,
  init: RequestInit
): Promise<JsonResponse> {
  const response = await fetch(url, init);
  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(`API request failed with ${String(response.status)}.`);
  }

  return {
    body,
    cookie: response.headers.get("set-cookie") ?? ""
  };
}

export async function runCli(argv = process.argv.slice(2)): Promise<void> {
  try {
    if (argv.includes("--help") || argv.includes("-h")) {
      await VspecCommand.run(["--help"], {
        pjson: {
          name: "vspec",
          oclif: {
            commands: {
              strategy: "single",
              target: "index.js"
            }
          },
          version: "1.0.0"
        },
        root
      });
      await flush();
      return;
    }
    await VspecCommand.run(argv, {
      pjson: {
        name: "vspec",
        oclif: {
          commands: {
            strategy: "single",
            target: "index.js"
          }
        },
        version: "1.0.0"
      },
      root
    });
    await flush();
  } catch (error: unknown) {
    await handle(error instanceof Error ? error : new Error(String(error)));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void runCli();
}
