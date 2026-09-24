import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import Ionicons from "@expo/vector-icons/Ionicons"

import {
  cancelBlueBillingMembership,
  createBlueBillingPortal,
  fetchBlueBilling,
  pauseBlueBillingMembership,
  resumeBlueBillingMembership,
  retryBlueBillingPayment,
  type BlueBillingMembership,
  type BlueWiqSubscription,
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
  const [wiqSubscriptions, setWiqSubscriptions] = useState<BlueWiqSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true)
    setError(null)
    try {
      const state = await fetchBlueBilling()
      setMemberships(state.memberships)
      setWiqSubscriptions(state.wiqSubscriptions)
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

  function run(membership: BlueBillingMembership, work: () => Promise<string>, successTitle: string) {
    setBusyId(membership.id)
    setError(null)
    void work()
      .then((message) => {
        Alert.alert(successTitle, message)
        return load(true)
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "That did not work."))
      .finally(() => setBusyId(null))
  }

  /*
   * Pause, offered before cancel.
   *
   * The screen shipped with cancel and nothing else, so a family facing an injury or a thin
   * month could end their membership from their phone but not hold it. Three months is the
   * default because that is roughly an injury or an off-season, and a date has to be chosen
   * for Stripe — the web form asks; here the common case is one tap.
   */
  function confirmPause(membership: BlueBillingMembership) {
    const resumeAt = new Date()
    resumeAt.setMonth(resumeAt.getMonth() + 3)
    Alert.alert(
      "Pause Blue subscription?",
      `Billing for ${membership.athleteName} stops now and starts again on ${dateLabel(resumeAt.toISOString())}. You can resume any time before then.`,
      [
        { text: "Not now", style: "cancel" },
        {
          text: "Pause 3 months",
          onPress: () =>
            run(membership, () => pauseBlueBillingMembership(membership.id, resumeAt.toISOString()), "Subscription paused"),
        },
      ],
    )
  }

  function confirmResume(membership: BlueBillingMembership) {
    Alert.alert(
      "Resume billing?",
      `${membership.athleteName}'s membership starts again today.`,
      [
        { text: "Not yet", style: "cancel" },
        { text: "Resume", onPress: () => run(membership, () => resumeBlueBillingMembership(membership.id), "Subscription resumed") },
      ],
    )
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
        {/*
          The original Blue cohort bills through WrestlingIQ, not Stripe. Until now those
          families opened this screen and read "No Stripe subscription found" while paying $51
          a month — so the card comes first, and the empty state only shows when there is
          genuinely nothing.
        */}
        {wiqSubscriptions.map((sub) => (
          <View key={sub.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{sub.athleteName}</Text>
                <Text style={styles.plan}>
                  Blue Membership{sub.comped ? " · Scholarship" : sub.amountFormatted ? ` · ${sub.amountFormatted}/month` : ""}
                </Text>
              </View>
              <View style={[styles.badge, sub.status === "active" ? styles.badgeActive : null]}>
                <Text style={styles.badgeText}>
                  {sub.comped ? "Scholarship" : sub.status === "active" ? "Active" : "Ends soon"}
                </Text>
              </View>
            </View>

            <View style={styles.details}>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Member since</Text><Text style={styles.detailValue}>{dateLabel(sub.memberSince)}</Text></View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{sub.status === "active" ? "Next payment" : "Access until"}</Text>
                <Text style={styles.detailValue}>{dateLabel(sub.status === "active" ? sub.nextDueAt : sub.activeUntil)}</Text>
              </View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Billed through</Text><Text style={styles.detailValue}>WrestlingIQ</Text></View>
            </View>

            {/* No Pause or Cancel here: there is no write path to WrestlingIQ, and a button
                that looked like it worked would be worse than none. */}
            <Text style={styles.muted}>
              Your membership is billed through WrestlingIQ, so pausing, cancelling or updating your card happens
              there rather than in the app.
            </Text>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => void WebBrowser.openBrowserAsync("https://www.wrestlingiq.com/")}
            >
              <Ionicons name="open-outline" size={18} color={colors.gold} />
              <Text style={styles.secondaryText}>Manage in WrestlingIQ</Text>
            </Pressable>
          </View>
        ))}

        {!loading && memberships.length === 0 && wiqSubscriptions.length === 0 ? (
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
              {/* A failed payment is recoverable from the phone now; dunning emails had nowhere
                  to send a parent but a desktop. */}
              {membership.status === "pending_payment" ? (
                <Pressable style={styles.secondaryButton} disabled={working} onPress={() => run(membership, () => retryBlueBillingPayment(membership.id), "Payment retried")}>
                  <Ionicons name="refresh-outline" size={18} color={colors.gold} />
                  <Text style={styles.secondaryText}>Retry payment</Text>
                </Pressable>
              ) : null}
              {membership.status === "paused" ? (
                <Pressable style={styles.secondaryButton} disabled={working} onPress={() => confirmResume(membership)}>
                  <Ionicons name="play-outline" size={18} color={colors.gold} />
                  <Text style={styles.secondaryText}>
                    Resume billing{membership.resumeAt ? ` (auto-resumes ${dateLabel(membership.resumeAt)})` : ""}
                  </Text>
                </Pressable>
              ) : null}
              {!ended && !membership.cancelAtPeriodEnd && membership.status !== "paused" ? (
                <Pressable style={styles.secondaryButton} disabled={working} onPress={() => confirmPause(membership)}>
                  <Ionicons name="pause-outline" size={18} color={colors.gold} />
                  <Text style={styles.secondaryText}>Pause subscription</Text>
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
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  secondaryText: { ...type.label, color: colors.gold },
  cancelButton: { alignItems: "center", paddingVertical: space.sm },
  cancelText: { ...type.label, color: colors.red },
  muted: { ...type.body, color: colors.textMuted, textAlign: "center", lineHeight: 21 },
  error: { ...type.label, color: "#FF9B9B", backgroundColor: "#421C25", borderRadius: radius.md, padding: space.md, lineHeight: 19 },
  footnote: { ...type.label, color: colors.textMuted, textAlign: "center", lineHeight: 18, marginTop: space.sm },
})
