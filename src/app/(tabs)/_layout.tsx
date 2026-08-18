import { View, Pressable, Text, StyleSheet } from "react-native"
import { Tabs, router } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors } from "@/theme/tokens"

export default function TabsLayout() {
  return (
    <View style={styles.root}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        sceneStyle: { backgroundColor: colors.ink },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Commits",
          tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="rankings"
        options={{
          title: "Rankings",
          tabBarIcon: ({ color, size }) => <Ionicons name="podium" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal" size={size} color={color} />,
        }}
      />
    </Tabs>

      {/* Floating Data Dawg launcher — mirrors the website, and keeps the tab bar to five slots. */}
      <Pressable style={styles.fab} onPress={() => router.push("/ask")} accessibilityLabel="Ask Data Dawg">
        <Ionicons name="paw" size={18} color={colors.ink} />
        <Text style={styles.fabText}>Data Dawg</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 96,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.gold,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: { fontSize: 13, fontWeight: "700", color: colors.ink },
})
