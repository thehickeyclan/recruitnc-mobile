import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { supabase } from "@/lib/supabase"
import { SafeAreaView } from "react-native-safe-area-context"
import { Image } from "expo-image"
import { router, useLocalSearchParams } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons"
import { CoachMessagesCard } from "@/components/coach-messages-card"
import { CoachMessageAction } from "@/components/coach-message-action"
import { fetchEligibility } from "@/lib/coach-messages"
import { colors, radius, space, type } from "@/theme/tokens"
import { openAthleteProfile, openWebPage } from "@/lib/profile-link"
import { claimAthleteProfile, currentUserId, loadAthleteEdits } from "@/lib/athlete-edit"
import { fetchFollowState, setFollowing } from "@/lib/follows"
import { fetchScoutingAccess } from "@/lib/scouting-report"
import {
  STYLE_LABEL,
  fetchPrivateDetails,
  fetchCollegeInterest,
  type CollegeInterest,
  fetchCollegeLogo,
  fetchAthleteProfile,
  fetchSignificantWins,
  groupByEvent,
  significantWinsLine,
  boutAccolade,
  type Academics,
  type SignificantWin,
  hasV2,
  profileMetaLine,
  rowSummary,
  splitDuals,
  splitName,
  weightLines,
  type AthleteProfile,
  type BannerCredential,
  type Competition,
  type ProfileTournamentBout,
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

/** "Junior Girls Freestyle" out of "… Championships - Junior Girls Freestyle", or "" when none. */
function divisionOf(event: string): string {
  const parts = event.split(/\s+[-·]\s+/)
  return parts.length > 1 ? parts[parts.length - 1]!.trim() : ""
}

function TournamentRow({ row, compact = false }: { row: ProfileTournamentRow; compact?: boolean }) {
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
          {compact ? (
            // Under its event's heading a year says the rest: "2026 · Junior Girls Freestyle".
            <Text style={styles.tournamentEvent}>
              {[String(row.year), row.team, divisionOf(row.event)].filter(Boolean).join(" · ")}
            </Text>
          ) : (
            <>
              <Text style={styles.tournamentEvent}>
                {row.event} <Text style={styles.tournamentYear}>{row.year}</Text>
              </Text>
              {row.team ? <Text style={styles.tournamentTeam}>{row.team}</Text> : null}
            </>
          )}
          {summary ? <Text style={styles.tournamentSummary}>{summary}</Text> : null}
        </View>
        {bouts.length > 0 ? (
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
        ) : null}
      </Pressable>

      {open ? (
        <View style={styles.bouts}>
          {bouts.map((bout, index) => (
            <BoutCard key={`${row.id}-${index}`} bout={bout} />
          ))}
        </View>
      ) : null}
    </View>
  )
}

/** One bout: round and result on top, the opponent below, and his accolade under that. */
function BoutCard({ bout }: { bout: ProfileTournamentBout }) {
  const accolade = bout.accolade ?? null
  return (
    <View style={styles.boutCard}>
      <View style={styles.boutTop}>
        {/* Some imports carry no round label. */}
        <Text style={styles.boutRound} numberOfLines={1}>
          {bout.round ?? ""}
        </Text>
        {bout.isBye ? (
          <Text style={styles.boutBye}>Bye</Text>
        ) : (
          <View style={styles.boutResultRow}>
            <View style={[styles.wl, bout.win ? styles.wlWin : styles.wlLoss]}>
              <Text style={styles.wlText}>{bout.win ? "W" : "L"}</Text>
            </View>
            <Text style={styles.boutScore}>{[bout.winType, bout.score].filter(Boolean).join(" ")}</Text>
          </View>
        )}
      </View>
      {!bout.isBye ? (
        <Text style={styles.boutOpponent}>
          {bout.opponentName ?? "Opponent"}
          {bout.opponentClub ? <Text style={styles.boutClub}>  {bout.opponentClub}</Text> : null}
        </Text>
      ) : null}
      {accolade ? (
        <View style={[styles.accolade, /champion/i.test(accolade) && styles.accoladeGold]}>
          <Text style={[styles.accoladeText, /champion/i.test(accolade) && styles.accoladeTextGold]}>{accolade}</Text>
        </View>
      ) : null}
    </View>
  )
}

const CREDENTIAL_ICON: Record<BannerCredential["tier"], React.ComponentProps<typeof MaterialCommunityIcons>["name"]> = {
  national: "trophy-outline",
  toc: "crown-outline",
  state: "medal-outline",
  "olympic-state": "star-circle-outline",
}

