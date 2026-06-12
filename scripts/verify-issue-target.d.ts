type VerifyIssueRepository = {
  owner: string;
  repo: string;
};

type VerifyIssueRepositoryMetadata = {
  fork?: boolean;
  parent?: {
    full_name?: string;
  };
};

export function resolveVerifyIssueRepository(input: {
  configuredRepository?: string;
  currentRepository: string;
  repositoryMetadata?: VerifyIssueRepositoryMetadata;
}): VerifyIssueRepository;

export function issueRepositoryRequiresExternalToken(input: {
  currentRepository: string;
  issueRepository: VerifyIssueRepository;
}): boolean;
