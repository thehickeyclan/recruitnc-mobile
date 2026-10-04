import { useEffect } from "react"
import { View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { colors } from "@/theme/tokens"
import { openWebPage } from "@/lib/profile-link"

/**
 * /news/<slug> — where every news alert points.
 *
 * Articles live on the website, so this screen only opens the article in the web sheet and steps
 * back to home underneath it. It exists as a real route so an alert tap can never land on
 * "Unmatched Route", whichever tap handler a phone is running (the Journeymen recap alert did,
 * on phones still on the bundle from before the handler learned about news).
 */
export default function NewsArticleRoute() {
  const { slug } = useLocalSearchParams<{ slug?: string }>()

  useEffect(() => {
    const safe = typeof slug === "string" && /^[a-z0-9-]+$/i.test(slug) ? slug : null
    openWebPage(safe ? `/news/${safe}` : "/news")
    router.replace("/")
  }, [slug])

  return <View style={{ flex: 1, backgroundColor: colors.ink }} />
}
