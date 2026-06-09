import type { UsecaseShowResponse } from "@vooster/contracts";

export type StructuralCheckId =
  | "extensions"
  | "level"
  | "primary_actor"
  | "stakeholders";

export type StructuralCheck = {
  detail: string;
  id: StructuralCheckId;
  status: "missing" | "present";
};

export function runStructuralChecks(body: UsecaseShowResponse): StructuralCheck[] {
  return [
    primaryActorCheck(body),
    levelCheck(body),
    stakeholdersCheck(body),
    extensionsCheck(body)
  ];
}

function primaryActorCheck(body: UsecaseShowResponse): StructuralCheck {
  const name = body.primary_actor?.name.trim();
  return name === undefined || name === ""
    ? {
        detail: "Primary actor is missing.",
        id: "primary_actor",
        status: "missing"
      }
    : { detail: name, id: "primary_actor", status: "present" };
}

function levelCheck(body: UsecaseShowResponse): StructuralCheck {
  const level = body.usecase.level?.trim();
  return level === undefined || level === ""
    ? { detail: "Cockburn level is missing.", id: "level", status: "missing" }
    : { detail: level, id: "level", status: "present" };
}

function stakeholdersCheck(body: UsecaseShowResponse): StructuralCheck {
  const count = body.stakeholder_interests?.length ?? 0;
  return count === 0
    ? {
        detail: "No stakeholder interests are attached.",
        id: "stakeholders",
        status: "missing"
      }
    : {
        detail: `${String(count)} stakeholder ${count === 1 ? "interest" : "interests"}`,
        id: "stakeholders",
        status: "present"
      };
}

function extensionsCheck(body: UsecaseShowResponse): StructuralCheck {
  const count =
    body.scenarios?.filter((scenario) => scenario.type !== "MAIN_SUCCESS").length ?? 0;
  return count === 0
    ? {
        detail: "No extension or alternate scenarios are attached.",
        id: "extensions",
        status: "missing"
      }
    : {
        detail: `${String(count)} extension ${count === 1 ? "scenario" : "scenarios"}`,
        id: "extensions",
        status: "present"
      };
}
