import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Image } from "expo-image"
import * as WebBrowser from "expo-web-browser"
import { router, useLocalSearchParams } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { fetchScoutingReport } from "@/lib/scouting-report"
import { openWebPage } from "@/lib/profile-link"
import { shareScoutingReportPdf } from "@/lib/scouting-report-pdf"
import {
  STANDING_LABEL,
  dayLabel,
  groupBouts,
  isOlympic,
  isOutOfState,
  monthLabel,
  movementLabel,
  noBoutsLine,
  reportedBout,
  statusLine,
  styleOfEvent,
  weightProgression,
  type ReportBout,
  type ScoutingReport,
} from "@/lib/scouting-report-format"
import { keyFacts, snapshotFigures, starPart } from "@/lib/scouting-report-snapshot"

/**
 * The scouting report, natively.
 *
 * Same facts, same order and the same wording rules as the website's report — the document a
 * college coach prints. What changes is the form: the web one is a paper dossier, this is a screen
 * read on a phone between matches, so tables become rows and the palette is the app's.
 *
 * Every section that can be empty says so in words. An omitted fact on this report has been read
 * as a gap to fill before, and a coach scanning on a phone is the reader most likely to assume.
 *
 * PDF builds the document on the phone and hands it to the share sheet — text it, mail it, save it
 * to Files. A binary too old to build one opens the website's printable report instead, signed in.
 */

