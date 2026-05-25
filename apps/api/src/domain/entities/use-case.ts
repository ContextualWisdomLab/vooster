export type StoredUseCase = {
  id: string;
  project_id: string;
  key: string;
  title: string;
  level: "SUMMARY" | "USER_GOAL" | "SUBFUNCTION";
  format: "BRIEF";
  scope: string;
  primary_actor_id: string;
  priority: "P0" | "P1" | "P2" | "P3";
  status: "APPROVED" | "DEPRECATED" | "DRAFT" | "IN_REVIEW";
  current_revision_id: string;
  archived_at: null | string;
};
