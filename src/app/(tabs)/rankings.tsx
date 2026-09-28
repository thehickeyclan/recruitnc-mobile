import { useCallback, useState } from "react"
import { Linking, Pressable, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import * as WebBrowser from "expo-web-browser"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"

/**
 * Rankings open on the web, for now.
 *
 * This tab used to read the `public_rankings` table straight from Supabase with the anon key,
 * which is bundled into the app. That was fine while the rankings were free; they are not any
 * more. The web gates them behind NC United Blue membership, coach verification or a RecruitNC
 * subscription, and a phone reading the table directly walked past all of it — the anon key is
 * in every copy of the app, so "only the app can read it" was never true either.
 *
 * Two other things were wrong with the table and argue against going back to it: nothing syncs
 * it to what the web publishes, so it was six weeks stale, and it held 83 rows for a class
 * published as a top 30.
 *
 * Handing the browser the real page fixes all of it at once, ships as an over-the-air update
 * with no review cycle, and means the entitlement logic lives in exactly one place. A proper
 * in-app board comes later, reading an endpoint that checks the session.
 */

const WEB_BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://app.ncwrestlingunited.com"
// /public-rankings, not /rankings: the hub sends a member straight to the boards and anyone
// without access back to the sales page on its own, so one link is right for every viewer.
const RANKINGS_URL = `${WEB_BASE}/public-rankings`

export default function RankingsScreen() {
  const [opening, setOpening] = useState(false)
  const [failed, setFailed] = useState(false)

  const open = useCallback(async () => {
    setOpening(true)
    setFailed(false)

    /*
     * The spinner must not wait on the promise.
     *
     * `openBrowserAsync` resolves when the browser is *dismissed*, not when it opens, so
     * awaiting it left the button reading "Opening…" for as long as somebody was reading the
     * rankings - and for ever if the browser never presented at all. That is what "clicking
     * rankings hangs" was: no timeout, no fallback, no error, just a tab frozen on a spinner.
     *
     * So the label clears on its own shortly after the call, and failure falls through to the
     * system browser rather than dying silently.
     */
    const clearLabel = setTimeout(() => setOpening(false), 1500)

    try {
      // In-app browser rather than Safari: the session cookie a Blue member already has on the
      // web comes with them, so they land on the rankings instead of a sign-in wall.
      await WebBrowser.openBrowserAsync(RANKINGS_URL, {
        toolbarColor: colors.ink,
        controlsColor: colors.gold,
      })
    } catch {
      // Safari as the fallback. It loses the cookie, so a member may have to sign in again -
      // which is worse than the in-app browser and far better than a button that does nothing.
      try {
        await Linking.openURL(RANKINGS_URL)
      } catch {
        setFailed(true)
      }
    } finally {
      clearTimeout(clearLabel)
      setOpening(false)
    }
  }, [])

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.body}>
        <View style={styles.badge}>
          <Ionicons name="trophy-outline" size={28} color={colors.gold} />
        </View>

        <Text style={styles.title}>RecruitNC Rankings</Text>
        <Text style={styles.lede}>
          Class of 2027, 2028 and 2029, plus the Top 75 college prospects across every class.
        </Text>

        <View style={styles.card}>
          {[
            "Every match scored, weighted to this season",
            "NHSCA, Super 32, Fargo and Journeymen",
            "Head-to-head settles a tie",
            "Every win graded by who it was over",
          ].map((line) => (
            <View key={line} style={styles.row}>
              <Ionicons name="checkmark" size={16} color={colors.gold} style={styles.check} />
              <Text style={styles.rowText}>{line}</Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={open}
          disabled={opening}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed, opening && styles.ctaDisabled]}
        >
          <Text style={styles.ctaText}>{opening ? "Opening…" : "Open rankings"}</Text>
          <Ionicons name="open-outline" size={18} color={colors.ink} />
        </Pressable>

        {failed ? (
          /* Never a dead end: if neither browser will open, the address is on screen to type. */
          <Text style={styles.note}>
            Could not open the browser. Go to app.ncwrestlingunited.com/public-rankings
          </Text>
        ) : null}

        <Text style={styles.note}>
          Free for NC United Blue members and verified college coaches.
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xl },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: space.lg,
  },
  title: { ...type.title, color: colors.text, textAlign: "center" },
  lede: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: space.sm,
    marginBottom: space.xl,
  },
  card: {
    alignSelf: "stretch",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    gap: space.md,
  },
  row: { flexDirection: "row", alignItems: "flex-start" },
  check: { marginRight: space.sm, marginTop: 2 },
  rowText: { ...type.body, color: colors.textSecondary, flex: 1 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    alignSelf: "stretch",
    backgroundColor: colors.gold,
    borderRadius: radius.lg,
    paddingVertical: space.lg,
    marginTop: space.xl,
  },
  ctaPressed: { backgroundColor: colors.goldHover },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { ...type.body, color: colors.ink, fontWeight: "700" },
  note: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: space.lg,
  },
})
