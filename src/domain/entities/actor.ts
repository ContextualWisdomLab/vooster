export type StoredActor = {
  id: string;
  project_id: string;
  name: string;
  type: "OFFSTAGE" | "PRIMARY" | "SUPPORTING";
  description: string;
  is_human: boolean;
  aliases: string[];
  archived_at: null | string;
};
