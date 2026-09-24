export type InstagramApiError = {
  name: "InstagramApiError";
  message: string;
  status: number;
  details?: unknown;
};

export function createInstagramApiError(
  message: string,
  status: number,
  details?: unknown,
): InstagramApiError {
  return {
    name: "InstagramApiError",
    message,
    status,
    details,
  };
}