function Stars({ stars }: { stars: number }) {
  return (
    <View style={styles.stars} accessibilityLabel={`${stars} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= stars ? "star" : "star-outline"} size={15} color={i <= stars ? colors.gold : colors.textMuted} />
      ))}
    </View>
  )
}

function Block({ n, title, count, children }: { n: number; title: string; count?: number; children: React.ReactNode }) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <Text style={styles.blockNumber}>{String(n).padStart(2, "0")}</Text>
        <Text style={styles.blockTitle}>{title.toUpperCase()}</Text>
        {count !== undefined ? <Text style={styles.blockCount}>{count} recorded</Text> : null}
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  )
}

function Vital({ label, value, onPress }: { label: string; value: string | null; onPress?: () => void }) {
  if (!value) return null
  return (
    <View style={styles.vital}>
      <Text style={styles.vitalLabel}>{label}</Text>
      <Text style={[styles.vitalValue, onPress && styles.link]} onPress={onPress}>
        {value}
      </Text>
    </View>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return <Text style={styles.note}>{children}</Text>
}

function Row({ left, right, sub }: { left: string; right?: string | null; sub?: string | null }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.rowLeft}>{left}</Text>
        {right ? <Text style={styles.rowRight}>{right}</Text> : null}
      </View>
      {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
    </View>
  )
}

function BoutList({ rows, kind }: { rows: ReportBout[]; kind: "win" | "loss" }) {
  const groups = groupBouts(rows, kind)
  return (
    <>
      {groups.map((group) => (
        <View key={group.heading} style={styles.boutGroup}>
          <Text style={styles.boutGroupHead}>
            {group.heading.toUpperCase()} <Text style={styles.muted}>({group.rows.length})</Text>
          </Text>
          {group.rows.map((bout, i) => (
            <View key={`${bout.opponent}-${i}`} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowLeft}>
                  {bout.opponent}
                  {bout.opponentSchool ? <Text style={styles.rowSubInline}>  {bout.opponentSchool}</Text> : null}
                </Text>
                <Text style={[styles.rowRight, kind === "win" ? styles.win : styles.loss]}>{bout.result ?? "—"}</Text>
              </View>
              <View style={styles.boutMeta}>
                <Text style={[styles.chip, chipStyle(bout.reason)]}>{STANDING_LABEL[bout.reason]}</Text>
                <Text style={styles.rowSub}>
                  {[bout.nationalRankLabel, bout.stateLabel, bout.fargoLabel, bout.credential].filter(Boolean).join(" · ")}
                </Text>
              </View>
              <Text style={styles.rowSub}>
                {[bout.event, bout.date ? dayLabel(bout.date) : null].filter(Boolean).join(" · ") || "—"}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </>
  )
}

/** In-state, then national (out-of-state opponents), each by standing - the website's grouping. */
function Bouts({ rows, kind }: { rows: ReportBout[]; kind: "win" | "loss" }) {
  if (!rows.length) return <Note>{noBoutsLine(kind)}</Note>
  const scopes = [
    { title: "In-state", rows: rows.filter((r) => !isOutOfState(r)) },
    { title: "National (out-of-state opponents)", rows: rows.filter(isOutOfState) },
  ].filter((x) => x.rows.length)
  return (
    <>
      {scopes.map((scope) => (
        <View key={scope.title}>
          <Text style={styles.scopeHead}>
            {scope.title.toUpperCase()} <Text style={styles.muted}>({scope.rows.length})</Text>
          </Text>
          <BoutList rows={scope.rows} kind={kind} />
        </View>
      ))}
    </>
  )
}

function chipStyle(reason: ReportBout["reason"]) {
  switch (reason) {
    case "national-ranked":
    case "national-placer":
      return styles.chip_national
    case "toc-field":
    case "ranked":
    case "state-champion":
      return styles.chip_instate
    case "state-placer":
      return styles.chip_placer
  }
}

function openLink(url: string) {
  void WebBrowser.openBrowserAsync(url).catch(() => undefined)
}

function SummaryCard({ label, value, sub, small }: { label: string; value: string; sub?: string; small?: boolean }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
      <Text style={small ? styles.summaryValueSmall : styles.summaryValue}>{value}</Text>
      {sub ? (
        <Text style={styles.summarySub} numberOfLines={2}>
          {sub}
        </Text>
      ) : null}
    </View>
  )
}

function ContactRow({ label, value, url }: { label: string; value: string | null | undefined; url: string | null }) {
  return (
    <View style={styles.contactRow}>
      <Text style={styles.contactLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.contactValue, value && url ? styles.link : null]} onPress={value && url ? () => void Linking.openURL(url) : undefined}>
        {value ?? "—"}
      </Text>
    </View>
  )
}

function Results({ rows, empty }: { rows: ScoutingReport["results"]; empty: string }) {
  if (!rows.length) return <Note>{empty}</Note>
  return (
    <>
      {rows.map((row, i) => (
        <Row key={i} left={row.event} right={row.date ? dayLabel(row.date) : String(row.year)} sub={row.detail} />
      ))}
    </>
  )
}

function StyleDivider({ title, note }: { title: string; note: string }) {
  return (
    <View style={styles.divider}>
      <Text style={styles.dividerTitle}>{title}</Text>
      <Text style={styles.dividerNote}>{note}</Text>
    </View>
  )
}

/**
 * The report on a phone, in the website's order and wording (Oct 2026 redesign): who he is and how
 * to reach him, the snapshot, key facts, academics, the star rating in plain lines, the
 * competition profile, then folkstyle - and Freestyle & Greco-Roman last, behind its own divider.
 */
function Report({ report }: { report: ScoutingReport }) {
  const { identity, academics, membership, contact } = report
  const full = report.accessTier === "full"
  const progression = weightProgression(report.results)
  const fileNumber = `NCU-${report.athleteId.slice(0, 8).toUpperCase()}`
  let section = 0
  const n = () => ++section

  const styleOf = (r: ScoutingReport["results"][number]) => r.style ?? styleOfEvent(r.event)
  const folkResults = report.results.filter((r) => !isOlympic(styleOf(r)))
  const olyResults = report.results.filter((r) => isOlympic(styleOf(r)))
  const olyDuals = olyResults.filter((r) => /\bduals?\b/i.test(r.event))
  const olyIndividual = olyResults.filter((r) => !/\bduals?\b/i.test(r.event))
  const allWins = [...report.significantWins, ...(report.reportedWins ?? []).map(reportedBout)]
  const folkWins = allWins.filter((w) => !isOlympic(styleOfEvent(w.event)))
  const olyWins = allWins.filter((w) => isOlympic(styleOfEvent(w.event)))
  const folkLosses = report.significantLosses.filter((w) => !isOlympic(styleOfEvent(w.event)))
  const olyLosses = report.significantLosses.filter((w) => isOlympic(styleOfEvent(w.event)))
  const snapshot = snapshotFigures(report)
  const facts = keyFacts(report)
  const soc = report.strengthOfCompetition
  const handle = contact.instagramUrl?.replace(/^https:\/\/www\.instagram\.com\//, "")
  const digits = (v: string) => v.replace(/[^\d+]/g, "")

  const starRows = (() => {
    const rating = report.starRating
    if (!rating) return []
    const comp = (key: string) => rating.components.find((c) => c.key === key)
    const rows: [string, string][] = []
    const inState = starPart(report, "Best in-state finish") ?? comp("instate")?.detail
    if (inState) rows.push(["In-state performance", inState])
    const wins = starPart(report, "Significant wins")
    if (wins) rows.push(["Significant wins", wins])
    const national = [starPart(report, "National placement"), starPart(report, "National record")].filter(Boolean).join(" · ")
    if (national || comp("nationals")?.detail) rows.push(["National competition", national || comp("nationals")!.detail])
    if (comp("ranking")?.detail) rows.push(["RecruitNC ranking", comp("ranking")!.detail])
    return rows
  })()

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.masthead}>
        <Text style={styles.mastheadTitle}>NC UNITED · PROSPECT SCOUTING REPORT</Text>
        <Text style={styles.mastheadMeta}>
          {fileNumber} · {dayLabel(report.generatedAt.slice(0, 10))} · <Text style={styles.confidential}>CONFIDENTIAL</Text>
        </Text>
      </View>

      <View style={styles.hero}>
        {identity.photoUrl ? (
          <Image source={{ uri: identity.photoUrl }} style={styles.photo} contentFit="cover" contentPosition="top" />
        ) : null}
        <View style={styles.flex}>
          <Text style={styles.name} maxFontSizeMultiplier={1.3}>
            {identity.name.toUpperCase()}
          </Text>
          {report.starRating ? (
            <View style={styles.starLine}>
              <Stars stars={report.starRating.stars} />
              <Text style={styles.prospect}>{report.starRating.stars}-STAR PROSPECT</Text>
            </View>
          ) : null}
          <Text style={styles.rankLine}>
            {[
              report.rankingPublished && report.prospectRanking ? `RecruitNC #${report.prospectRanking}` : null,
              identity.graduationYear ? `Class of ${identity.graduationYear}` : null,
            ]
              .filter(Boolean)
              .join("  ·  ")}
          </Text>
          {report.nationalRankings[0] ? (
            <Text style={styles.nationalLine}>
              National #{report.nationalRankings[0].current} · {report.nationalRankings[0].sourceLabel}
            </Text>
          ) : null}
          <Text style={styles.status}>{statusLine(report).toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.idLines}>
        {[
          identity.weightClass ? `${identity.weightClass} lbs` : null,
          identity.lastCompetedWeight && String(identity.lastCompetedWeight) !== String(identity.weightClass)
            ? `last competed ${identity.lastCompetedWeight}`
            : null,
          identity.highSchool,
          identity.club,
          membership.ncUnitedTeam ? `NC United ${membership.ncUnitedTeam.charAt(0).toUpperCase()}${membership.ncUnitedTeam.slice(1)}` : null,
        ]
          .filter(Boolean)
          .join("  ·  ")}
      </Text>

      {/* Contact: discover, evaluate, contact. A minor's number only ever for the full tier. */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>CONTACT</Text>
        {full ? (
          <>
            <ContactRow label="Text" value={contact.cell} url={contact.cell ? `sms:${digits(contact.cell)}` : null} />
            <ContactRow label="Call" value={contact.cell} url={contact.cell ? `tel:${digits(contact.cell)}` : null} />
            <ContactRow label="Email" value={contact.email} url={contact.email ? `mailto:${contact.email}` : null} />
          </>
        ) : null}
        <ContactRow label="Instagram" value={handle ? `@${handle}` : null} url={contact.instagramUrl ?? null} />
        {!full ? <Note>Cell and email are released to verified college coaching staff.</Note> : null}
        {[
          ["Highlight film", contact.highlightVideoUrl],
          ["FloWrestling", contact.floProfileUrl],
          ["TrackWrestling", contact.trackWrestlingProfileUrl],
        ].map(([label, url]) =>
          url ? (
            <Pressable key={label} style={styles.linkRow} onPress={() => openLink(url)}>
              <Text style={styles.rowLeft}>{label}</Text>
              <Ionicons name="open-outline" size={16} color={colors.gold} />
            </Pressable>
          ) : null,
        )}
      </View>

      {snapshot.length ? (
        <View>
          <Text style={styles.sectionLabel}>RECRUITING SNAPSHOT</Text>
          <View style={styles.summaryGrid}>
            {snapshot.map((f) => (
              <SummaryCard key={f.label} label={f.label} value={f.value} sub={f.sub} />
            ))}
          </View>
        </View>
      ) : null}

      {facts.length || report.summary ? (
        <Block n={n()} title="Evaluation">
          {facts.map((fact) => (
            <View key={fact} style={styles.fact}>
              <View style={styles.factDot} />
              <Text style={styles.factText}>{fact}</Text>
            </View>
          ))}
          {report.summary ? <Text style={[styles.body, facts.length ? styles.gapTop : null]}>{report.summary}</Text> : null}
        </Block>
      ) : null}

      <Block n={n()} title="Academics">
        {!full ? (
          <Note>
            Academic records are released to verified college coaching staff.
            {academics.academicInterest ? ` Intended major: ${academics.academicInterest}.` : ""}
          </Note>
        ) : (
          <View style={styles.summaryGrid}>
            <SummaryCard label="GPA" value={academics.gpa ?? "—"} />
            <SummaryCard label="SAT" value={academics.sat ?? "—"} />
            <SummaryCard label="ACT" value={academics.act ?? "—"} />
            <SummaryCard label="Intended major" value={academics.academicInterest ?? "—"} small />
          </View>
        )}
        {academics.academicSummary ? <Text style={[styles.body, styles.gapTop]}>{academics.academicSummary}</Text> : null}
      </Block>

      {report.starRating ? (
        <Block n={n()} title="Star rating">
          <View style={styles.starLine}>
            <Stars stars={report.starRating.stars} />
            <Text style={styles.prospect}>{report.starRating.stars}-STAR PROSPECT</Text>
          </View>
          {report.starRating.floor ? <Text style={styles.rowSub}>{report.starRating.floor}</Text> : null}
          {report.starRating.provisional ? <Text style={styles.rowSub}>Provisional: thin record on file</Text> : null}
          {starRows.map(([label, value]) => (
            <View key={label} style={styles.row}>
              <Text style={styles.starRowLabel}>{label.toUpperCase()}</Text>
              <Text style={styles.rowSub}>{value}</Text>
            </View>
          ))}
        </Block>
      ) : null}

      {report.seasonStrength && report.seasonStrength.bouts > 0 ? (
        <Block n={n()} title="Competition profile">
          <View style={styles.summaryGrid}>
            <SummaryCard
              label="In-season record"
              value={`${report.seasonStrength.wins}-${report.seasonStrength.losses}`}
              sub={report.seasonStrengthSeason ?? undefined}
            />
            <SummaryCard label="Wins over ranked" value={String(soc.rankedWins.total)} />
            <SummaryCard label="National events" value={String(soc.nationalEvents?.length ?? report.competition?.nationalEvents.length ?? 0)} />
            <SummaryCard label="Post/preseason events" value={String(soc.offSeasonEvents ?? 0)} />
            <SummaryCard
              label="Last competed"
              value={identity.lastCompetedWeight ? `${identity.lastCompetedWeight} lbs` : "—"}
              sub={identity.lastCompetedEvent ?? undefined}
            />
          </View>
          <Text style={styles.lines}>
            <Text style={styles.linesStrong}>Ranked wins: </Text>
            {soc.rankedWins.national} nationally ranked · {soc.rankedWins.stateRanked} NC-ranked · {soc.rankedWins.tocField} Tournament
            of Champions field. <Text style={styles.linesStrong}>Losses to ranked opponents: </Text>
            {soc.credentialedLosses}, listed under Notable losses.
          </Text>
          {progression ? (
            <Text style={styles.lines}>
              <Text style={styles.linesStrong}>Competed at: </Text>
              {progression}
            </Text>
          ) : null}
          <Text style={styles.lines}>
            <Text style={styles.linesStrong}>Competition level: </Text>
            {soc.grade.label}. {soc.grade.verdict}
            {soc.grade.nextStep ? ` Next step: ${soc.grade.nextStep}` : ""}
          </Text>
        </Block>
      ) : null}

      {report.nationalRankings.length ? (
        <Block n={n()} title="National ranking history">
          {report.nationalRankings.map((series) => (
            <Row
              key={series.source}
              left={series.sourceLabel}
              right={`#${series.current} · ${movementLabel(series.movement)}`}
              sub={series.editions.map((e) => `${monthLabel(e.rankingMonth)} #${e.rank}`).join(" · ")}
            />
          ))}
        </Block>
      ) : null}

      <StyleDivider title="FOLKSTYLE" note="NCHSAA State Championships, national tournaments, duals and the high-school season" />
      <Block n={n()} title="Competition record — Folkstyle">
        <Results rows={folkResults} empty="No folkstyle tournament results on file." />
      </Block>
      <Block n={n()} title="Significant wins — Folkstyle" count={folkWins.length}>
        <Bouts rows={folkWins} kind="win" />
      </Block>
      <Block n={n()} title="Notable losses — Folkstyle" count={folkLosses.length}>
        <Bouts rows={folkLosses} kind="loss" />
      </Block>

      {olyResults.length || olyWins.length || olyLosses.length ? (
        <>
          <StyleDivider title="OLYMPIC STYLES — FREESTYLE & GRECO-ROMAN" note="USA Wrestling events — not folkstyle, and not part of the record above" />
          <Block n={n()} title="Individual results">
            <Results rows={olyIndividual} empty="No individual freestyle or Greco results on file." />
          </Block>
          {olyDuals.length ? (
            <Block n={n()} title="Dual results">
              <Results rows={olyDuals} empty="" />
            </Block>
          ) : null}
          <Block n={n()} title="Significant wins — Freestyle & Greco" count={olyWins.length}>
            <Bouts rows={olyWins} kind="win" />
          </Block>
          <Block n={n()} title="Notable losses — Freestyle & Greco" count={olyLosses.length}>
            <Bouts rows={olyLosses} kind="loss" />
          </Block>
        </>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.fine}>
          <Text style={styles.fineStrong}>METHOD. </Text>
          Significant results are those against wrestlers ranked nationally by FloWrestling, Sports Illustrated or MatScouts,
          ranked as North Carolina prospects, NCHSAA/NCISA state champions or placers (top 8), and national tournament
          placers. In-state and national are split by the opponent, not the event. Routine results are omitted by design.
        </Text>
        {report.starRating ? (
          <Text style={styles.fine}>
            <Text style={styles.fineStrong}>STAR RATING. </Text>
            Built only from results on file, never a projection of college ceiling. Three equal parts: in-state performance,
            nationals, and the RecruitNC class ranking. Five stars requires a current national ranking and a top-eight finish
            at Super 32.
          </Text>
        ) : null}
        <Text style={styles.fine}>
          <Text style={styles.fineStrong}>CONFIDENTIAL. </Text>
          {report.watermark
            ? `${report.watermark}. Contains contact information for a prospective student-athlete; do not redistribute. This copy is traceable to the recipient named above.`
            : "Competition analysis only. Contact details and academic records are released to verified college coaching staff."}{" "}
          File {fileNumber} · NC United Wrestling / RecruitNC.
        </Text>
      </View>
    </ScrollView>
  )
}

export default function ScoutingReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [report, setReport] = useState<ScoutingReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)

  const sharePdf = async () => {
    if (!report || sharing) return
    setSharing(true)
    const result = await shareScoutingReportPdf(report)
    setSharing(false)
    if (result === "unavailable") openWebPage(`/athletes/${encodeURIComponent(String(id))}/scouting-report`)
    else if (result === "failed") Alert.alert("Could not make the PDF", "Try again in a moment.")
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setReport(await fetchScoutingReport(String(id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the scouting report.")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.gold} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        {report ? (
          <Pressable
            hitSlop={12}
            style={styles.back}
            disabled={sharing}
            onPress={() => void sharePdf()}
            accessibilityLabel="Share the scouting report as a PDF"
          >
            {sharing ? (
              <ActivityIndicator size="small" color={colors.gold} />
            ) : (
              <Ionicons name="share-outline" size={18} color={colors.gold} />
            )}
            <Text style={styles.backText}> PDF</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.gold} />
          <Text style={styles.muted}>Building scouting report…</Text>
        </View>
      ) : error || !report ? (
        <View style={styles.centre}>
          <Text style={styles.error}>{error ?? "No report."}</Text>
          <Pressable style={styles.retry} onPress={() => void load()}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <Report report={report} />
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
  navBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  back: { flexDirection: "row", alignItems: "center" },
  backText: { ...type.label, color: colors.gold },
  muted: { ...type.label, color: colors.textMuted },

  masthead: { borderBottomWidth: 2, borderBottomColor: colors.gold, paddingBottom: space.sm },
  mastheadTitle: { ...type.caption, color: colors.gold, letterSpacing: 1.6 },
  mastheadMeta: { ...type.caption, color: colors.textMuted, marginTop: 2, fontWeight: "600" },

  hero: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  photo: { width: 84, height: 104, borderRadius: radius.sm, backgroundColor: colors.surface },
  name: { ...type.title, color: colors.text },
  starLine: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.xs },
  stars: { flexDirection: "row", gap: 1 },
  caption: { ...type.caption, color: colors.textSecondary },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.sm },
  chip: {
    ...type.caption,
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  chipOutline: { color: colors.textSecondary, borderWidth: 1, borderColor: colors.line },
  chip_national: { backgroundColor: colors.gold, color: colors.ink },
  chip_instate: { borderWidth: 1, borderColor: colors.gold, color: colors.gold },
  chip_placer: { borderWidth: 1, borderColor: colors.textMuted, color: colors.textSecondary },
  confidential: { color: colors.red, fontWeight: "800" },
  prospect: { fontSize: 11, fontWeight: "900", letterSpacing: 1.6, color: colors.gold },
  rankLine: { ...type.label, color: colors.text, fontWeight: "800", marginTop: space.xs },
  nationalLine: { ...type.label, color: colors.textSecondary, marginTop: 2 },
  status: {
    alignSelf: "flex-start",
    marginTop: space.sm,
    borderWidth: 2,
    borderColor: colors.gold,
    color: colors.gold,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.6,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  idLines: { ...type.label, color: colors.textSecondary, fontWeight: "500", lineHeight: 19 },
  cardTitle: { ...type.caption, color: colors.gold, letterSpacing: 2, marginTop: space.xs, marginBottom: 2 },
  contactRow: {
    flexDirection: "row",
    gap: space.md,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  contactLabel: { ...type.caption, color: colors.textMuted, width: 82, paddingTop: 2 },
  contactValue: { ...type.label, color: colors.text, flex: 1, flexShrink: 1 },
  sectionLabel: { ...type.caption, color: colors.text, letterSpacing: 2, marginBottom: space.sm },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  summaryCard: {
    width: "48.5%",
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: space.sm,
  },
  summaryLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1.2, color: colors.textMuted },
  summaryValue: { fontSize: 22, fontWeight: "900", color: colors.text, marginTop: 2 },
  summaryValueSmall: { fontSize: 14, fontWeight: "800", color: colors.text, marginTop: 4 },
  summarySub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  fact: { flexDirection: "row", gap: space.sm, paddingVertical: 3 },
  factDot: { width: 6, height: 6, backgroundColor: colors.gold, marginTop: 6 },
  factText: { ...type.label, color: colors.text, fontWeight: "500", flex: 1, lineHeight: 18 },
  starRowLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2, color: colors.gold },
  lines: { fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: space.sm },
  linesStrong: { color: colors.text, fontWeight: "800" },
  scopeHead: { ...type.caption, color: colors.red, marginTop: space.sm, letterSpacing: 1.4 },
  rowSubInline: { fontSize: 12, fontWeight: "500", color: colors.textMuted },
  divider: { backgroundColor: colors.raised, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm, marginTop: space.md },
  dividerTitle: { fontSize: 12, fontWeight: "900", letterSpacing: 2, color: colors.text },
  dividerNote: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  vital: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: space.md,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  vitalLabel: { ...type.caption, color: colors.textMuted, paddingTop: 2 },
  vitalValue: { ...type.label, color: colors.text, flex: 1, textAlign: "right" },
  link: { color: colors.gold, textDecorationLine: "underline" },

  block: { gap: space.sm, marginTop: space.sm },
  blockHead: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  blockNumber: { ...type.caption, color: colors.gold },
  blockTitle: { ...type.caption, color: colors.text, letterSpacing: 1.4 },
  blockCount: { ...type.caption, color: colors.textMuted, marginLeft: "auto", fontWeight: "600" },

  body: { ...type.body, fontSize: 14, lineHeight: 21, color: colors.text, fontWeight: "400" },
  gapTop: { marginTop: space.sm },
  note: { ...type.label, color: colors.textSecondary, fontStyle: "italic", fontWeight: "500", paddingVertical: space.xs },
  fine: { fontSize: 11, lineHeight: 16, color: colors.textMuted, marginTop: space.sm },
  fineStrong: { color: colors.gold, fontWeight: "800" },

  row: { paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, gap: 3 },
  rowMain: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space.md },
  rowLeft: { ...type.label, color: colors.text, fontWeight: "700", flex: 1 },
  rowRight: { ...type.label, color: colors.textSecondary, fontVariant: ["tabular-nums"] },
  rowSub: { ...type.label, fontSize: 12, color: colors.textSecondary, fontWeight: "500", flexShrink: 1 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },

  win: { color: colors.success },
  loss: { color: colors.textMuted },
  boutGroup: { marginBottom: space.sm },
  boutGroupHead: { ...type.caption, color: colors.gold, marginTop: space.sm },
  boutMeta: { flexDirection: "row", alignItems: "center", gap: space.sm },

  grade: { borderWidth: 1, borderRadius: radius.sm, padding: space.md, marginTop: space.md, gap: space.xs },
  gradeLabel: { ...type.label, fontWeight: "800", letterSpacing: 0.6 },
  factor: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  factorLabel: { color: colors.text, fontWeight: "700" },
  nextStep: { ...type.label, color: colors.text, fontWeight: "700", marginTop: space.xs },

  footer: { borderTopWidth: 2, borderTopColor: colors.gold, marginTop: space.lg, paddingTop: space.xs },
})
