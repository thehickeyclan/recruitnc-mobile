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
  onPickWinner: (boutNumber: number, competitorId: string) => void
}

function Slot({
  slot,
  won,
  onPress,
  isTop,
  height,
}: {
  slot: BracketSlotDisplay
  won: boolean
  onPress: (() => void) | null
  isTop: boolean
  height: number
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress ?? undefined}
      style={[styles.slot, { height }, isTop && styles.slotDivider, won && styles.slotWon]}
    >
      <View style={[styles.seedBadge, slot.seed == null && styles.seedBadgeEmpty]}>
        <Text style={styles.seedText}>{slot.seed ?? "–"}</Text>
      </View>

      <View style={styles.slotBody}>
        <Text style={[styles.slotName, slot.isOpen && styles.slotOpen, won && styles.slotNameWon]} numberOfLines={1}>
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
  onPickWinner,
}: {
  match: BracketLayoutMatch
  layout: BracketLayout
  winnerId: string | null
  onPickWinner: Props["onPickWinner"]
}) {
  const bout = match.boutNumber
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
        slot={match.top}
        isTop
        height={slotHeight}
        won={winnerId != null && winnerId === match.top.competitorId}
        onPress={pressFor(match.top)}
      />
      <Slot
        slot={match.bottom}
        isTop={false}
        height={slotHeight}
        won={winnerId != null && winnerId === match.bottom.competitorId}
        onPress={pressFor(match.bottom)}
      />
    </View>
  )
}

export function BracketCanvas({ layout, winners, onPickWinner }: Props) {
  // Room for the round labels above the first card.
  const labelBand = 26

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.hPad}>
      <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.vPad}>
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
                onPickWinner={onPickWinner}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  hPad: { paddingHorizontal: space.lg },
  vPad: { paddingBottom: space.xl },

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
  slotOpen: { color: colors.textMuted, fontStyle: "italic" },
  slotSub: { ...type.caption, color: colors.textMuted, fontSize: 9 },
  slotSubWon: { color: colors.textSecondary },

  photo: { width: 26, height: 26, borderRadius: 4, backgroundColor: colors.raised },
})
