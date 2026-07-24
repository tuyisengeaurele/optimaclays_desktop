export const IDLE_LIMIT_MS = 30 * 60 * 1000;
export const IDLE_CHECK_INTERVAL_MS = 15 * 1000;

export function hasBeenIdleTooLong(lastActivity: number, now: number, limitMs: number = IDLE_LIMIT_MS): boolean {
  return now - lastActivity >= limitMs;
}
