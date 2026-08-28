import { Image, Pressable, StyleSheet, Text, View } from "react-native"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { countdownLine, daysUntil, SEEDS_ANNOUNCED } from "@/lib/toc-countdown"

/**
 * The tournament, as the top card on Home.
 *
 * Says the whole pitch in the space of a card — what it is, when it turns real, and one way in —
 * then hands off to the hub for everything else. The full three-step version lives there.
 */
export function TocMadnessCard({
  announced,
  total,
  onOpenToc,
  onStartBracket,
}: {
  announced: number
  total: number
  onOpenToc: () => void
  onStartBracket: () => void
}) {
  const seedsOut = daysUntil(SEEDS_ANNOUNCED) <= 0

  return (
    <View style={styles.card}>
      <Pressable style={styles.head} onPress={onOpenToc}>
        <Image
          source={require("../../assets/images/toc-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>SEPTEMBER 18–19 · APEX</Text>
          <Text style={styles.headline}>TOC Madness</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.gold} />
      </Pressable>

      <Text style={styles.lede}>
        Seed every weight the way you see it and run the draw. {countdownLine(daysUntil(SEEDS_ANNOUNCED))}
      </Text>

      <Pressable style={styles.cta} onPress={onStartBracket}>
        <Ionicons name="git-branch" size={16} color={colors.ink} />
        <Text style={styles.ctaText}>{seedsOut ? "Submit your bracket" : "Start your bracket"}</Text>
      </Pressable>

      <Pressable
        onPress={() =>
          void import("expo-web-browser").then((wb) =>
            wb.openBrowserAsync("https://gofan.co/event/6745154?schoolId=NC101846", {
              presentationStyle: wb.WebBrowserPresentationStyle.PAGE_SHEET,
              toolbarColor: colors.ink,
              controlsColor: colors.gold,
              dismissButtonStyle: "done",
            }),
          )
        }
        hitSlop={6}
      >
        <Text style={styles.tickets}>Buy tickets for 18–19 September</Text>
      </Pressable>

      {total > 0 ? (
        <Pressable onPress={onOpenToc} hitSlop={6}>
          <Text style={styles.fine}>
            {announced === total
              ? "Every weight class announced — see the field"
              : `${announced} of ${total} weight classes announced — see the field`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  logo: { width: 46, height: 46 },
  eyebrow: { ...type.caption, color: colors.gold },
  headline: { ...type.title, color: colors.text, marginTop: 2 },
  lede: { ...type.body, color: colors.textSecondary, lineHeight: 21 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    padding: space.md,
  },
  ctaText: { ...type.label, color: colors.ink, fontWeight: "800" },
  tickets: {
    ...type.label,
    color: colors.gold,
    textAlign: "center",
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  fine: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: "center",
    fontWeight: "600",
    letterSpacing: 0.2,
  },
})
