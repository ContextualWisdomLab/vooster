export type StoredStep = {
  id: string;
  scenario_id: string;
  step_number: number;
  actor_id: string;
  action: string;
  implements: string[];
  invokes: string[];
  is_system_step: boolean;
  notes: null | string;
  order_index: number;
};
