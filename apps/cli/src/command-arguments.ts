/** Split one executable command into literal arguments without shell evaluation. */
export function commandArguments(command: string): string[] {
  const argumentsList: string[] = [];
  let current = "";
  let escaping = false;
  let quote: "'" | '"' | undefined;
  let started = false;

  for (const character of command) {
    if (escaping) {
      current += character;
      escaping = false;
      started = true;
    } else if (character === "\\" && quote !== "'") {
      escaping = true;
      started = true;
    } else if (quote !== undefined) {
      if (character === quote) quote = undefined;
      else current += character;
    } else if (character === "'" || character === '"') {
      quote = character;
      started = true;
    } else if (/\s/u.test(character)) {
      if (started) argumentsList.push(current);
      current = "";
      started = false;
    } else {
      current += character;
      started = true;
    }
  }

  if (escaping || quote !== undefined) {
    throw new Error("Invalid test command: unterminated quote or escape");
  }
  if (started) argumentsList.push(current);
  if (argumentsList.length === 0) throw new Error("Invalid empty test command");
  return argumentsList;
}
