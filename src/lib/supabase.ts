import "react-native-url-polyfill/auto"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Platform } from "react-native"
import { createClient } from "@supabase/supabase-js"

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY")
}

/**
 * Anon-key client. The service-role key must never reach the app bundle — anything needing
 * elevated rights (payments, Blue signup, waivers) goes through the web app's API routes,
 * which carry the billing guardrails.
 */
/**
 * Session storage is native-only. app.json sets web.output "static", so Expo also renders this
 * module in Node, where AsyncStorage's web path reaches for `window` and throws — which kills the
 * dev server outright rather than failing gracefully. The app has no sign-in yet, so there is no
 * session worth persisting on web anyway.
 */
const isNative = Platform.OS !== "web"

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: isNative ? AsyncStorage : undefined,
    autoRefreshToken: isNative,
    persistSession: isNative,
    detectSessionInUrl: false,
  },
})
