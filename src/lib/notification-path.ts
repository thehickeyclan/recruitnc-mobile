/**
 * Where an alert should take you, or null.
 *
 * Only an in-app path is followed. The server writes these, but a notification payload is still
 * outside input, and "tap to see the draws" must never become a way to open an arbitrary URL.
 */
export function notificationPath(data: unknown): string | null {
  const path = (data as { path?: unknown } | null | undefined)?.path
  if (typeof path !== "string") return null
  return /^\/[a-z0-9\-/]*$/i.test(path) ? path : null
}
