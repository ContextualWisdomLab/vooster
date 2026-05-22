export class ApiError extends Error {
  public readonly status: number;
  public readonly body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `API request failed with ${String(status)}.`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
