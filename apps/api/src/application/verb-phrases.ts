const VERB_PHRASE_STARTS = new Set([
  "add",
  "analyze",
  "approve",
  "archive",
  "author",
  "branch",
  "accept",
  "book",
  "cancel",
  "comment",
  "compare",
  "complete",
  "create",
  "define",
  "delete",
  "diagnose",
  "diff",
  "edit",
  "export",
  "fetch",
  "import",
  "inspect",
  "invite",
  "issue",
  "join",
  "learn",
  "lock",
  "log",
  "manage",
  "merge",
  "monitor",
  "pin",
  "place",
  "pay",
  "promote",
  "propose",
  "pull",
  "push",
  "renew",
  "request",
  "receive",
  "resolve",
  "restore",
  "review",
  "revert",
  "run",
  "search",
  "see",
  "sign",
  "start",
  "submit",
  "sync",
  "track",
  "unlock",
  "update",
  "view",
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

export function verbPhraseOffendingWord(title: string): string {
  const words = title.trim().match(/[A-Za-z가-힣-]+/gu) ?? [];
  return words[1] ?? words[0] ?? title.trim();
}

function titleLooksLikeEnglishVerbPhrase(title: string): boolean {
  const words = title
    .trim()
    .match(/[A-Za-z]+/g)
    ?.map((word) => word.toLowerCase());
  if (words === undefined) {
    return false;
  }
  return verbPhraseWord(words[0]) || (words.length > 1 && verbPhraseWord(words[1]));
}

function verbPhraseWord(word: string | undefined): boolean {
  return word !== undefined && VERB_PHRASE_STARTS.has(baseVerb(word));
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
