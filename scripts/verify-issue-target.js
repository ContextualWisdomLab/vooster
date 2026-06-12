export function resolveVerifyIssueRepository({
  configuredRepository,
  currentRepository,
  repositoryMetadata
}) {
  const configured = configuredRepository?.trim();
  if (configured !== undefined && configured !== "") {
    return parseRepositoryFullName(configured);
  }

  if (
    repositoryMetadata?.fork === true &&
    repositoryMetadata.parent?.full_name !== undefined
  ) {
    return parseRepositoryFullName(repositoryMetadata.parent.full_name);
  }

  return parseRepositoryFullName(currentRepository);
}

export function issueRepositoryRequiresExternalToken({
  currentRepository,
  issueRepository
}) {
  const current = parseRepositoryFullName(currentRepository);
  return (
    current.owner.toLowerCase() !== issueRepository.owner.toLowerCase() ||
    current.repo.toLowerCase() !== issueRepository.repo.toLowerCase()
  );
}

function parseRepositoryFullName(fullName) {
  const parts = fullName?.trim().split("/") ?? [];
  if (parts.length !== 2 || parts.some((part) => part.trim() === "")) {
    throw new Error(
      `Expected GitHub repository as owner/repo, got ${JSON.stringify(fullName)}`
    );
  }
  return { owner: parts[0], repo: parts[1] };
}
