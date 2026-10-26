import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"

/**
 * The one-question-at-a-time screens: Create Profile and Report a Commitment. A big title, one
 * thing to answer, a gold button - a phone in a gym lobby gets through it in under a minute.
 */
export function Shell({
  children,
  onClose,
  onBack,
  progress,
}: {
  children: React.ReactNode
  onClose: () => void
  onBack?: () => void
  progress?: number
}) {
  return (
    <SafeAreaView style={wizardStyles.screen} edges={["top", "bottom"]}>
      <View style={wizardStyles.bar}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} style={wizardStyles.barButton}>
            <Ionicons name="chevron-back" size={22} color={colors.gold} />
          </Pressable>
        ) : (
          <View style={wizardStyles.barButton} />
        )}
        <View style={wizardStyles.track}>{progress != null ? <View style={[wizardStyles.fill, { width: `${Math.round(progress * 100)}%` }]} /> : null}</View>
        <Pressable onPress={onClose} hitSlop={12} style={wizardStyles.barButton} accessibilityLabel="Close">
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </Pressable>
      </View>
      <KeyboardAvoidingView style={wizardStyles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={wizardStyles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export function Question({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={wizardStyles.question}>
      <Text style={wizardStyles.title}>{title}</Text>
      {hint ? <Text style={wizardStyles.hint}>{hint}</Text> : null}
    </View>
  )
}

/** Equal-width rows; the last is padded with nulls so its buttons match the rest. */
export function rows<T>(items: readonly T[], size: number): (T | null)[][] {
  const out: (T | null)[][] = []
  for (let i = 0; i < items.length; i += size) {
    const row: (T | null)[] = items.slice(i, i + size)
    while (row.length < size) row.push(null)
    out.push(row)
  }
  return out
}

export function Field(props: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  autoFocus?: boolean
  keyboard?: "decimal-pad" | "number-pad" | "phone-pad" | "email-address" | "url"
  /** Names are capitalised; an email or a link must not be. */
  plain?: boolean
}) {
  return (
    <TextInput
      style={wizardStyles.input}
      value={props.value}
      onChangeText={props.onChange}
      placeholder={props.placeholder}
      placeholderTextColor={colors.textMuted}
      autoFocus={props.autoFocus}
      keyboardType={props.keyboard ?? "default"}
      textContentType={props.keyboard === "phone-pad" ? "telephoneNumber" : undefined}
      autoCapitalize={props.plain ? "none" : "words"}
      autoCorrect={false}
      returnKeyType="next"
    />
  )
}

export function Big({ label, icon, onPress }: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [wizardStyles.big, pressed && wizardStyles.pressed]} onPress={onPress}>
      {icon ? <Ionicons name={icon} size={20} color={colors.ink} /> : null}
      <Text style={wizardStyles.bigText}>{label}</Text>
    </Pressable>
  )
}

export function Next({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return (
    <Pressable style={[wizardStyles.big, disabled && wizardStyles.disabled]} disabled={disabled} onPress={onPress}>
      <Text style={wizardStyles.bigText}>Next</Text>
      <Ionicons name="arrow-forward" size={18} color={colors.ink} />
    </Pressable>
  )
}

export function Chip(props: { label: string; on: boolean; onPress: () => void; wide?: boolean; fill?: boolean; small?: boolean }) {
  const { label, on, onPress, wide, fill, small } = props
  return (
    <Pressable style={[wizardStyles.chip, wide && wizardStyles.chipWide, fill && wizardStyles.flex, on && wizardStyles.chipOn]} onPress={onPress}>
      <Text style={[wizardStyles.chipText, small && wizardStyles.chipSmall, on && wizardStyles.chipTextOn]} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
    </Pressable>
  )
}

export const wizardStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  flex: { flex: 1 },
  bar: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  barButton: { width: 28, alignItems: "center" },
  track: { flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: colors.surface, overflow: "hidden" },
  fill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.gold },
  content: { padding: space.xl, gap: space.md, paddingBottom: space.xxl * 2 },
  question: { gap: space.sm, marginBottom: space.sm, marginTop: space.lg },
  title: { ...type.title, fontSize: 26, color: colors.text },
  hint: { ...type.body, color: colors.textSecondary, fontWeight: "400", lineHeight: 21 },
  input: {
    ...type.body,
    fontSize: 18,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space.lg,
    paddingVertical: 16,
  },
  big: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 18,
    marginTop: space.sm,
  },
  bigText: { ...type.heading, color: colors.ink, fontWeight: "800" },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.35 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  row: { flexDirection: "row", gap: space.sm },
  ghost: { opacity: 0 },
  chip: {
    minWidth: 72,
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipWide: { width: "100%" },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { ...type.heading, color: colors.text },
  chipTextOn: { color: colors.ink },
  chipSmall: { fontSize: 15, fontWeight: "700" },
  skip: { ...type.label, color: colors.gold, textAlign: "center", marginTop: space.md },
  error: { ...type.label, color: colors.red, fontWeight: "600" },
  centre: { alignItems: "center", gap: space.md, marginTop: space.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space.lg, gap: 4 },
  cardName: { ...type.title, color: colors.text },
})
