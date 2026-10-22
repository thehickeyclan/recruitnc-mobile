import { useEffect } from "react"
import { View } from "react-native"
import { router } from "expo-router"
import { colors } from "@/theme/tokens"
import { openWebPage } from "@/lib/profile-link"

/**
 * /questionnaires - the weekly interest-form reminder's tap. Opens the Command Center's Interest
 * forms page on the website, signed in, the same way /news does. Must ship in a bundle before the
 * first reminder goes out (a push path must already exist in the app phones run).
 */
export default function QuestionnairesRoute() {
  useEffect(() => {
    openWebPage("/my-recruiting/questionnaires")
    router.replace("/")
  }, [])

  return <View style={{ flex: 1, backgroundColor: colors.ink }} />
}
