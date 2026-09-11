import { Image, Pressable, StyleSheet, Text, View } from "react-native"
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

export function TocMadness({
  onStart,
  onSeeField,
  onRemindMe,
  alertsOn,
  busy,
}: {
  onStart: () => void
  onSeeField: () => void
  /** Turn on TOC alerts, so Friday at five arrives as a notification rather than a memory. */
  onRemindMe: () => void
  alertsOn: boolean
  busy?: boolean
}) {
  const days = daysUntil(SEEDS_ANNOUNCED)
  const seedsOut = days <= 0

  return (
    <View style={styles.card}>
      {/* The mark does the shouting; the words underneath just say when. */}
      <Image
        source={require("../../assets/images/toc-madness-logo.png")}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="TOC Madness"
      />
      <Text style={styles.lede}>{countdownLine(days)}</Text>

      <View style={styles.steps}>
        <Step
          number="1"
          when={seedsOut ? "OUT NOW" : "FRIDAY, 5:00 PM"}
          title="The brackets drop"
          // Not "all ten": weights are released as each draw is locked, and one may still be
          // waiting on a replacement wrestler at five o'clock. Promising ten is a promise the
          // release button cannot keep on its own.
          detail="Every weight, seeded by The NC Mat — in the app before anywhere else."
          live={!seedsOut}
        />
        <Step
          number="2"
          when={seedsOut ? "OPEN NOW" : "THE MOMENT THEY LAND"}
          title="Submit your bracket"
          detail="Call every bout at every weight. One entry each, and you can change your picks until entries lock."
          live={seedsOut}
        />
        <Step
          number="3"
          when="ALL WEEKEND"
          title="Climb the leaderboard"
          detail="Points land as the bouts do. Watch your bracket hold up, or fall apart, in real time."
        />
      </View>

      {/*
        Before Friday there is no bracket to open, so the button does the one thing worth doing
        now: makes sure five o'clock arrives as a notification. Somebody who has already turned
        alerts on gets sent to the field instead of a button that does nothing.
      */}
      {seedsOut ? (
        <Pressable style={styles.cta} onPress={onStart}>
          <Ionicons name="git-branch" size={16} color={colors.ink} />
          <Text style={styles.ctaText}>Submit your bracket</Text>
        </Pressable>
      ) : alertsOn ? (
        <Pressable style={styles.cta} onPress={onSeeField}>
          <Ionicons name="people" size={16} color={colors.ink} />
          <Text style={styles.ctaText}>See who&apos;s in</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.cta} onPress={onRemindMe} disabled={busy}>
          <Ionicons name="notifications" size={16} color={colors.ink} />
          <Text style={styles.ctaText}>{busy ? "Turning on…" : "Remind me Friday at 5:00"}</Text>
        </Pressable>
      )}
      <Text style={styles.fine}>
        {seedsOut ? "One entry per weight, per account." : "Free to enter. One entry per weight, per account."}
      </Text>
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
  /**
   * An explicit height, not an aspect ratio.
   *
   * `width: "100%"` with `aspectRatio` let the image size itself, and it rendered many times the
   * height of the card — the mark filled the entire screen with the steps and the button pushed
   * off the bottom. A fixed height with `contain` cannot do that: the image fits the box it is
   * given, whatever the source dimensions are.
   */
  logo: { width: "100%", height: 104, marginBottom: space.xs },
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