/** The banner's finishes: a bordered card each, two to a row (Matt's mock, 1 Oct 2026). */
function CredentialCards({ credentials }: { credentials: BannerCredential[] }) {
  if (!credentials.length) return null
  return (
    <View style={styles.cards}>
      {credentials.map((c) => (
        <View key={c.label} style={styles.card}>
          <MaterialCommunityIcons name={CREDENTIAL_ICON[c.tier]} size={20} color={colors.gold} />
          <View style={styles.flex}>
            <Text style={[styles.cardTitle, c.tier === "national" && styles.cardTitleGold]}>{c.title.toUpperCase()}</Text>
            <Text style={styles.cardDetail}>{c.detail.toUpperCase()}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

function CompetesBar({ competition }: { competition: Competition }) {
  return (
    <View style={styles.competes}>
      <Text style={styles.competesLine}>
        <Text style={styles.competesLabel}>COMPETES  </Text>
        <Text style={styles.competesScope}>{competition.scope === "national" ? "NATIONALLY" : "NORTH CAROLINA ONLY"}</Text>
        {competition.styles.map((st) => (
          <Text key={st} style={styles.competesStyle}>
            {"  ·  "}
            {STYLE_LABEL[st].toUpperCase()}
          </Text>
        ))}
      </Text>
      {competition.scope === "national" && competition.nationalEvents.length ? (
        <Text style={styles.competesEvents}>{competition.nationalEvents.join(", ")}</Text>
      ) : null}
    </View>
  )
}

/** Rows with duals after the individual events, under their own small label. */
function RowList({ rows, dualsLabel }: { rows: ProfileTournamentRow[]; dualsLabel: string }) {
  const { individual, duals } = splitDuals(rows)
  return (
    <>
      {individual.map((row) => (
        <TournamentRow key={row.id} row={row} />
      ))}
      {duals.length ? <Text style={styles.subLabel}>{dualsLabel}</Text> : null}
      {duals.map((row) => (
        <TournamentRow key={row.id} row={row} />
      ))}
    </>
  )
}

type IconName = React.ComponentProps<typeof Ionicons>["name"]

/** One overview row: an icon, a title, a line of real data; opens in place or goes somewhere. */
function OverviewRow({
  icon,
  title,
  subtitle,
  onPress,
  children,
}: {
  icon: IconName
  title: string
  subtitle: string
  onPress?: () => void
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const expandable = Boolean(children)
  return (
    <View style={styles.ovCard}>
      <Pressable
        style={styles.ovHead}
        accessibilityRole="button"
        onPress={() => (expandable ? setOpen((v) => !v) : onPress?.())}
      >
        <Ionicons name={icon} size={20} color={colors.gold} />
        <View style={styles.flex}>
          <Text style={styles.ovTitle}>{title}</Text>
          <Text style={styles.ovSubtitle} numberOfLines={2}>{subtitle}</Text>
        </View>
        <Ionicons
          name={expandable ? (open ? "chevron-up" : "chevron-down") : onPress ? "chevron-forward" : "lock-closed-outline"}
          size={16}
          color={colors.textMuted}
        />
      </Pressable>
      {expandable && open ? <View style={styles.ovBody}>{children}</View> : null}
    </View>
  )
}

/**
 * Significant wins or notable losses, In-state | National (Matt, 8 Oct 2026). National means an
 * opponent from another state; it opens on National when there is one, the stronger list.
 */
function BoutList({ bouts }: { bouts: SignificantWin[] }) {
  const national = bouts.filter((b) => b.scope === "national")
  const inState = bouts.filter((b) => b.scope !== "national")
  const [tab, setTab] = useState<"in-state" | "national">(national.length ? "national" : "in-state")
  const [showAll, setShowAll] = useState(false)
  const list = tab === "national" ? national : inState
  const shown = showAll ? list : list.slice(0, 6)
  return (
    <View style={styles.winList}>
      <View style={[styles.toggle, styles.toggleStart]}>
        {(["in-state", "national"] as const).map((k) => (
          <Pressable
            key={k}
            style={[styles.toggleButton, tab === k && styles.toggleOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === k }}
            onPress={() => {
              setTab(k)
              setShowAll(false)
            }}
          >
            <Text style={[styles.toggleText, tab === k && styles.toggleTextOn]}>
              {k === "national" ? `National (${national.length})` : `In-state (${inState.length})`}
            </Text>
          </Pressable>
        ))}
      </View>
      {shown.length ? (
        shown.map((w, i) => (
          <View key={`${w.opponent}-${w.date}-${i}`} style={styles.winRow}>
            <Text style={styles.winOpponent}>
              {w.opponent}
              {w.opponentSchool ? <Text style={styles.winSchool}>{`  ${w.opponentSchool}`}</Text> : null}
            </Text>
            {boutAccolade(w) ? <Text style={styles.winAccolade}>{boutAccolade(w)}</Text> : null}
            <Text style={styles.winDetail}>{[w.result, w.event].filter(Boolean).join(" · ")}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.winDetail}>{tab === "national" ? "None against out-of-state opponents on file." : "None against NC opponents on file."}</Text>
      )}
      {list.length > 6 && !showAll ? (
        <Pressable accessibilityRole="button" onPress={() => setShowAll(true)}>
          <Text style={styles.seeAllText}>{`See all ${list.length}`}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function collegeInterestLine(i: CollegeInterest | null): string {
  if (!i) return "Which college programs viewed your profile"
  if (i.locked) {
    return i.programCount
      ? `${i.programCount} college program${i.programCount === 1 ? "" : "s"} viewed your profile`
      : "No college views yet"
  }
  if (!i.schools.length) return "No college views yet"
  const lead = i.schools[0]!.school
  return i.schools.length > 1 ? `${lead} and ${i.schools.length - 1} more viewed your profile` : `${lead} viewed your profile`
}

function CollegeInterestBody({ interest: i }: { interest: CollegeInterest }) {
  if (i.locked) {
    return (
      <View style={styles.winList}>
        <Text style={styles.winDetail}>
          {i.programCount
            ? `${i.totalViews} view${i.totalViews === 1 ? "" : "s"} from ${i.programCount} program${i.programCount === 1 ? "" : "s"}. NC United Blue members see which programs.`
            : "When a college coach opens your profile, the program shows here. Keep your results, film and GPA current."}
        </Text>
        {i.programCount ? (
          <Pressable style={styles.contactButton} onPress={() => router.push("/blue-subscription")}>
            <Text style={styles.contactButtonText}>SEE WHICH PROGRAMS</Text>
          </Pressable>
        ) : null}
      </View>
    )
  }
  if (!i.schools.length) {
    return <Text style={styles.winDetail}>When a college coach opens your profile, the program shows here.</Text>
  }
  return (
    <View style={styles.winList}>
      {i.schools.map((s) => (
        <View key={s.school} style={styles.winRow}>
          <Text style={styles.winOpponent}>{s.school}</Text>
          <Text style={styles.winDetail}>
            {`${s.views} view${s.views === 1 ? "" : "s"} · last ${new Date(s.lastViewedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
          </Text>
        </View>
      ))}
      <Text style={styles.acadNote}>Programs only, never the coach's name.</Text>
    </View>
  )
}

const hasAcademics = (a: Academics) => Boolean(a.gpa || a.sat || a.act || a.interest || a.summary)

/** The row's line. Academics are private: approved coaches, the family and admins only. */
function academicsLine(a: Academics | null): string {
  if (!a) return "Visible to approved college coaches"
  if (!hasAcademics(a)) return "Not added yet"
  return [a.gpa ? `${a.gpa.toFixed(2)} GPA` : null, a.sat ? `SAT ${a.sat}` : null, a.act ? `ACT ${a.act}` : null]
    .filter(Boolean)
    .join(" · ") || (a.interest ?? "Added")
}

function AcademicsBody({ academics: a }: { academics: Academics }) {
  const tiles = [
    a.gpa ? { label: "GPA", value: a.gpa.toFixed(2) } : null,
    a.sat ? { label: "SAT", value: String(a.sat) } : null,
    a.act ? { label: "ACT", value: String(a.act) } : null,
  ].filter(Boolean) as { label: string; value: string }[]
  return (
    <View style={styles.winList}>
      {tiles.length ? (
        <View style={styles.acadTiles}>
          {tiles.map((t) => (
            <View key={t.label} style={styles.acadTile}>
              <Text style={styles.acadLabel}>{t.label}</Text>
              <Text style={styles.acadValue}>{t.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {a.interest ? (
        <View style={styles.winRow}>
          <Text style={styles.acadLabel}>ACADEMIC INTEREST</Text>
          <Text style={styles.winOpponent}>{a.interest}</Text>
        </View>
      ) : null}
      {a.summary ? <Text style={styles.winDetail}>{a.summary}</Text> : null}
      <Text style={styles.acadNote}>Private: shown to approved college coaches, the family and admins.</Text>
    </View>
  )
}

/**
 * Tournament Results, collapsed until tapped (Matt, 8 Oct 2026). Open, it sorts By event - the
 * biggest events first, girls' freestyle ahead of folkstyle - or By date, three at a time until
 * "See all". Each year still opens to its bouts.
 */
function TournamentResults({ athlete, isGirl }: { athlete: AthleteProfile; isGirl: boolean }) {
  const [open, setOpen] = useState(false)
  const [sort, setSort] = useState<"event" | "date">("event")
  const [showAll, setShowAll] = useState(false)
  const folk = [...(athlete.stateRows ?? []), ...(athlete.tocRows ?? []), ...(athlete.folkstyle ?? [])]
  // Girls' Greco is off their résumé (Matt, 8 Oct 2026).
  const olympic = (athlete.olympic ?? []).filter((r) => !(isGirl && /greco/i.test(`${r.event} ${r.team ?? ""}`)))
  const groups = isGirl
    ? [...groupByEvent(olympic, "freestyle"), ...groupByEvent(folk, "folkstyle")]
    : [...groupByEvent(folk, "folkstyle"), ...groupByEvent(olympic, "freestyle")]
  const byDate = [...folk, ...olympic].sort((a, b) =>
    String((b as { sortKey?: string }).sortKey ?? b.year).localeCompare(String((a as { sortKey?: string }).sortKey ?? a.year)),
  )
  const total = byDate.length
  const subtitle = athlete.banner?.credentials.slice(0, 2).map((c) => c.label).join(" · ") || `${total} events on file`

  return (
    <View style={[styles.ovCard, styles.ovCardGold]}>
      <View style={styles.ovHead}>
        <Pressable style={[styles.flex, styles.ovHeadInner]} accessibilityRole="button" onPress={() => setOpen((v) => !v)}>
          <MaterialCommunityIcons name="trophy-outline" size={20} color={colors.gold} />
          <View style={styles.flex}>
            <Text style={styles.ovTitle}>Tournament Results</Text>
            <Text style={styles.ovSubtitle} numberOfLines={2}>{subtitle}</Text>
          </View>
          {open ? null : <Ionicons name="chevron-down" size={16} color={colors.textMuted} />}
        </Pressable>
        {open ? (
          <View style={styles.toggle}>
            {(["event", "date"] as const).map((k) => (
              <Pressable
                key={k}
                style={[styles.toggleButton, sort === k && styles.toggleOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: sort === k }}
                onPress={() => setSort(k)}
              >
                <Text style={[styles.toggleText, sort === k && styles.toggleTextOn]}>{k === "event" ? "Event" : "Date"}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      {open ? (
        <View>
          {sort === "event" ? (
            <>
              {(showAll ? groups : groups.slice(0, 3)).map((g, i, list) => (
                <View key={`${g.style}-${g.name}`}>
                  {isGirl && (i === 0 || list[i - 1]!.style !== g.style) ? (
                    <Text style={[styles.styleLabel, g.style === "freestyle" ? styles.styleFree : styles.styleFolk]}>
                      {g.style === "freestyle" ? "FREESTYLE" : "FOLKSTYLE"}
                    </Text>
                  ) : null}
                  <Text style={styles.groupName}>{g.name}</Text>
                  {g.rows.map((row) => (
                    <TournamentRow key={row.id} row={row} compact />
                  ))}
                </View>
              ))}
              {groups.length > 3 ? (
                <Pressable style={styles.seeAll} onPress={() => setShowAll((v) => !v)}>
                  <Text style={styles.seeAllText}>{showAll ? "Show fewer" : `See all ${groups.length} tournaments`}</Text>
                  <Ionicons name={showAll ? "chevron-up" : "chevron-forward"} size={14} color={colors.gold} />
                </Pressable>
              ) : null}
            </>
          ) : (
            <>
              {(showAll ? byDate : byDate.slice(0, 3)).map((row) => (
                <TournamentRow key={row.id} row={row} />
              ))}
              {total > 3 ? (
                <Pressable style={styles.seeAll} onPress={() => setShowAll((v) => !v)}>
                  <Text style={styles.seeAllText}>{showAll ? "Show fewer" : `See all ${total} events`}</Text>
                  <Ionicons name={showAll ? "chevron-up" : "chevron-forward"} size={14} color={colors.gold} />
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      ) : null}
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
  const { id, name, preview } = useLocalSearchParams<{ id: string; name?: string; preview?: string }>()
  /* Development builds only: "?preview=coach" shows the coach's buttons without a coach account,
     so the layout can be reviewed in the simulator. __DEV__ is false in every build phones get. */
  const previewCoach = __DEV__ && preview === "coach"
  const [athlete, setAthlete] = useState<AthleteProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /*
   * Whether this person may edit, answered by the server rather than guessed here.
   *
   * "mine" when the profile is theirs or their child's, "signed-out" when nobody is, and
   * "other" for anyone looking at somebody else's wrestler — which is most people, most of the
   * time, and is not an error.
   */
  const [standing, setStanding] = useState<"unknown" | "mine" | "other" | "signed-out">("unknown")
  const [claiming, setClaiming] = useState(false)

  const checkStanding = useCallback(async () => {
    try {
      if (!(await currentUserId())) return setStanding("signed-out")
      setStanding((await loadAthleteEdits(String(id))) ? "mine" : "other")
    } catch {
      setStanding("other")
    }
  }, [id])

  useEffect(() => {
    void checkStanding()
  }, [checkStanding])

  /*
   * The scouting report is for college coaches, and the server says who that is — the same test
   * the website's button runs. Anyone else never sees the button, rather than a button that
   * refuses them.
   */
  const [scoutingReport, setScoutingReport] = useState(false)
  useEffect(() => {
    let cancelled = false
    void fetchScoutingAccess(String(id)).then((available) => !cancelled && setScoutingReport(available))
    return () => {
      cancelled = true
    }
  }, [id])

  /*
   * Following: who gets told when this wrestler's next results land.
   *
   * Separate from claiming. A parent claims their own child; a coach follows other people's, and
   * the button is the whole subscription - no settings screen to find. The tap flips the button
   * first and saves after, because a recruiter tapping down a list should not wait on a network
   * round trip, and a failure puts it back.
   */
  const [following, setFollowingState] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchFollowState(String(id)).then((is) => !cancelled && setFollowingState(is))
    return () => {
      cancelled = true
    }
  }, [id])

  const toggleFollow = () => {
    if (standing === "signed-out") {
      Alert.alert(
        "Sign in to follow",
        "Following a wrestler sends you an alert when their results come in. A free account is all it takes.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Sign in", onPress: () => router.push("/sign-in") },
        ],
      )
      return
    }
    const next = !following
    setFollowingState(next)
    setFollowBusy(true)
    void setFollowing(String(id), next)
      .then((saved) => setFollowingState(saved))
      .catch((e: unknown) => {
        setFollowingState(!next)
        Alert.alert("Could not save that", e instanceof Error ? e.message : "Try again.")
      })
      .finally(() => setFollowBusy(false))
  }

  const [collegeLogo, setCollegeLogo] = useState<string | null>(null)
  const committedTo = athlete?.commitment?.college ?? null
  useEffect(() => {
    if (!committedTo) return
    let cancelled = false
    void fetchCollegeLogo(committedTo).then((url) => !cancelled && setCollegeLogo(url))
    return () => {
      cancelled = true
    }
  }, [committedTo])

  const [wins, setWins] = useState<SignificantWin[]>([])
  const [losses, setLosses] = useState<SignificantWin[]>([])
  useEffect(() => {
    let cancelled = false
    void fetchSignificantWins(String(id)).then((r) => {
      if (cancelled) return
      setWins(r.wins)
      setLosses(r.losses)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  /* The athlete's own cell, for an approved coach's Call / Text. Asked only of somebody else's
     profile; the server answers approved coaches and nobody else. */
  const [cell, setCell] = useState<string | null>(null)
  /* College Interest: which programs viewed the profile. The family's own view only. */
  const [interest, setInterest] = useState<CollegeInterest | null>(null)
  useEffect(() => {
    if (standing !== "mine") return
    let cancelled = false
    void supabase.auth
      .getSession()
      .then(({ data }) => fetchCollegeInterest(String(id), data.session?.access_token ?? null))
      .then((r) => !cancelled && setInterest(r))
    return () => {
      cancelled = true
    }
  }, [id, standing])

  // Whether this viewer may message the athlete (approved coaches): decides the Contact row.
  const [messageGate, setMessageGate] = useState(false)
  useEffect(() => {
    if (standing !== "other") return
    let cancelled = false
    void fetchEligibility(String(id)).then((g) => !cancelled && setMessageGate(Boolean(g.show)))
    return () => {
      cancelled = true
    }
  }, [id, standing])
  const [academics, setAcademics] = useState<Academics | null>(null)
  useEffect(() => {
    if (standing === "signed-out") return
    let cancelled = false
    void supabase.auth
      .getSession()
      .then(({ data }) => fetchPrivateDetails(String(id), data.session?.access_token ?? null))
      .then((d) => {
        if (cancelled || !d) return
        // Call / Text is for somebody else's profile; academics show to anyone the server answers.
        if (standing === "other") setCell(d.cell)
        setAcademics(d.academics)
      })
    return () => {
      cancelled = true
    }
  }, [id, standing])

  const claim = (as: "self" | "parent") => {
    setClaiming(true)
    void claimAthleteProfile(String(id), as)
      .then(async () => {
        await checkStanding()
        /*
         * Into the same form the website uses. A claim used to end on an alert, so a family
         * arrived at a page built from results and left it exactly as they found it - and the
         * app had no way to fill in a GPA at all.
         */
        openWebPage(`/profile-setup?id=${encodeURIComponent(String(id))}`)
      })
      .catch((e: unknown) => Alert.alert("Could not claim", e instanceof Error ? e.message : "Try again."))
      .finally(() => setClaiming(false))
  }

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
  const isGirl = String(athlete?.gender ?? "").toLowerCase() === "female"
  const styles_ = athlete?.banner?.competition.styles ?? []
  const styleChip =
    styles_.includes("freestyle") && styles_.includes("folkstyle")
      ? "Freestyle + Folkstyle"
      : styles_.includes("folkstyle")
        ? "Folkstyle only"
        : styles_.includes("freestyle")
          ? "Freestyle only"
          : null

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.navBar}>
        <Pressable
          // Opened from a link or an alert there is nothing to go back to; land on Athletes instead.
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/athletes"))}
          hitSlop={12}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={22} color={colors.gold} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        {athlete && hasV2(athlete) && standing !== "mine" ? (
          <Pressable
            onPress={toggleFollow}
            disabled={followBusy}
            hitSlop={12}
            style={[styles.bell, following && styles.bellOn]}
            accessibilityRole="button"
            accessibilityLabel={following ? "Following: result alerts on" : "Follow for result alerts"}
          >
            <Ionicons name={following ? "notifications" : "notifications-outline"} size={18} color={following ? colors.ink : colors.gold} />
            <Text style={[styles.bellText, following && styles.bellTextOn]}>{following ? "Following" : "Follow"}</Text>
          </Pressable>
        ) : null}
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
          {hasV2(athlete) ? (
            <>
              {/* The redesigned profile (Matt's mock, 8 Oct 2026): a compact header, Class of and Last
                  competed, the coach's Message and Call / Text, the key finishes, then an overview
                  of rows - Tournament Results collapsed until tapped. */}
              <View style={styles.header}>
                {athlete.photoUrl ? (
                  <Image source={{ uri: athlete.photoUrl }} style={styles.headerPhoto} contentFit="cover" contentPosition="top" transition={180} />
                ) : (
                  <View style={[styles.headerPhoto, styles.photoEmpty]}>
                    <Text style={styles.initials}>{initials(athlete.name || String(name ?? ""))}</Text>
                  </View>
                )}
                <View style={[styles.flex, styles.headerText]}>
                  <Text style={styles.eyebrow}>NC WRESTLING</Text>
                  {(() => {
                    const { first, last } = splitName(athlete.name || String(name ?? ""))
                    return (
                      <View>
                        {first ? <Text style={styles.firstName} maxFontSizeMultiplier={1.2}>{first.toUpperCase()}</Text> : null}
                        <Text style={styles.lastName} numberOfLines={2} adjustsFontSizeToFit maxFontSizeMultiplier={1.2}>
                          {last.toUpperCase()}
                        </Text>
                      </View>
                    )
                  })()}
                  {[athlete.highSchool, athlete.club].filter(Boolean).length ? (
                    <Text style={styles.meta} numberOfLines={2}>{[athlete.highSchool, athlete.club].filter(Boolean).join(" · ")}</Text>
                  ) : null}
                  {athlete.commitment ? (
                    <View style={styles.commitLine}>
                      {collegeLogo ? (
                        <View style={styles.collegeLogoWrap}>
                          <Image source={{ uri: collegeLogo }} style={styles.collegeLogo} contentFit="contain" transition={150} />
                        </View>
                      ) : (
                        <Ionicons name="school" size={16} color={colors.gold} />
                      )}
                      <Text style={styles.commitLineText} numberOfLines={2}>
                        <Text style={styles.commitLineLabel}>Committed to </Text>
                        {athlete.commitment.college}
                      </Text>
                    </View>
                  ) : null}
                  {athlete.prospectRanking ? (
                    <View style={styles.ribbon}>
                      <Text style={styles.ribbonText}>RECRUITNC #{athlete.prospectRanking}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {athlete.nationalRanking || isGirl ? (
                <View style={styles.chips}>
                  {athlete.nationalRanking ? (
                    <View style={styles.nationalRibbon}>
                      <Text style={styles.nationalRibbonText}>
                        <Text style={styles.nationalRibbonLabel}>★ NATIONAL  </Text>
                        {athlete.nationalRanking.toUpperCase()}
                      </Text>
                    </View>
                  ) : null}
                  {isGirl && styleChip ? (
                    <View style={styles.styleChip}>
                      <Text style={styles.styleChipText}>{styleChip.toUpperCase()}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.statsCard}>
                <View style={styles.statCell}>
                  <Text style={styles.statLabel}>CLASS OF</Text>
                  <Text style={styles.statValue}>{athlete.graduationYear ?? "—"}</Text>
                </View>
                <View style={[styles.statCell, styles.statCellDivided, styles.flex]}>
                  <Text style={styles.statLabel}>LAST COMPETED</Text>
                  {athlete.weight.lastCompeted?.weight ? (
                    <>
                      <Text style={styles.statValue}>{athlete.weight.lastCompeted.weight} lbs</Text>
                      <Text style={styles.statSub} numberOfLines={2}>
                        {[athlete.weight.lastCompeted.event, athlete.weight.lastCompeted.year].filter(Boolean).join(" · ")}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.statSub}>No results on file yet</Text>
                  )}
                </View>
              </View>

              {standing === "mine" ? <CoachMessagesCard athleteId={String(id)} /> : null}
              {standing === "mine" ? (
                <View style={styles.ownerBar}>
                  <View style={styles.flex}>
                    <Text style={styles.ownerTitle}>This is your profile</Text>
                    <Text style={styles.ownerBody}>College coaches read this page. Keep your weight, film and GPA current.</Text>
                  </View>
                  <Pressable style={styles.ownerEdit} onPress={() => router.push({ pathname: "/athlete-edit", params: { id: String(id), name: athlete.name } })}>
                    <Ionicons name="create" size={16} color={colors.ink} />
                    <Text style={styles.ownerActionText}>Edit</Text>
                  </Pressable>
                </View>
              ) : null}

              {/* One list of rows, each opening in place (Matt's mock, 8 Oct 2026). Key finishes lead
                  Tournament Results' summary line; contact is a row, for coaches only. */}
              <View style={styles.list}>
              <TournamentResults athlete={athlete} isGirl={isGirl} />
              <OverviewRow
                icon="stats-chart"
                title="Significant Wins"
                subtitle={significantWinsLine(wins) ?? "None on file yet"}
              >
                {wins.length ? <BoutList bouts={wins} /> : null}
              </OverviewRow>
              <OverviewRow
                icon="trending-down"
                title="Notable Losses"
                subtitle={
                  losses.length
                    ? `${losses.length} to ranked, All-American or state-placing opponents`
                    : "None to ranked or state-placing opponents on file"
                }
              >
                {losses.length ? <BoutList bouts={losses} /> : null}
              </OverviewRow>
              <OverviewRow
                icon="school-outline"
                title="Academic Information"
                subtitle={academicsLine(academics)}
              >
                {academics && hasAcademics(academics) ? <AcademicsBody academics={academics} /> : null}
              </OverviewRow>
              {previewCoach || (standing === "other" && (cell || messageGate)) ? (
                <OverviewRow
                  icon="call-outline"
                  title="Contact Information"
                  subtitle={previewCoach || cell ? "Message, call or text the athlete" : "Message the athlete"}
                >
                  <View style={styles.winList}>
                    {previewCoach ? (
                      <Pressable style={styles.contactButton} onPress={() => Alert.alert("Preview", "Opens a message to the athlete.")}>
                        <Ionicons name="mail-outline" size={16} color={colors.ink} />
                        <Text style={styles.contactButtonText}>MESSAGE {splitName(athlete.name).first.toUpperCase()}</Text>
                      </Pressable>
                    ) : (
                      <CoachMessageAction athleteId={String(id)} athleteName={athlete.name} />
                    )}
                    {previewCoach || cell ? (
                      <Pressable
                        style={styles.callButton}
                        accessibilityRole="button"
                        accessibilityLabel={`Call or text ${athlete.name}`}
                        onPress={() =>
                          previewCoach || !cell
                            ? Alert.alert(athlete.name, "Athlete's cell (preview)", [{ text: "Call" }, { text: "Text" }, { text: "Cancel", style: "cancel" }])
                            : Alert.alert(athlete.name, cell, [
                                { text: "Call", onPress: () => void Linking.openURL(`tel:${cell.replace(/[^\d+]/g, "")}`) },
                                { text: "Text", onPress: () => void Linking.openURL(`sms:${cell.replace(/[^\d+]/g, "")}`) },
                                { text: "Cancel", style: "cancel" },
                              ])
                        }
                      >
                        <Ionicons name="call" size={16} color={colors.gold} />
                        <Text style={styles.callText}>CALL / TEXT  ·  ATHLETE'S CELL</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </OverviewRow>
              ) : null}
              {standing === "mine" ? (
                <OverviewRow icon="eye-outline" title="College Interest" subtitle={collegeInterestLine(interest)}>
                  {interest ? <CollegeInterestBody interest={interest} /> : null}
                </OverviewRow>
              ) : null}
              {scoutingReport ? (
                <OverviewRow
                  icon="document-text-outline"
                  title="Scouting Report"
                  subtitle="Evaluation, record and competition, in full"
                  onPress={() => router.push({ pathname: "/scouting-report/[id]", params: { id: String(id) } })}
                />
              ) : null}
              </View>

              {(standing === "other" || standing === "signed-out") && !scoutingReport ? (
                <View style={styles.claimCard}>
                  <Text style={styles.claimTitle}>Is this you?</Text>
                  <Text style={styles.claimBody}>
                    {standing === "signed-out"
                      ? "A free account lets you claim this profile and add your GPA, film and projected college weight."
                      : "Claim it to add your GPA, film and projected college weight — the things college coaches look for first."}
                  </Text>
                  {standing === "signed-out" ? (
                    <Pressable style={styles.claimButton} onPress={() => router.push("/sign-in")}>
                      <Text style={styles.claimButtonText}>Sign in</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.claimRow}>
                      <Pressable style={styles.claimButton} disabled={claiming} onPress={() => claim("self")}>
                        <Text style={styles.claimButtonText}>{claiming ? "…" : "This is me"}</Text>
                      </Pressable>
                      <Pressable style={styles.claimSecondary} disabled={claiming} onPress={() => claim("parent")}>
                        <Text style={styles.claimSecondaryText}>I'm a parent</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ) : null}
            </>
          ) : (
            <>
          <View style={styles.hero}>
            {athlete.photoUrl ? (
              <Image
                source={{ uri: athlete.photoUrl }}
                style={styles.photo}
                contentFit="cover"
                /* A wrestling photo is usually waist-up or full body: centre-cropping a
                   portrait into a square takes the torso and cuts the head off. */
                contentPosition="top"
                transition={180}
              />
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

          {scoutingReport ? (
            <Pressable
              style={styles.ownerAction}
              onPress={() => router.push({ pathname: "/scouting-report/[id]", params: { id: String(id) } })}
            >
              <Ionicons name="document-text" size={16} color={colors.ink} />
              <Text style={styles.ownerActionText}>Scouting report</Text>
            </Pressable>
          ) : null}

          {standing === "mine" ? <CoachMessagesCard athleteId={String(id)} /> : null}
              {/* College coaches: renders nothing for anyone else. */}
              {standing === "other" ? <CoachMessageAction athleteId={String(id)} athleteName={athlete.name} /> : null}

          {standing === "mine" ? (
            <Pressable
              style={styles.ownerAction}
              onPress={() =>
                router.push({ pathname: "/athlete-edit", params: { id: String(id), name: athlete.name } })
              }
            >
              <Ionicons name="create" size={16} color={colors.ink} />
              <Text style={styles.ownerActionText}>Edit profile</Text>
            </Pressable>
          ) : (standing === "other" || standing === "signed-out") && !scoutingReport ? (
            // Not for a coach: whoever can pull the scouting report is not the wrestler.
            <View style={styles.claimCard}>
              <Text style={styles.claimTitle}>Is this you?</Text>
              <Text style={styles.claimBody}>
                {standing === "signed-out"
                  ? "A free account lets you claim this profile and add your GPA, film and projected college weight."
                  : "Claim it to add your GPA, film and projected college weight — the things college coaches look for first."}
              </Text>
              {standing === "signed-out" ? (
                /* Most people here have no account - they are looking at a page we built for them. */
                <View style={styles.claimRow}>
                  <Pressable style={styles.claimButton} onPress={() => router.push("/sign-in?mode=signup")}>
                    <Text style={styles.claimButtonText}>Create a free account</Text>
                  </Pressable>
                  <Pressable style={styles.claimSecondary} onPress={() => router.push("/sign-in")}>
                    <Text style={styles.claimSecondaryText}>I have one</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.claimRow}>
                  <Pressable style={styles.claimButton} disabled={claiming} onPress={() => claim("self")}>
                    <Text style={styles.claimButtonText}>{claiming ? "…" : "This is me"}</Text>
                  </Pressable>
                  <Pressable style={styles.claimSecondary} disabled={claiming} onPress={() => claim("parent")}>
                    <Text style={styles.claimSecondaryText}>I'm a parent</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : null}

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

            </>
          )}

          {/* The match log, highlights, academics and the coaches' scouting report still live on
              the website. It opens signed in as this account — see lib/profile-link. */}
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

  navBar: { paddingHorizontal: space.md, paddingVertical: space.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bell: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space.sm, minHeight: 32, borderRadius: 999, borderWidth: 1, borderColor: "rgba(211,181,116,0.6)" },
  bellOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  bellText: { fontSize: 12, fontWeight: "800", color: colors.gold },
  bellTextOn: { color: colors.ink },
  commitLine: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  commitLineText: { flex: 1, fontSize: 13, fontWeight: "800", color: colors.text },
  commitLineLabel: { fontWeight: "500", color: colors.textSecondary },
  list: { gap: space.sm },
  contactButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: space.md },
  contactButtonText: { fontSize: 13, fontWeight: "800", color: colors.ink },
  back: { flexDirection: "row", alignItems: "center" },
  backText: { ...type.label, color: colors.gold },

  hero: { flexDirection: "row", alignItems: "center", gap: space.md },
  bannerPhotoWrap: { marginHorizontal: -space.lg, marginTop: -space.lg, height: 380, backgroundColor: colors.surface },
  bannerPhoto: { width: "100%", height: 380 },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 120 },
  fadeBand: { flex: 1, backgroundColor: colors.ink },
  identity: { gap: space.sm, marginTop: -space.md },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 4, color: colors.gold },
  firstName: { fontSize: 22, fontWeight: "500", color: colors.text, opacity: 0.88, letterSpacing: -0.3, lineHeight: 24 },
  lastName: { fontSize: 32, fontWeight: "900", color: colors.text, letterSpacing: -0.8, lineHeight: 34 },
  header: { flexDirection: "row", gap: space.md, alignItems: "center" },
  headerPhoto: { width: 124, height: 156, borderRadius: radius.md, backgroundColor: colors.surface },
  headerText: { gap: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  nationalRibbon: { borderWidth: 1, borderColor: colors.gold, borderRadius: 6, paddingHorizontal: space.sm, paddingVertical: 6, backgroundColor: colors.ink },
  nationalRibbonText: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2, color: colors.text },
  nationalRibbonLabel: { color: colors.gold },
  styleChip: { borderWidth: 1, borderColor: "rgba(110,231,183,0.6)", borderRadius: 6, paddingHorizontal: space.sm, paddingVertical: 6 },
  styleChipText: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2, color: "#A7F3D0" },
  collegeLogoWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  collegeLogo: { width: 22, height: 22 },
  commitLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 2, color: colors.textSecondary },
  statsCard: { flexDirection: "row", borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface },
  statCell: { padding: space.md },
  statCellDivided: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.line },
  coachActions: { flexDirection: "row", gap: space.sm, alignItems: "stretch" },
  callButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: colors.gold, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: 48 },
  callText: { ...type.label, color: colors.text, fontWeight: "800" },
  sectionLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 3, color: colors.gold, marginTop: space.sm },
  ovCard: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, overflow: "hidden" },
  ovCardGold: { borderColor: "rgba(211,181,116,0.5)" },
  ovHead: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm, minHeight: 60 },
  ovHeadInner: { flexDirection: "row", alignItems: "center", gap: space.md },
  ovTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  ovSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  ovBody: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, padding: space.md },
  toggle: { flexDirection: "row", borderWidth: 1, borderColor: "rgba(211,181,116,0.6)", borderRadius: radius.sm, overflow: "hidden" },
  toggleButton: { paddingHorizontal: space.sm, minHeight: 36, justifyContent: "center" },
  toggleOn: { backgroundColor: colors.gold },
  toggleText: { fontSize: 12, fontWeight: "800", color: colors.text },
  toggleTextOn: { color: colors.ink },
  styleLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 2.4, paddingHorizontal: space.md, paddingTop: space.md },
  styleFree: { color: "#A7F3D0" },
  styleFolk: { color: "#93C5FD" },
  groupName: { fontSize: 13, fontWeight: "900", color: colors.text, paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: 2 },
  seeAll: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", margin: space.md, paddingHorizontal: space.md, minHeight: 44, borderWidth: 1, borderColor: "rgba(211,181,116,0.5)", borderRadius: radius.sm },
  seeAllText: { ...type.label, color: colors.gold, fontWeight: "800" },
  winList: { gap: space.sm },
  winRow: { gap: 2 },
  winOpponent: { fontSize: 14, fontWeight: "800", color: colors.text },
  winDetail: { fontSize: 12, color: colors.textSecondary },
  winSchool: { fontSize: 12, fontWeight: "500", color: colors.textMuted },
  winAccolade: { fontSize: 12, fontWeight: "700", color: colors.gold },
  toggleStart: { alignSelf: "flex-start" },
  acadTiles: { flexDirection: "row", gap: space.sm },
  acadTile: { flex: 1, borderWidth: 1, borderColor: "rgba(211,181,116,0.35)", borderRadius: radius.sm, padding: space.sm },
  acadLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.6, color: colors.textMuted },
  acadValue: { fontSize: 22, fontWeight: "900", color: colors.text, marginTop: 2 },
  acadNote: { fontSize: 11, color: colors.textMuted },
  ribbon: {
    alignSelf: "flex-start",
    backgroundColor: colors.gold,
    borderRadius: 6,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    marginTop: space.xs,
  },
  ribbonText: { fontSize: 11, fontWeight: "900", letterSpacing: 2.5, color: colors.ink },
  stats: { flexDirection: "row", marginTop: space.sm },
  stat: { paddingRight: space.md },
  statDivided: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.textMuted, paddingLeft: space.md },
  statLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1.6, color: colors.textMuted },
  statValue: { fontSize: 22, fontWeight: "900", color: colors.text, marginTop: 4 },
  statValueSmall: { fontSize: 18, fontWeight: "800", color: colors.text, marginTop: 4 },
  statSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  cards: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  card: {
    width: "48.5%",
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: "rgba(211,181,116,0.5)",
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  cardTitle: { fontSize: 12, fontWeight: "800", letterSpacing: 0.8, color: colors.text },
  cardTitleGold: { color: colors.gold },
  cardDetail: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: colors.textSecondary, marginTop: 3 },
  competes: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: space.md,
    gap: space.sm,
  },
  competesLine: { lineHeight: 20 },
  competesLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 2.5, color: colors.textMuted },
  competesScope: { fontSize: 13, fontWeight: "900", letterSpacing: 1.2, color: colors.text },
  competesStyle: { fontSize: 13, fontWeight: "900", letterSpacing: 1.2, color: colors.gold },
  competesEvents: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  ownerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    backgroundColor: "rgba(211,181,116,0.1)",
    padding: space.md,
  },
  ownerTitle: { ...type.heading, color: colors.text },
  ownerBody: { ...type.label, color: colors.textSecondary, fontWeight: "500", marginTop: 2 },
  ownerEdit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  styleDivider: { backgroundColor: colors.raised, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm, marginTop: space.md },
  styleDividerTitle: { fontSize: 12, fontWeight: "900", letterSpacing: 2.5, color: colors.text },
  styleDividerNote: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  subLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.6, color: colors.textMuted, paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.xs },
  bouts: { backgroundColor: colors.ink, padding: space.sm, gap: space.sm },
  boutCard: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface, padding: space.sm, gap: 4 },
  boutTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  boutResultRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  wl: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  wlWin: { backgroundColor: "#059669" },
  wlLoss: { backgroundColor: "#B91C1C" },
  wlText: { fontSize: 11, fontWeight: "900", color: colors.text },
  boutScore: { fontSize: 12, fontWeight: "600", color: colors.textSecondary, fontVariant: ["tabular-nums"] },
  boutBye: { fontSize: 12, color: colors.textMuted },
  boutClub: { fontSize: 12, fontWeight: "500", color: colors.textMuted },
  accolade: { alignSelf: "flex-start", borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 },
  accoladeGold: { borderColor: "rgba(211,181,116,0.4)", backgroundColor: "rgba(211,181,116,0.15)" },
  accoladeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, color: colors.textSecondary },
  accoladeTextGold: { color: colors.gold },
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

  ownerAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: space.md,
  },
  ownerActionText: { ...type.label, color: colors.ink, fontWeight: "800" },

  /*
   * Outlined when not following, filled gold once you are — the same gold as the other primary
   * action, so the "on" state reads as a thing you did rather than a thing on offer.
   */
  followButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: space.md,
    marginBottom: space.md,
  },
  followButtonOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  followText: { ...type.label, color: colors.text, fontWeight: "800" },
  followTextOn: { color: colors.ink },

  claimCard: {
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
  },
  claimTitle: { ...type.heading, color: colors.text },
  claimBody: { ...type.label, color: colors.textSecondary, fontWeight: "500", lineHeight: 18 },
  claimRow: { flexDirection: "row", gap: space.sm },
  claimButton: {
    flex: 1,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    alignItems: "center",
  },
  claimButtonText: { ...type.label, color: colors.ink, fontWeight: "800" },
  claimSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    alignItems: "center",
  },
  claimSecondaryText: { ...type.label, color: colors.textSecondary, fontWeight: "700" },

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
  boutRound: { ...type.caption, color: colors.textMuted, flex: 1 },
  boutOpponent: { ...type.label, color: colors.text, fontWeight: "700" },
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
