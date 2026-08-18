import { StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, space, type } from "@/theme/tokens"

export function PlaceholderScreen({
  title,
  icon,
  note,
}: {
  title: string
  icon: keyof typeof Ionicons.glyphMap
  note: string
}) {
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>NC UNITED</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.center}>
        <Ionicons name={icon} size={40} color={colors.line} />
        <Text style={styles.note}>{note}</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.lg },
  eyebrow: { ...type.caption, color: colors.gold, marginBottom: space.xs },
  title: { ...type.display, color: colors.text },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, paddingBottom: 80 },
  note: { ...type.body, color: colors.textMuted },
})
