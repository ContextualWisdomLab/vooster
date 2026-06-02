const VERB_PHRASE_STARTS = new Set([
  "add",
  "approve",
  "author",
  "branch",
  "cancel",
  "comment",
  "create",
  "diagnose",
  "diff",
  "export",
  "import",
  "inspect",
  "lock",
  "merge",
  "pin",
  "place",
  "promote",
  "pull",
  "push",
  "renew",
  "request",
  "review",
  "revert",
  "run",
  "start",
  "submit",
  "sync",
  "track",
  "unlock",
  "write"
]);

export type SpecLanguage = "en" | "ko";

export type VerbPhraseOptions = {
  spec_language?: SpecLanguage;
};

export const DEFAULT_SPEC_LANGUAGE: SpecLanguage = "ko";

export function titleLooksLikeVerbPhrase(
  title: string,
  options: VerbPhraseOptions = {}
): boolean {
  const specLanguage = options.spec_language ?? DEFAULT_SPEC_LANGUAGE;
  if (specLanguage === "ko" && titleLooksLikeKoreanVerbPhrase(title)) {
    return true;
  }
  return titleLooksLikeEnglishVerbPhrase(title);
}

function titleLooksLikeEnglishVerbPhrase(title: string): boolean {
  const firstWord = title
    .trim()
    .match(/^[A-Za-z]+/)?.[0]
    .toLowerCase();
  return firstWord !== undefined && VERB_PHRASE_STARTS.has(baseVerb(firstWord));
}

function baseVerb(word: string): string {
  return word.endsWith("s") ? word.slice(0, -1) : word;
}

function titleLooksLikeKoreanVerbPhrase(title: string): boolean {
  const normalized = title.trim().replace(/[.!?。！？]+$/u, "");
  if (!/[가-힣]/u.test(normalized)) {
    return false;
  }
  return (
    normalized.endsWith("한다") ||
    normalized.endsWith("한다요") ||
    normalized.endsWith("는다") ||
    normalized.endsWith("본다") ||
    normalized.endsWith("쓴다") ||
    normalized.endsWith("읽는다") ||
    normalized.endsWith("잠근다") ||
    normalized.endsWith("푼다") ||
    normalized.endsWith("보낸다") ||
    normalized.endsWith("받는다") ||
    normalized.endsWith("가져온다")
  );
}
