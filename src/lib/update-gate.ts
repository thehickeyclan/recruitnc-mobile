/**
 * Whether a launch should wait for a newer bundle before showing anything.
 *
 * Kept apart from the hook that uses it so it can be tested: importing expo-updates drags a
 * native module into the test runner, and this is the part with a decision in it.
 */
export function shouldWaitForUpdate(state: {
  isEnabled: boolean
  isEmbeddedLaunch: boolean
  isDevelopment: boolean
}): boolean {
  // Nothing to fetch against a dev server, and no updates configured means no updates.
  if (state.isDevelopment) return false
  if (!state.isEnabled) return false
  // Only the launch running the bundle baked into the binary. Once an update has been applied,
  // later launches start from that and there is nothing to wait for.
  return state.isEmbeddedLaunch
}
