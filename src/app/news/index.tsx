import { useEffect } from "react"
import { View } from "react-native"
import { router } from "expo-router"
import { colors } from "@/theme/tokens"
import { openWebPage } from "@/lib/profile-link"

/** /news — the news page on the website, in the web sheet. See ./[slug].tsx. */
export default function NewsIndexRoute() {
  useEffect(() => {
    openWebPage("/news")
    router.replace("/")
  }, [])

  return <View style={{ flex: 1, backgroundColor: colors.ink }} />
}
