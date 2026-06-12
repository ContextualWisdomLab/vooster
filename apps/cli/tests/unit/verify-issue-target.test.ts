import { describe, expect, it } from "vitest";

import {
  issueRepositoryRequiresExternalToken,
  resolveVerifyIssueRepository
} from "../../../../scripts/verify-issue-target.js";

describe("verify issue target", () => {
  it("routes fork verify issues to the upstream repository", () => {
    expect(
      resolveVerifyIssueRepository({
        currentRepository: "fork-owner/product",
        repositoryMetadata: {
          fork: true,
          parent: { full_name: "upstream-owner/product" }
        }
      })
    ).toEqual({ owner: "upstream-owner", repo: "product" });
  });

  it("keeps non-fork verify issues in the current repository", () => {
    expect(
      resolveVerifyIssueRepository({
        currentRepository: "vibemafiaclub/vooster",
        repositoryMetadata: { fork: false }
      })
    ).toEqual({ owner: "vibemafiaclub", repo: "vooster" });
  });

  it("allows an explicit issue repository override", () => {
    expect(
      resolveVerifyIssueRepository({
        configuredRepository: "ops/alerts",
        currentRepository: "Seongho-Bae/vooster",
        repositoryMetadata: {
          fork: true,
          parent: { full_name: "vibemafiaclub/vooster" }
        }
      })
    ).toEqual({ owner: "ops", repo: "alerts" });
  });

  it("requires an external token only when reporting outside the current repository", () => {
    expect(
      issueRepositoryRequiresExternalToken({
        currentRepository: "fork-owner/product",
        issueRepository: { owner: "upstream-owner", repo: "product" }
      })
    ).toBe(true);

    expect(
      issueRepositoryRequiresExternalToken({
        currentRepository: "upstream-owner/product",
        issueRepository: { owner: "upstream-owner", repo: "product" }
      })
    ).toBe(false);
  });
});
