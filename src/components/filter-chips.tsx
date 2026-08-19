import { Pressable, ScrollView, StyleSheet, Text } from "react-native"
import { colors, radius, space, type } from "@/theme/tokens"

export type Chip = { key: string; label: string; count?: number }

/** Shared filter strip. The fixed height is deliberate — a horizontal ScrollView
 *  collapses below its content box and clips the chips without it. */
export function FilterChips({
  chips,
  activeKey,
  onChange,
}: {
  chips: Chip[]
  activeKey: string
  onChange: (key: string) => void
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.strip}
      contentContainerStyle={styles.content}
    >
      {chips.map((chip) => {
        const active = chip.key === activeKey
        return (
          <Pressable
            key={chip.key}
            onPress={() => onChange(chip.key)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{chip.label}</Text>
            {chip.count != null ? (
              <Text style={[styles.count, active && styles.countActive]}>{chip.count}</Text>
            ) : null}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  strip: { flexGrow: 0, height: 46, marginBottom: space.md },
  content: { paddingHorizontal: space.lg, gap: space.sm, alignItems: "center" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  label: { ...type.label, color: colors.textSecondary },
  labelActive: { color: colors.ink },
  count: { ...type.caption, color: colors.textMuted },
  countActive: { color: colors.ink },
})
