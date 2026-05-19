export type StoredComment = {
  author_id: string;
  body: string;
  created_at: string;
  id: string;
  resolved: boolean;
  resolved_at: null | string;
  target_id: string;
  target_type: "USECASE";
  updated_at: null | string;
};
