const STEP_ANNOTATION = /\s*_\(\s*(includes|implements)\s*:\s*([^)]+?)\s*\)_\s*$/i;

export type ParsedStepAction = {
  action: string;
  implements: string[];
  invokes: string[];
};

export function parseStepAction(raw: string): ParsedStepAction {
  const parsed: ParsedStepAction = { action: raw, implements: [], invokes: [] };
  let match = parsed.action.match(STEP_ANNOTATION);

  while (match !== null) {
    const values = valuesFrom(match[2]);
    if ((match[1] ?? "").toLowerCase() === "implements") {
      parsed.implements = values;
    } else {
      parsed.invokes = values;
    }
    parsed.action = parsed.action.slice(0, match.index).trimEnd();
    match = parsed.action.match(STEP_ANNOTATION);
  }

  return parsed;
}

export function invocationAnnotation(invokes: string[]): string {
  return invokes.length === 0 ? "" : ` _(includes: ${invokes.join(", ")})_`;
}

export function implementsAnnotation(implementationRefs: string[] | undefined): string {
  return implementationRefs === undefined || implementationRefs.length === 0
    ? ""
    : ` _(implements: ${implementationRefs.join(", ")})_`;
}

export function serializeStepAction(parsed: ParsedStepAction): string {
  return `${parsed.action}${invocationAnnotation(parsed.invokes)}${implementsAnnotation(parsed.implements)}`;
}

function valuesFrom(raw: string | undefined): string[] {
  return (
    raw
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? []
  );
}
