export type StoredGoal = {
  id: string;
  project_id: string;
  actor_id: string;
  description: string;
  level: "SUMMARY" | "USER_GOAL" | "SUBFUNCTION";
  status: "IDENTIFIED" | "IN_DESIGN" | "PROMOTED" | "REJECTED";
  linked_usecase_id: null | string;
  priority: "P0" | "P1" | "P2" | "P3";
  archived_at: null | string;
};
