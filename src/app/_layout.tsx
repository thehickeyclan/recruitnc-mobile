import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import * as SplashScreen from "expo-splash-screen"
import { colors } from "@/theme/tokens"

SplashScreen.preventAutoHideAsync()
SplashScreen.hideAsync()

export default function RootLayout() {
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
      </Stack>
    </>
  )
}
