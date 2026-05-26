const INCLUDES_ANNOTATION = /\s*_\(\s*includes\s*:\s*([^)]+?)\s*\)_\s*$/i;

export type ParsedStepAction = {
  action: string;
  invokes: string[];
};

export function parseStepAction(raw: string): ParsedStepAction {
  const match = raw.match(INCLUDES_ANNOTATION);
  if (match === null) {
    return { action: raw, invokes: [] };
  }

  return {
    action: raw.slice(0, match.index).trimEnd(),
    invokes:
      match[1]
        ?.split(",")
        .map((key) => key.trim())
        .filter(Boolean) ?? []
  };
}

export function invocationAnnotation(invokes: string[]): string {
  return invokes.length === 0 ? "" : ` _(includes: ${invokes.join(", ")})_`;
}
