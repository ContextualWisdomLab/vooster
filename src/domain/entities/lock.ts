export type StoredLock = {
  acquired_at?: string; auto_release?: boolean; expires_at: string;
  held_by_session_id?: null | string; held_by_user_id?: string;
  holder: string; id?: string; lock_type?: "HARD" | "SEMANTIC" | "SOFT";
  mode: "HARD" | "SEMANTIC" | "SOFT"; reason: string;
  target_id?: string; target_type?: "USECASE"; usecase_id: string;
};
