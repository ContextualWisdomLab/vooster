export function usesPassiveVoice(action: string): boolean {
  const normalized = action.trim();
  if (/[가-힣]/u.test(normalized)) {
    return false;
  }

  const match =
    /^(?<subject>.+?)\s+(?:is|are|was|were)\s+(?<participle>[a-z]+ed)\.?$/i.exec(
      normalized
    );
  if (match?.groups === undefined) {
    return false;
  }
  const subject = match.groups.subject;
  if (subject === undefined) {
    return false;
  }

  return !/\b(?:is|are|was|were|and|or)\b/i.test(subject);
}
