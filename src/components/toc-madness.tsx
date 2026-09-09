import { Pressable, StyleSheet, Text, View } from "react-native"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { countdownLine, daysUntil, SEEDS_ANNOUNCED } from "@/lib/toc-countdown"

/**
 * The pitch that opens the app.
 *
 * The campaign tells people to download this to see the field and follow a bracket, and the hub
 * underneath is a list of destinations — accurate, but it never says why any of it is worth your
 * evening. This does: the brackets drop Friday, you pick the winners, you score as it wrestles.
 *
 * It used to open by inviting people to seed the weights themselves. That is gone: the seeding is
 * the tournament's, and the brackets built from anyone else's guesses were being screenshotted and
 * passed around as though they were the draw. What people bring now is picks, not seeds — so the
 * card promises picks.
 */

function Step({
  number,
  when,
  title,
  detail,
  live,
}: {
  number: string
  when: string
  title: string
  detail: string
  live?: boolean
}) {
  return (
    <View style={styles.step}>
      <View style={[styles.stepNumber, live && styles.stepNumberLive]}>
        <Text style={[styles.stepNumberText, live && styles.stepNumberTextLive]}>{number}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={[styles.stepWhen, live && styles.stepWhenLive]}>{when}</Text>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDetail}>{detail}</Text>
      </View>
    </View>
  )
}

export function TocMadness({ onStart }: { onStart: () => void }) {
  const days = daysUntil(SEEDS_ANNOUNCED)
  const seedsOut = days <= 0

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>THE BRACKET CHALLENGE</Text>
      <Text style={styles.headline}>Get ready for TOC Madness</Text>
      <Text style={styles.lede}>{countdownLine(days)}</Text>

      <View style={styles.steps}>
        <Step
          number="1"
          when={seedsOut ? "OUT NOW" : "FRIDAY, 5:00 PM"}
          title="The brackets drop"
          detail="Every weight, seeded by The NC Mat and released here in the app first."
          live={!seedsOut}
        />
        <Step
          number="2"
          when={seedsOut ? "OPEN NOW" : "STRAIGHT AFTER"}
          title="Pick your winners"
          detail="Call every bout at each weight, then score points as the tournament runs and watch the leaderboard."
          live={seedsOut}
        />
      </View>

      <Pressable style={styles.cta} onPress={onStart}>
        <Ionicons name="git-branch" size={16} color={colors.ink} />
        <Text style={styles.ctaText}>{seedsOut ? "Submit your bracket" : "Start your bracket"}</Text>
      </Pressable>
      <Text style={styles.fine}>One entry per weight, per account.</Text>
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
    gap: space.sm,
  },
  eyebrow: { ...type.caption, color: colors.gold },
  headline: { ...type.display, color: colors.text, marginTop: space.xs },
  lede: { ...type.body, color: colors.textSecondary },

  steps: { gap: space.md, marginTop: space.md, marginBottom: space.sm },
  step: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberLive: { backgroundColor: colors.gold, borderColor: colors.gold },
  stepNumberText: { ...type.label, color: colors.textMuted, fontWeight: "800" },
  stepNumberTextLive: { color: colors.ink },
  stepWhen: { ...type.caption, color: colors.textMuted },
  stepWhenLive: { color: colors.gold },
  stepTitle: { ...type.heading, color: colors.text, marginTop: 2 },
  stepDetail: { ...type.label, color: colors.textSecondary, fontWeight: "500", marginTop: 2, lineHeight: 18 },

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
  fine: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: "center",
    fontWeight: "600",
    letterSpacing: 0.2,
    lineHeight: 16,
  },
})
