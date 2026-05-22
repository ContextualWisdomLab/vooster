const KEY_PATTERN = /^[A-Z][A-Z0-9]{1,7}$/;

export function isValidProjectKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

export function inferProjectKey(name: string): string {
  const upper = name.toUpperCase();
  const sanitized = upper.replace(/[^A-Z0-9]/g, "");
  const withLetterFirst = sanitized.replace(/^[^A-Z]+/, "");
  const trimmed = withLetterFirst.slice(0, 8);
  if (trimmed.length < 2) {
    return "";
  }
  return trimmed;
}
