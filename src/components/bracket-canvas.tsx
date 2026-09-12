import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { colors, radius, space, type } from "@/theme/tokens"
import {
  connectorSegments,
  type BracketLayout,
  type BracketLayoutMatch,
  type BracketSlotDisplay,
} from "@/lib/toc-bracket"

/**
 * The bracket, drawn the way the website draws it — round columns, bout cards, elbows between
 * them — on a canvas you scroll in both directions.
 *
 * Positions come from the server, which runs the same `layoutBracketTree` the desktop page
 * uses, so this is one layout engine rendered twice rather than two that drift. Connectors are
 * plain Views: the paths are always `M x y H x V y H x`, three straight legs, so nothing here
 * needs an SVG dependency.
 */

type Props = {
  layout: BracketLayout
  /** Bout number → the athlete picked to win it. */
  winners: Record<number, string | null>
  /**
   * Bout number → who is actually in it once the picks are applied.
   *
   * The layout is computed once, from a draw with no picks, so its own slots still say
   * "Winner of 1" forever. Advancing someone has to change what the next round reads, and
   * that resolution happens in the app — so it arrives here rather than in the geometry.
   */
  resolved?: Record<number, { top: BracketSlotDisplay; bottom: BracketSlotDisplay }>
  /**
   * Bout number → how the pick on that bout is holding up against the real result.
   *
   * Only ever set on somebody's own TOC Madness bracket. The official bracket has no verdicts:
   * there is nothing to be right or wrong about, so its winners stay gold.
   */
  verdicts?: Record<number, "correct" | "wrong" | "dead" | "pending">
  onPickWinner: (boutNumber: number, competitorId: string) => void
  /**
   * False lays the canvas out at its full natural width with no ScrollView around it.
   *
   * That is what makes the bracket shareable. A ScrollView clips to its viewport, and
   * `captureRef` captures what is drawn — so a screenshot of a scrolling canvas is a picture of
   * whatever happened to be scrolled into view, not of the bracket. The share card renders an
   * unscrolled copy off-screen and captures that instead.
   */
  scroll?: boolean
}

function Slot({
  slot,
  won,
  verdict,
  onPress,
  isTop,
  height,
}: {
  slot: BracketSlotDisplay
  won: boolean
  verdict?: "correct" | "wrong" | "dead" | "pending"
  onPress: (() => void) | null
  isTop: boolean
  height: number
}) {
  // Gold means "this is who you picked". Green, red and grey answer the next question — whether
  // the tournament agreed — and only ever appear on the slot that was picked.
  const judged = won ? verdict : undefined
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress ?? undefined}
      style={[
        styles.slot,
        { height },
        isTop && styles.slotDivider,
        won && styles.slotWon,
        judged === "correct" && styles.slotCorrect,
        judged === "wrong" && styles.slotWrong,
        judged === "dead" && styles.slotDead,
      ]}
    >
      <View style={[styles.seedBadge, slot.seed == null && styles.seedBadgeEmpty]}>
        <Text style={styles.seedText}>{slot.seed ?? "–"}</Text>
      </View>

      <View style={styles.slotBody}>
        <Text
          style={[
            styles.slotName,
            slot.isOpen && styles.slotOpen,
            won && styles.slotNameWon,
            judged === "correct" && styles.slotNameCorrect,
            judged === "wrong" && styles.slotNameWrong,
            judged === "dead" && styles.slotNameDead,
          ]}
          numberOfLines={1}
        >
          {slot.name}
        </Text>
        {slot.subtitle ? (
          <Text style={[styles.slotSub, won && styles.slotSubWon]} numberOfLines={1}>
            {slot.subtitle}
          </Text>
        ) : null}
      </View>

      {slot.photoUrl ? <Image source={{ uri: slot.photoUrl }} style={styles.photo} /> : null}
    </Pressable>
  )
}

function MatchCard({
  match,
  layout,
  winnerId,
  verdict,
  resolved,
  onPickWinner,
}: {
  match: BracketLayoutMatch
  layout: BracketLayout
  winnerId: string | null
  verdict?: "correct" | "wrong" | "dead" | "pending"
  resolved?: { top: BracketSlotDisplay; bottom: BracketSlotDisplay }
  onPickWinner: Props["onPickWinner"]
}) {
  const bout = match.boutNumber
  const top = resolved?.top ?? match.top
  const bottom = resolved?.bottom ?? match.bottom
  const slotHeight = layout.slotHeight

  const pressFor = (slot: BracketSlotDisplay) =>
    bout != null && slot.competitorId && !slot.isOpen
      ? () => onPickWinner(bout, slot.competitorId as string)
      : null

  return (
    <View style={[styles.match, { left: match.x, top: match.y, width: match.width }]}>
      {layout.boutHeaderHeight > 0 && bout != null ? (
        <View style={[styles.boutHeader, { height: layout.boutHeaderHeight }]}>
          <Text style={styles.boutHeaderText}>BOUT {bout}</Text>
        </View>
      ) : null}
      <Slot
        slot={top}
        isTop
        height={slotHeight}
        won={winnerId != null && winnerId === top.competitorId}
        verdict={verdict}
        onPress={pressFor(top)}
      />
      <Slot
        slot={bottom}
        isTop={false}
        height={slotHeight}
        won={winnerId != null && winnerId === bottom.competitorId}
        verdict={verdict}
        onPress={pressFor(bottom)}
      />
    </View>
  )
}

