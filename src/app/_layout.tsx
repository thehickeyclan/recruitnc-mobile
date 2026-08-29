import { useEffect } from "react"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import * as SplashScreen from "expo-splash-screen"
import { colors } from "@/theme/tokens"
import { useFirstLaunchUpdate } from "@/lib/first-launch-update"

void SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  // On the first launch after an install the splash stays up while the newer bundle is fetched,
  // so a new download does not open on whatever was current on build day. Every other launch
  // resolves immediately.
  const ready = useFirstLaunchUpdate()

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
        <Stack.Screen name="toc-bracket" options={{ presentation: "modal" }} />
        <Stack.Screen name="sign-in" options={{ presentation: "modal" }} />
      </Stack>
    </>
  )
}
