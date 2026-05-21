export const FORMAT_VERSION = 1;

export type AgentEnvelope<TData> = {
  data: TData;
  context: {
    project_key: string | null;
    branch: string | null;
    session_id: string | null;
    revision: string | null;
  };
  suggested_next_actions: Array<{ command: string; reason?: string }>;
  warnings: Array<{ message: string }>;
  format_version: 1;
};

export function buildAgentEnvelope<TData>(input: {
  data: TData;
  context?: Partial<AgentEnvelope<TData>["context"]>;
  suggested_next_actions?: AgentEnvelope<TData>["suggested_next_actions"];
  warnings?: AgentEnvelope<TData>["warnings"];
}): AgentEnvelope<TData> {
  return {
    data: input.data,
    context: {
      project_key: input.context?.project_key ?? null,
      branch: input.context?.branch ?? null,
      session_id: input.context?.session_id ?? null,
      revision: input.context?.revision ?? null
    },
    suggested_next_actions: input.suggested_next_actions ?? [],
    warnings: input.warnings ?? [],
    format_version: FORMAT_VERSION
  };
}
