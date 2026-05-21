export type StoredScenario = {
  id: string;
  usecase_id: string;
  type: "EXTENSION" | "MAIN_SUCCESS";
  extension_point: null | string;
  parent_step_number: null | number;
  condition: null | string;
  outcome: "FAILURE" | "PARTIAL" | "SUCCESS";
  order_index: number;
};
