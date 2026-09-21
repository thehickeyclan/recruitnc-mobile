import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Image } from "expo-image"
import { router, useLocalSearchParams } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { openAthleteProfile } from "@/lib/profile-link"
import {
  fetchAthleteProfile,
  profileMetaLine,
  rowSummary,
  weightLines,
  type AthleteProfile,
  type ProfileTournamentRow,
} from "@/lib/athlete-profile"

/**
 * A wrestler, in the app.
 *
 * Every athlete tap used to open the website in a sheet — from rankings, from commitments, from
 * the TOC field — which is the moment the app stopped being the thing you were using. This is the
 * same facts, natively: who they are, what they weigh now, what they have won, and every
 * tournament with the bouts underneath it.
 *
 * Not everything the web profile holds. The match log, the highlight reel and the academics stay
 * on the website, and the link at the bottom goes there; what is here is what somebody looking a
 * wrestler up actually asks for first.
 */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase()
}

function TournamentRow({ row }: { row: ProfileTournamentRow }) {
  const [open, setOpen] = useState(false)
  const summary = rowSummary(row)
  const bouts = row.bouts ?? []

  return (
    <View style={styles.tournamentRow}>
      <Pressable
        style={styles.tournamentHead}
        onPress={() => bouts.length > 0 && setOpen((v) => !v)}
        accessibilityRole={bouts.length > 0 ? "button" : "text"}
      >
        <View style={styles.flex}>
          <Text style={styles.tournamentEvent}>
            {row.event} <Text style={styles.tournamentYear}>{row.year}</Text>
          </Text>
          {row.team ? <Text style={styles.tournamentTeam}>{row.team}</Text> : null}
          {summary ? <Text style={styles.tournamentSummary}>{summary}</Text> : null}
        </View>
        {bouts.length > 0 ? (
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
        ) : null}
      </Pressable>

      {open
        ? bouts.map((bout, index) => (
            <View key={`${row.id}-${index}`} style={styles.bout}>
              {/* Some imports carry no round label; an empty column just eats the opponent's name. */}
              {bout.round ? <Text style={styles.boutRound}>{bout.round}</Text> : null}
              <Text style={styles.boutOpponent} numberOfLines={1}>
                {bout.isBye ? "Bye" : (bout.opponentName ?? "Opponent")}
              </Text>
              <Text style={[styles.boutResult, bout.win ? styles.boutWin : styles.boutLoss]}>
                {bout.isBye ? "—" : `${bout.win ? "W" : "L"} ${[bout.winType, bout.score].filter(Boolean).join(" ")}`}
              </Text>
            </View>
          ))
        : null}
    </View>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeading}>{title}</Text>
      <View style={styles.group}>{children}</View>
    </View>
  )
}

