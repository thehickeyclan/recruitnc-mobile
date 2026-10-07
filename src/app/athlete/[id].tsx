import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Image } from "expo-image"
import { router, useLocalSearchParams } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons"
import { CoachMessagesCard } from "@/components/coach-messages-card"
import { colors, radius, space, type } from "@/theme/tokens"
import { openAthleteProfile, openWebPage } from "@/lib/profile-link"
import { claimAthleteProfile, currentUserId, loadAthleteEdits } from "@/lib/athlete-edit"
import { fetchFollowState, setFollowing } from "@/lib/follows"
import { fetchScoutingAccess } from "@/lib/scouting-report"
import {
  STYLE_LABEL,
  fetchAthleteProfile,
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
          {hasV2(athlete) ? (
            <>
              {/* Banner, as on the website (Matt's mock, 1 Oct 2026): photo, eyebrow, the name in
                  two weights, the gold ribbon, the stat row, a card per key finish, Competes. */}
              <View style={styles.bannerPhotoWrap}>
                {athlete.photoUrl ? (
                  <Image
                    source={{ uri: athlete.photoUrl }}
                    style={styles.bannerPhoto}
                    contentFit="cover"
                    contentPosition="top"
                    transition={180}
                  />
                ) : (
                  <View style={[styles.bannerPhoto, styles.photoEmpty]}>
                    <Text style={styles.initials}>{initials(athlete.name || String(name ?? ""))}</Text>
                  </View>
                )}
                {/* A fade into the page without a gradient module (a native change): stacked bands. */}
                <View pointerEvents="none" style={styles.fade}>
                  {Array.from({ length: 16 }, (_, i) => ((i + 1) / 16) ** 1.6).map((o) => (
                    <View key={o} style={[styles.fadeBand, { opacity: o }]} />
                  ))}
                </View>
              </View>

              <View style={styles.identity}>
                <Text style={styles.eyebrow}>NORTH CAROLINA WRESTLING</Text>
                {(() => {
                  const { first, last } = splitName(athlete.name || String(name ?? ""))
                  return (
                    <View>
                      {first ? (
                        <Text style={styles.firstName} maxFontSizeMultiplier={1.2}>
                          {first.toUpperCase()}
                        </Text>
                      ) : null}
                      <Text style={styles.lastName} maxFontSizeMultiplier={1.2}>
                        {last.toUpperCase()}
                      </Text>
                    </View>
                  )
                })()}
                {athlete.prospectRanking || athlete.graduationYear ? (
                  <View style={styles.ribbon}>
                    <Text style={styles.ribbonText}>
                      {[
                        athlete.prospectRanking ? `RECRUITNC #${athlete.prospectRanking}` : null,
                        athlete.graduationYear ? `CLASS OF ${athlete.graduationYear}` : null,
                      ]
                        .filter(Boolean)
                        .join("  ·  ")}
                    </Text>
                  </View>
                ) : null}
                {[athlete.highSchool, athlete.club].filter(Boolean).length ? (
                  <Text style={styles.meta}>{[athlete.highSchool, athlete.club].filter(Boolean).join(" · ")}</Text>
                ) : null}

                <View style={styles.stats}>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>YEAR</Text>
                    <Text style={styles.statValue}>{athlete.graduationYear ?? "—"}</Text>
                  </View>
                  {/* Last competed only: the listed weight is a number the family typed once, and the
                      weight a wrestler actually made - where and when - is what a coach reads. */}
                  <View style={[styles.stat, styles.statDivided, styles.flex]}>
                    <Text style={styles.statLabel}>LAST COMPETED</Text>
                    {athlete.weight.lastCompeted?.weight ? (
                      <>
                        <Text style={styles.statValueSmall}>{athlete.weight.lastCompeted.weight} lbs</Text>
                        <Text style={styles.statSub} numberOfLines={2}>
                          {[athlete.weight.lastCompeted.event, athlete.weight.lastCompeted.year].filter(Boolean).join(" ")}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.statSub}>No results on file yet</Text>
                    )}
                  </View>
                </View>
              </View>

              {standing === "mine" ? null : (
                <Pressable
                  style={[styles.followButton, following && styles.followButtonOn]}
                  onPress={toggleFollow}
                  disabled={followBusy}
                >
                  <Ionicons
                    name={following ? "notifications" : "notifications-outline"}
                    size={16}
                    color={following ? colors.ink : colors.text}
                  />
                  <Text style={[styles.followText, following && styles.followTextOn]}>
                    {following ? "FOLLOWING" : "FOLLOW FOR RESULT ALERTS"}
                  </Text>
                </Pressable>
              )}

              {scoutingReport ? (
                <Pressable
                  style={styles.ownerAction}
                  onPress={() => router.push({ pathname: "/scouting-report/[id]", params: { id: String(id) } })}
                >
                  <Ionicons name="document-text" size={16} color={colors.ink} />
                  <Text style={styles.ownerActionText}>VIEW SCOUTING REPORT</Text>
                </Pressable>
              ) : null}

              {/* Messages from college coaches live on the wrestler's own screen, for the family. */}
              {standing === "mine" ? <CoachMessagesCard athleteId={String(id)} /> : null}

              {standing === "mine" ? (
                // Matt: if someone owns the profile, make it obvious they can edit it.
                <View style={styles.ownerBar}>
                  <View style={styles.flex}>
                    <Text style={styles.ownerTitle}>This is your profile</Text>
                    <Text style={styles.ownerBody}>College coaches read this page. Keep your weight, film and GPA current.</Text>
                  </View>
                  <Pressable
                    style={styles.ownerEdit}
                    onPress={() => router.push({ pathname: "/athlete-edit", params: { id: String(id), name: athlete.name } })}
                  >
                    <Ionicons name="create" size={16} color={colors.ink} />
                    <Text style={styles.ownerActionText}>Edit</Text>
                  </Pressable>
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

              <CredentialCards credentials={athlete.banner!.credentials} />
              <CompetesBar competition={athlete.banner!.competition} />

              {/* In-state first - the Tournament of Champions, then NCHSAA States - then national
                  folkstyle, and Freestyle & Greco-Roman last, as on the website. */}
              {athlete.tocRows?.length ? (
                <Section title="TOURNAMENT OF CHAMPIONS">
                  {athlete.tocRows.map((row) => (
                    <TournamentRow key={row.id} row={row} />
                  ))}
                </Section>
              ) : null}
              {athlete.stateRows?.length ? (
                <Section title="NCHSAA STATE CHAMPIONSHIPS">
                  {athlete.stateRows.map((row) => (
                    <TournamentRow key={row.id} row={row} />
                  ))}
                </Section>
              ) : null}
              {athlete.folkstyle?.length ? (
                <Section title="NATIONAL TOURNAMENTS — FOLKSTYLE">
                  <RowList rows={athlete.folkstyle} dualsLabel="DUALS & TEAM EVENTS" />
                </Section>
              ) : null}
              {athlete.olympic?.length ? (
                <>
                  <View style={styles.styleDivider}>
                    <Text style={styles.styleDividerTitle}>OLYMPIC STYLES</Text>
                    <Text style={styles.styleDividerNote}>Freestyle & Greco-Roman — not folkstyle</Text>
                  </View>
                  <Section title="FREESTYLE & GRECO-ROMAN">
                    <RowList rows={athlete.olympic} dualsLabel="DUAL RESULTS" />
                  </Section>
                </>
              ) : null}

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

  navBar: { paddingHorizontal: space.md, paddingVertical: space.sm },
  back: { flexDirection: "row", alignItems: "center" },
  backText: { ...type.label, color: colors.gold },

  hero: { flexDirection: "row", alignItems: "center", gap: space.md },
  bannerPhotoWrap: { marginHorizontal: -space.lg, marginTop: -space.lg, height: 380, backgroundColor: colors.surface },
  bannerPhoto: { width: "100%", height: 380 },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 120 },
  fadeBand: { flex: 1, backgroundColor: colors.ink },
  identity: { gap: space.sm, marginTop: -space.md },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 4, color: colors.gold },
  firstName: { fontSize: 32, fontWeight: "600", color: colors.text, opacity: 0.92, letterSpacing: -0.5, lineHeight: 34 },
  lastName: { fontSize: 44, fontWeight: "900", color: colors.text, letterSpacing: -1, lineHeight: 46 },
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
