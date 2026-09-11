import { useEffect, useRef } from "react"
import { Stack, router, useRootNavigationState } from "expo-router"
import * as Notifications from "expo-notifications"
import { notificationPath } from "@/lib/notification-path"
import { StatusBar } from "expo-status-bar"
import * as SplashScreen from "expo-splash-screen"
import { colors } from "@/theme/tokens"
import { useFirstLaunchUpdate } from "@/lib/first-launch-update"

void SplashScreen.preventAutoHideAsync()

/**
 * Tapping an alert opens what it is about.
 *
 * Nothing handled a tap before this. Every alert the server sends carries a `path` — the bracket
 * release sends "/toc-bracket" — and every one was ignored, so "Brackets are live, tap to see the
 * draws" opened the app on whatever screen it was last left on. At five o'clock that is a parent
 * tapping through and landing on Commitments.
 *
 * `useLastNotificationResponse` covers both cases: a tap while the app is running, and the tap
 * that launched it cold. Navigation waits for the root navigator, because a push before it has
 * mounted is dropped, and each response is followed once so a re-render does not navigate again.
 */
function useNotificationTaps() {
  const response = Notifications.useLastNotificationResponse()
  const navigationReady = Boolean(useRootNavigationState()?.key)
  const handled = useRef<string | null>(null)

  useEffect(() => {
    if (!navigationReady || !response) return
    const id = response.notification.request.identifier
    if (handled.current === id) return
    handled.current = id
    const path = notificationPath(response.notification.request.content.data)
    if (path) router.push(path as never)
  }, [navigationReady, response])
}

export default function RootLayout() {
  // On the first launch after an install the splash stays up while the newer bundle is fetched,
  // so a new download does not open on whatever was current on build day. Every other launch
  // resolves immediately.
  const ready = useFirstLaunchUpdate()
  useNotificationTaps()

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync()
  }, [ready])

  // The navigator always renders. An earlier version returned null until the update resolved,
  // which leaves expo-router without a root layout — and anything arriving in that window, a deep
  // link or a notification tap, navigates before it is mounted. The splash covers the wait
  // instead, which is what a splash is for.

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.ink },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="ask" options={{ presentation: "modal" }} />
        <Stack.Screen name="toc-field" options={{ presentation: "modal" }} />
        <Stack.Screen name="clubs" options={{ presentation: "modal" }} />
        <Stack.Screen name="blue-subscription" options={{ presentation: "modal" }} />
        <Stack.Screen name="toc-bracket" options={{ presentation: "modal" }} />
        <Stack.Screen name="sign-in" options={{ presentation: "modal" }} />
      </Stack>
    </>
  )
}