export default function AthleteProfileScreen() {
  // The name comes along from the list that opened this, so the header is right before the fetch is.
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>()
  const [athlete, setAthlete] = useState<AthleteProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setAthlete(await fetchAthleteProfile(String(id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load that profile.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const weight = athlete ? weightLines(athlete) : { headline: null, note: null }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.gold} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : error || !athlete ? (
        <View style={styles.centre}>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.retry} onPress={() => void load()}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                void load()
              }}
              tintColor={colors.gold}
            />
          }
        >
          <View style={styles.hero}>
            {athlete.photoUrl ? (
              <Image source={{ uri: athlete.photoUrl }} style={styles.photo} contentFit="cover" transition={180} />
            ) : (
              <View style={[styles.photo, styles.photoEmpty]}>
                <Text style={styles.initials}>{initials(athlete.name || String(name ?? ""))}</Text>
              </View>
            )}
            <View style={styles.flex}>
              <Text style={styles.name} maxFontSizeMultiplier={1.3}>
                {athlete.name || name}
              </Text>
              <Text style={styles.meta}>{profileMetaLine(athlete)}</Text>
              {athlete.prospectRanking ? (
                <View style={styles.rank}>
                  <Text style={styles.rankText}>RecruitNC #{athlete.prospectRanking}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {weight.headline ? (
            <View style={styles.weightBar}>
              <Text style={styles.weightHeadline}>{weight.headline}</Text>
              {weight.note ? <Text style={styles.weightNote}>{weight.note}</Text> : null}
            </View>
          ) : null}

          {athlete.commitment ? (
            <View style={styles.commit}>
              <Ionicons name="school" size={18} color={colors.gold} />
              <View style={styles.flex}>
                <Text style={styles.commitCollege}>{athlete.commitment.college}</Text>
                <Text style={styles.commitStatus}>{athlete.commitment.status ?? "Committed"}</Text>
              </View>
            </View>
          ) : null}

          {athlete.credentials.length > 0 ? (
            <Section title="RESUME">
              {athlete.credentials.map((credential, index) => (
                <View key={`${credential.label}-${credential.year}-${index}`} style={styles.credential}>
                  <Text style={styles.credentialLabel}>{credential.label}</Text>
                  <Text style={styles.credentialDetail}>
                    {credential.detail} · {credential.year}
                  </Text>
                </View>
              ))}
            </Section>
          ) : null}

          {athlete.stateResults.length > 0 ? (
            <Section title="NCHSAA STATES">
              {athlete.stateResults.map((result) => (
                <View key={`${result.year}-${result.weightClass}`} style={styles.stateRow}>
                  <Text style={styles.stateYear}>{result.year}</Text>
                  <Text style={styles.statePlace}>
                    {result.place === 1 ? "Champion" : result.place ? `${result.place}th` : "Qualifier"}
                  </Text>
                  <Text style={styles.stateMeta}>
                    {[result.classification, result.weightClass ? `${result.weightClass} lbs` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
              ))}
            </Section>
          ) : null}

          {athlete.toc.length > 0 ? (
            <Section title="TOURNAMENT OF CHAMPIONS">
              {athlete.toc.map((row) => (
                <TournamentRow key={row.id} row={row} />
              ))}
            </Section>
          ) : null}

          {athlete.national.length > 0 ? (
            <Section title="NATIONAL TOURNAMENTS">
              {athlete.national.map((row) => (
                <TournamentRow key={row.id} row={row} />
              ))}
            </Section>
          ) : null}

          {/* The match log, highlights and academics still live on the website. */}
          <Pressable style={styles.webLink} onPress={() => openAthleteProfile(athlete.id)}>
            <Ionicons name="open-outline" size={16} color={colors.gold} />
            <Text style={styles.webLinkText}>Full profile on the web</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  flex: { flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xxl * 2, gap: space.md },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, paddingHorizontal: space.xl },
  error: { ...type.body, color: colors.textSecondary, textAlign: "center" },
  retry: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  retryText: { ...type.label, color: colors.gold },

  navBar: { paddingHorizontal: space.md, paddingVertical: space.sm },
  back: { flexDirection: "row", alignItems: "center" },
  backText: { ...type.label, color: colors.gold },

  hero: { flexDirection: "row", alignItems: "center", gap: space.md },
  photo: { width: 84, height: 84, borderRadius: radius.md, backgroundColor: colors.surface },
  photoEmpty: { alignItems: "center", justifyContent: "center" },
  initials: { ...type.title, color: colors.gold },
  name: { ...type.display, color: colors.text },
  meta: { ...type.label, color: colors.textSecondary, marginTop: 4 },
  rank: {
    alignSelf: "flex-start",
    marginTop: space.sm,
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  rankText: { ...type.caption, color: colors.ink },

  weightBar: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
  },
  weightHeadline: { ...type.title, color: colors.text },
  weightNote: { ...type.label, color: colors.textMuted, marginTop: 2 },

  commit: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    padding: space.md,
  },
  commitCollege: { ...type.heading, color: colors.text },
  commitStatus: { ...type.caption, color: colors.gold, marginTop: 2 },

  section: { gap: space.sm },
  sectionHeading: { ...type.caption, color: colors.textMuted, marginTop: space.sm },
  group: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    overflow: "hidden",
  },

  credential: {
    padding: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  credentialLabel: { ...type.label, color: colors.gold, fontWeight: "700" },
  credentialDetail: { ...type.label, color: colors.textSecondary, marginTop: 2 },

  stateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  stateYear: { ...type.label, color: colors.textMuted, width: 44 },
  statePlace: { ...type.label, color: colors.text, fontWeight: "700", flex: 1 },
  stateMeta: { ...type.caption, color: colors.textMuted },

  tournamentRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  tournamentHead: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md },
  tournamentEvent: { ...type.label, color: colors.text, fontWeight: "700" },
  tournamentYear: { color: colors.textMuted, fontWeight: "600" },
  tournamentTeam: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  tournamentSummary: { ...type.label, color: colors.textSecondary, marginTop: 2 },

  bout: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.ink,
  },
  boutRound: { ...type.caption, color: colors.textMuted, width: 86 },
  boutOpponent: { ...type.label, color: colors.text, flex: 1 },
  boutResult: { ...type.caption },
  boutWin: { color: colors.success },
  boutLoss: { color: colors.textMuted },

  webLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    marginTop: space.md,
    paddingVertical: space.md,
  },
  webLinkText: { ...type.label, color: colors.gold, fontWeight: "700" },
})
