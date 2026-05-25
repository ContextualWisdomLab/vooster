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

export function titleLooksLikeVerbPhrase(title: string): boolean {
  const firstWord = title
    .trim()
    .match(/^[A-Za-z]+/)?.[0]
    .toLowerCase();
  return firstWord !== undefined && VERB_PHRASE_STARTS.has(baseVerb(firstWord));
}

function baseVerb(word: string): string {
  return word.endsWith("s") ? word.slice(0, -1) : word;
}
