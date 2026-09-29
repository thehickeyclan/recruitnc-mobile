import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Image } from "expo-image"
import * as WebBrowser from "expo-web-browser"
import { router, useLocalSearchParams } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { fetchScoutingReport } from "@/lib/scouting-report"
import { openWebPage } from "@/lib/profile-link"
import {
  STANDING_LABEL,
  dayLabel,
  groupBouts,
  lastCompetedLine,
  monthLabel,
  movementLabel,
  noBoutsLine,
  statusLine,
  weightProgression,
  type ReportBout,
  type ScoutingReport,
} from "@/lib/scouting-report-format"

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
 * The PDF still comes from the website (the print layout lives there), opened signed in.
 */

const BAND_COLOR: Record<ScoutingReport["strengthOfCompetition"]["grade"]["band"], string> = {
  green: colors.success,
  amber: colors.warning,
  orange: "#E08A3C",
  red: colors.red,
}

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

function Bouts({ rows, kind }: { rows: ReportBout[]; kind: "win" | "loss" }) {
  const groups = groupBouts(rows, kind)
  if (!groups.length) return <Note>{noBoutsLine(kind)}</Note>
  return (
    <>
      {groups.map((group) => (
        <View key={group.heading} style={styles.boutGroup}>
          <Text style={styles.boutGroupHead}>
            {group.heading} <Text style={styles.muted}>({group.rows.length})</Text>
          </Text>
          {group.rows.map((bout, i) => (
            <View key={`${bout.opponent}-${i}`} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowLeft}>{bout.opponent}</Text>
                <Text style={[styles.rowRight, kind === "win" ? styles.win : styles.loss]}>{bout.result ?? "—"}</Text>
              </View>
              <View style={styles.boutMeta}>
                <Text style={[styles.chip, chipStyle(bout.reason)]}>
                  {STANDING_LABEL[bout.reason]}
                </Text>
                <Text style={styles.rowSub} numberOfLines={2}>
                  {[bout.opponentSchool, bout.nationalRankLabel, bout.stateLabel].filter(Boolean).join(" · ") || "—"}
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

function chipStyle(reason: ReportBout["reason"]) {
  switch (reason) {
    case "national-ranked":
      return styles.chip_national_ranked
    case "toc-field":
      return styles.chip_toc_field
    case "ranked":
      return styles.chip_ranked
    case "state-champion":
      return styles.chip_state_champion
    case "state-placer":
      return styles.chip_state_placer
  }
}

function openLink(url: string) {
  void WebBrowser.openBrowserAsync(url).catch(() => undefined)
}

function Report({ report }: { report: ScoutingReport }) {
  const { identity, academics, membership, contact } = report
  const full = report.accessTier === "full"
  const progression = weightProgression(report.results)
  const fileNumber = `NCU-${report.athleteId.slice(0, 8).toUpperCase()}`
  let section = 0
  const n = () => ++section

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.masthead}>
        <Text style={styles.mastheadTitle}>PROSPECT SCOUTING REPORT</Text>
        <Text style={styles.mastheadMeta}>
          {fileNumber} · {dayLabel(report.generatedAt.slice(0, 10))} · CONFIDENTIAL
        </Text>
      </View>

      <View style={styles.hero}>
        {identity.photoUrl ? (
          <Image source={{ uri: identity.photoUrl }} style={styles.photo} contentFit="cover" contentPosition="top" />
        ) : null}
        <View style={styles.flex}>
          <Text style={styles.name} maxFontSizeMultiplier={1.3}>
            {identity.name}
          </Text>
          {report.starRating ? (
            <View style={styles.starLine}>
              <Stars stars={report.starRating.stars} />
              <Text style={styles.caption}>
                {report.starRating.stars} STAR{report.starRating.stars === 1 ? "" : "S"}
                {report.starRating.provisional ? " · PROVISIONAL" : ""}
              </Text>
            </View>
          ) : null}
          <View style={styles.chips}>
            {report.nationalRankings[0] ? (
              <Text style={[styles.chip, styles.chip_national_ranked]}>
                National #{report.nationalRankings[0].current} · {report.nationalRankings[0].sourceLabel}
              </Text>
            ) : null}
            {report.rankingPublished && report.prospectRanking ? (
              <Text style={[styles.chip, styles.chip_toc_field]}>
                NC #{report.prospectRanking} · Class of {identity.graduationYear}
              </Text>
            ) : null}
            {membership.ncUnitedTeam ? (
              <Text style={[styles.chip, styles.chip_ranked]}>NC United {membership.ncUnitedTeam}</Text>
            ) : null}
            <Text style={[styles.chip, styles.chipOutline]}>{statusLine(report)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Vital label="Class" value={identity.graduationYear ? String(identity.graduationYear) : null} />
        <Vital label="Listed weight" value={identity.weightClass ? `${identity.weightClass} lbs` : null} />
        <Vital label="Last competed" value={lastCompetedLine(identity)} />
        <Vital
          label="Projected college"
          value={identity.collegeWeightClass ? `${identity.collegeWeightClass} lbs · athlete-stated` : null}
        />
        <Vital label="High school" value={identity.highSchool} />
        <Vital label="Club" value={identity.club} />
        <Vital label="Career" value={report.careerRecord} />
        <Vital label="Cell" value={contact.cell} onPress={contact.cell ? () => void Linking.openURL(`tel:${contact.cell}`) : undefined} />
        <Vital label="Email" value={contact.email} onPress={contact.email ? () => void Linking.openURL(`mailto:${contact.email}`) : undefined} />
        {!full ? <Note>Contact details released to verified college coaching staff.</Note> : null}
      </View>

      {report.summary ? (
        <Block n={n()} title="Evaluation">
          <Text style={styles.body}>{report.summary}</Text>
        </Block>
      ) : null}

      {contact.highlightVideoUrl || contact.floProfileUrl || contact.trackWrestlingProfileUrl ? (
        <Block n={n()} title="Film and profiles">
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
        </Block>
      ) : null}

      <Block n={n()} title="Academics">
        {!full ? (
          <Note>
            Academic records are released to verified college coaching staff.
            {academics.academicInterest ? ` Intended major: ${academics.academicInterest}.` : ""}
          </Note>
        ) : academics.gpa || academics.sat || academics.act || academics.academicInterest ? (
          <>
            <Vital label="GPA" value={academics.gpa ?? "—"} />
            <Vital label="SAT" value={academics.sat ?? "—"} />
            <Vital label="ACT" value={academics.act ?? "—"} />
            <Vital label="Intended major" value={academics.academicInterest ?? "—"} />
          </>
        ) : (
          <Note>No academic information on file.</Note>
        )}
        {academics.academicSummary ? <Text style={[styles.body, styles.gapTop]}>{academics.academicSummary}</Text> : null}
      </Block>

      {report.starRating ? (
        <Block n={n()} title="Star rating">
          <View style={styles.starLine}>
            <Stars stars={report.starRating.stars} />
            <Text style={styles.caption}>
              {report.starRating.score}/100{report.starRating.provisional ? " · PROVISIONAL, THIN RECORD ON FILE" : ""}
            </Text>
          </View>
          {report.starRating.components.map((c) => (
            <Row key={c.key} left={c.label} right={`${c.points}/${c.max}`} sub={c.detail} />
          ))}
          <Text style={styles.fine}>
            Built only from results on file, never a projection of college ceiling. Five stars requires a current
            national ranking from FloWrestling, Sports Illustrated or MatScouts and a record that independently earns
            four. Rated for the classes RecruitNC ranks.
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
          <Text style={styles.fine}>
            Weight class as published by the outlet. Only the most recent monthly editions are retained, so movement
            describes that window and no further back.
          </Text>
        </Block>
      ) : null}

      {report.seasonStrength && report.seasonStrength.bouts > 0 ? (
        <Block n={n()} title="Strength of competition">
          <Row
            left="In-season record"
            right={`${report.seasonStrength.wins}-${report.seasonStrength.losses}`}
            sub={`${report.seasonStrength.bouts} bouts${
              report.seasonStrengthSeason ? ` in the ${report.seasonStrengthSeason} season` : ""
            } — duals, tris, invitationals and the NCHSAA postseason. National events are under Competition record.`}
          />
          <Row
            left="Wins over ranked opponents"
            right={String(report.strengthOfCompetition.rankedWins.total)}
            sub={`${report.strengthOfCompetition.rankedWins.national} nationally ranked · ${report.strengthOfCompetition.rankedWins.tocField} TOC field · ${report.strengthOfCompetition.rankedWins.stateRanked} NC ranked`}
          />
          <Row
            left="Losses to ranked opponents"
            right={String(report.strengthOfCompetition.credentialedLosses)}
            sub="Listed in full under Notable losses"
          />
          {progression ? <Row left="Competed at" sub={progression} /> : null}

          <View style={[styles.grade, { borderColor: BAND_COLOR[report.strengthOfCompetition.grade.band] }]}>
            <View style={styles.rowMain}>
              <Text style={[styles.gradeLabel, { color: BAND_COLOR[report.strengthOfCompetition.grade.band] }]}>
                {report.strengthOfCompetition.grade.label.toUpperCase()}
              </Text>
              <Text style={styles.rowRight}>{report.strengthOfCompetition.grade.score}/6</Text>
            </View>
            <Text style={styles.body}>{report.strengthOfCompetition.grade.verdict}</Text>
            {report.strengthOfCompetition.grade.factors.map((factor) => (
              <View key={factor.key} style={styles.factor}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: factor.points === 2 ? colors.success : factor.points === 1 ? colors.warning : colors.red },
                  ]}
                />
                <Text style={styles.rowSub}>
                  <Text style={styles.factorLabel}>{factor.label}: </Text>
                  {factor.detail}
                </Text>
              </View>
            ))}
            {report.strengthOfCompetition.grade.nextStep ? (
              <Text style={styles.nextStep}>Next step: {report.strengthOfCompetition.grade.nextStep}</Text>
            ) : null}
          </View>
          {report.strengthOfCompetition.seasonsOnFile <= 1 ? (
            <Text style={[styles.fine, { color: colors.warning }]}>
              One season on file. A wrestler who transferred in, or is in their first year, will read as quiet here
              whatever they have done elsewhere.
            </Text>
          ) : null}
        </Block>
      ) : null}

      <Block n={n()} title="Competition record">
        {report.results.length ? (
          report.results.map((row, i) => (
            <Row key={i} left={row.event} right={row.date ? dayLabel(row.date) : String(row.year)} sub={row.detail} />
          ))
        ) : (
          <Note>No tournament results on file.</Note>
        )}
      </Block>

      <Block n={n()} title="Significant wins" count={report.significantWins.length}>
        <Bouts rows={report.significantWins} kind="win" />
      </Block>

      <Block n={n()} title="Notable losses" count={report.significantLosses.length}>
        <Bouts rows={report.significantLosses} kind="loss" />
      </Block>

      <View style={styles.footer}>
        <Text style={styles.fine}>
          <Text style={styles.fineStrong}>METHOD. </Text>
          Significant results are those against wrestlers ranked nationally by FloWrestling, Sports Illustrated or
          MatScouts, ranked as North Carolina prospects, or who are NCHSAA/NCISAA state champions or placers (top 8).
          This is not a complete match list — routine results are omitted by design.
        </Text>
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
            onPress={() => openWebPage(`/athletes/${encodeURIComponent(String(id))}/scouting-report`)}
            accessibilityLabel="Open the printable PDF on the web"
          >
            <Ionicons name="document-text-outline" size={18} color={colors.gold} />
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
  chip_national_ranked: { backgroundColor: colors.red, color: colors.text },
  chip_toc_field: { backgroundColor: colors.gold, color: colors.ink },
  chip_ranked: { backgroundColor: colors.raised, color: colors.text },
  chip_state_champion: { backgroundColor: "#1f6f43", color: colors.text },
  chip_state_placer: { backgroundColor: colors.line, color: colors.text },

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
