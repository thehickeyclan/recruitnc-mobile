import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import Ionicons from "@expo/vector-icons/Ionicons"

import {
  cancelBlueBillingMembership,
  createBlueBillingPortal,
  fetchBlueBillingMemberships,
  type BlueBillingMembership,
} from "@/lib/blue-billing"
import { colors, radius, space, type } from "@/theme/tokens"

function dateLabel(value: string | null): string {
  if (!value) return "Not available"
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function statusLabel(membership: BlueBillingMembership): string {
  if (membership.cancelAtPeriodEnd) return "Cancels at period end"
  if (membership.status === "pending_payment") return "Payment needs attention"
  return membership.status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())
}

export default function BlueSubscriptionScreen() {
  const [memberships, setMemberships] = useState<BlueBillingMembership[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true)
    setError(null)
    try {
      setMemberships(await fetchBlueBillingMemberships())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your Blue subscription.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function openPortal(membership: BlueBillingMembership) {
    if (!membership.stripeCustomerId) return
    setBusyId(membership.id)
    setError(null)
    try {
      const url = await createBlueBillingPortal(membership.stripeCustomerId)
      await WebBrowser.openBrowserAsync(url)
      await load(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open secure billing.")
    } finally {
      setBusyId(null)
    }
  }

  function confirmCancel(membership: BlueBillingMembership) {
    Alert.alert(
      "Cancel Blue subscription?",
      `Your membership for ${membership.athleteName} will remain active through ${dateLabel(membership.nextBillingAt)} and will not renew.`,
      [
        { text: "Keep membership", style: "cancel" },
        {
          text: "Cancel renewal",
          style: "destructive",
          onPress: () => {
            setBusyId(membership.id)
            setError(null)
            void cancelBlueBillingMembership(membership.id)
              .then((message) => {
                Alert.alert("Cancellation scheduled", message)
                return load(true)
              })
              .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not cancel."))
              .finally(() => setBusyId(null))
          },
        },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>NC UNITED BLUE</Text>
          <Text style={styles.title}>Subscription</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.gold} />}
      >
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.gold} /><Text style={styles.muted}>Loading billing details…</Text></View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && memberships.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No Stripe subscription found</Text>
            <Text style={styles.muted}>Blue billing appears here for the account that pays for the membership.</Text>
          </View>
        ) : null}

        {memberships.map((membership) => {
          const ended = membership.status === "cancelled" || membership.status === "alumni"
          const working = busyId === membership.id
          const card = membership.cardBrand && membership.cardLast4
            ? `${membership.cardBrand.toUpperCase()} •••• ${membership.cardLast4}`
            : "Managed securely by Stripe"
          return (
            <View key={membership.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>{membership.athleteName}</Text>
                  <Text style={styles.plan}>{membership.planName ?? "Blue Membership"}{membership.amountFormatted ? ` · ${membership.amountFormatted}/month` : ""}</Text>
                </View>
                <View style={[styles.badge, membership.status === "active" && !membership.cancelAtPeriodEnd ? styles.badgeActive : null]}>
                  <Text style={styles.badgeText}>{statusLabel(membership)}</Text>
                </View>
              </View>

              <View style={styles.details}>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Next bill date</Text><Text style={styles.detailValue}>{ended || membership.cancelAtPeriodEnd ? "No further billing" : dateLabel(membership.nextBillingAt)}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Last payment</Text><Text style={styles.detailValue}>{dateLabel(membership.lastPaymentAt)}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailLabel}>Payment method</Text><Text style={styles.detailValue}>{card}</Text></View>
              </View>

              {membership.stripeCustomerId && !ended ? (
                <Pressable style={styles.primaryButton} disabled={working} onPress={() => void openPortal(membership)}>
                  {working ? <ActivityIndicator color={colors.ink} /> : <Ionicons name="card-outline" size={18} color={colors.ink} />}
                  <Text style={styles.primaryText}>Update card & view invoices</Text>
                </Pressable>
              ) : null}
              {!ended && !membership.cancelAtPeriodEnd ? (
                <Pressable style={styles.cancelButton} disabled={working} onPress={() => confirmCancel(membership)}>
                  <Text style={styles.cancelText}>Cancel subscription</Text>
                </Pressable>
              ) : null}
            </View>
          )
        })}
        <Text style={styles.footnote}>Billing changes are processed securely by Stripe. Pull down to refresh after making a change.</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
  back: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surface },
  headerText: { flex: 1 },
  eyebrow: { ...type.caption, color: colors.gold },
  title: { ...type.title, color: colors.text },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  center: { paddingVertical: 48, alignItems: "center", gap: space.md },
  card: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: space.lg, gap: space.lg },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  flex: { flex: 1 },
  cardTitle: { ...type.heading, color: colors.text },
  plan: { ...type.label, color: colors.textMuted, marginTop: 3 },
  badge: { borderRadius: radius.pill, backgroundColor: colors.surface, paddingHorizontal: 9, paddingVertical: 5, maxWidth: 130 },
  badgeActive: { backgroundColor: "#174634" },
  badgeText: { ...type.caption, color: colors.textSecondary, textAlign: "center" },
  details: { borderTopWidth: 1, borderTopColor: colors.line },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  detailLabel: { ...type.label, color: colors.textMuted },
  detailValue: { ...type.label, color: colors.text, textAlign: "right", flex: 1 },
  primaryButton: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.gold, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, paddingHorizontal: space.md },
  primaryText: { ...type.label, color: colors.ink, fontWeight: "800" },
  cancelButton: { alignItems: "center", paddingVertical: space.sm },
  cancelText: { ...type.label, color: colors.red },
  muted: { ...type.body, color: colors.textMuted, textAlign: "center", lineHeight: 21 },
  error: { ...type.label, color: "#FF9B9B", backgroundColor: "#421C25", borderRadius: radius.md, padding: space.md, lineHeight: 19 },
  footnote: { ...type.label, color: colors.textMuted, textAlign: "center", lineHeight: 18, marginTop: space.sm },
})