export function BracketCanvas({ layout, winners, resolved, verdicts, onPickWinner, scroll = true }: Props) {
  // Room for the round labels above the first card.
  const labelBand = 26

  const content = (
      <View style={{ width: layout.width, height: layout.height + labelBand }}>
          {layout.roundLabels.map((r) => (
            <Text key={r.roundIndex} style={[styles.roundLabel, { left: r.x, width: layout.matchWidth }]}>
              {r.label.toUpperCase()}
            </Text>
          ))}

          <View style={{ position: "absolute", top: labelBand, left: 0, right: 0, bottom: 0 }}>
            {layout.connectors.flatMap((c) =>
              connectorSegments(c.path).map((seg, i) => (
                <View
                  key={`${c.id}-${i}`}
                  style={[styles.connector, { left: seg.left, top: seg.top, width: seg.width, height: seg.height }]}
                />
              )),
            )}

            {layout.matches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                layout={layout}
                winnerId={m.boutNumber != null ? (winners[m.boutNumber] ?? null) : null}
                verdict={m.boutNumber != null ? verdicts?.[m.boutNumber] : undefined}
                resolved={m.boutNumber != null ? resolved?.[m.boutNumber] : undefined}
                onPickWinner={onPickWinner}
              />
            ))}
          </View>
      </View>
  )

  // Horizontal only. A vertical ScrollView here would sit inside the page's own vertical
  // ScrollView and the two fight for the gesture — the bracket ate every upward swipe, so the
  // consolation section below it could not be reached at all. The canvas lays out at its full
  // height instead and lets the page do the vertical scrolling.
  if (!scroll) return <View style={styles.hPad}>{content}</View>

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.hPad}>
      {content}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  hPad: { paddingHorizontal: space.lg },

  roundLabel: {
    position: "absolute",
    top: 0,
    ...type.caption,
    color: colors.textMuted,
    textAlign: "center",
  },

  connector: { position: "absolute", backgroundColor: colors.line },

  match: {
    position: "absolute",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  boutHeader: {
    justifyContent: "center",
    paddingHorizontal: space.sm,
    backgroundColor: colors.raised,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  boutHeaderText: { ...type.caption, color: colors.textMuted, fontSize: 9 },

  slot: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.sm },
  slotDivider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  slotWon: { backgroundColor: "rgba(211, 181, 116, 0.16)" },
  // Right, wrong, and gone. Tinted rather than block-filled so the name stays the loudest thing
  // on the card, and a colour-blind reader still has the gold "this was my pick" cue underneath.
  slotCorrect: { backgroundColor: "rgba(52, 199, 89, 0.18)" },
  slotWrong: { backgroundColor: "rgba(211, 47, 47, 0.16)" },
  slotDead: { backgroundColor: "rgba(255, 255, 255, 0.04)", opacity: 0.55 },

  seedBadge: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: colors.red,
    alignItems: "center",
    justifyContent: "center",
  },
  seedBadgeEmpty: { backgroundColor: colors.line },
  seedText: { ...type.caption, color: colors.text, fontSize: 10, fontWeight: "700" },

  slotBody: { flex: 1 },
  slotName: { ...type.label, color: colors.text },
  slotNameWon: { color: colors.gold, fontWeight: "700" },
  slotNameCorrect: { color: "#34C759", fontWeight: "700" },
  slotNameWrong: { color: "#FF6B6B", fontWeight: "700", textDecorationLine: "line-through" },
  slotNameDead: { color: colors.textMuted, fontWeight: "600", textDecorationLine: "line-through" },
  slotOpen: { color: colors.textMuted, fontStyle: "italic" },
  slotSub: { ...type.caption, color: colors.textMuted, fontSize: 9 },
  slotSubWon: { color: colors.textSecondary },

  photo: { width: 26, height: 26, borderRadius: 4, backgroundColor: colors.raised },
})
