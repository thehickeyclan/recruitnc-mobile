/**
 * The web address that opens `path` signed in as the app's account.
 *
 * The token rides in the fragment, never the query string: a fragment is not sent to the server,
 * so a sign-in token cannot end up in anybody's request log. The page reads it, wipes it from
 * the address bar, and moves on to `path`.
 *
 * Kept free of react-native imports so it can be tested.
 */
export function handoffUrl(base: string, path: string, tokenHash: string, userId: string): string {
  const fragment = new URLSearchParams({ t: tokenHash, u: userId, next: path })
  return `${base.replace(/\/$/, "")}/auth/app-handoff#${fragment.toString()}`
}
