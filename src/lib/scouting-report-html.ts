/**
 * The scouting report as a printable HTML document, for turning into a PDF on the phone.
 *
 * Mirrors the website's printed dossier — its colours, numbered sections and wording — so a coach
 * who saves one from the app and one from a laptop is holding the same document. Built from the
 * report JSON the screen already has, so nothing is fetched twice.
 *
 * Every string from the report is escaped: names and event titles come from imported data, and an
 * ampersand in "Mitchell Co & Ashe Co Tri Match" is the gentle version of what that can hold.
 *
 * Kept free of react-native imports so it can be tested.
 */
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
} from "./scouting-report-format"
import { keyFacts, snapshotFigures, starPart } from "./scouting-report-snapshot"

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** "Carson Worrick Scouting Report.pdf" — what Mail and Files show, instead of a random id. */
export function pdfFileName(name: string): string {
  const safe = name.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim()
  return `${safe || "Athlete"} Scouting Report.pdf`
}

// Navy fill for the national claims, outline for in-state, grey for placers: told apart by fill,
// not hue, so the distinction survives a greyscale printer (the website report's rule).
const STANDING_STYLE: Record<ReportBout["reason"], string> = {
  "national-ranked": "background:#03154C;color:#fff",
  "national-placer": "background:#03154C;color:#fff",
  ranked: "border:1px solid #03154C;color:#03154C",
  "toc-field": "border:1px solid #03154C;color:#03154C",
  "state-champion": "border:1px solid #03154C;color:#03154C",
  "state-placer": "border:1px solid #6b7280;color:#374151",
}

const e = escapeHtml

function note(text: string): string {
  return `<p class="note">${e(text)}</p>`
}

function table(head: string[], rows: string[][], cls = "grid"): string {
  return `<table class="${cls}"><thead><tr>${head.map((h) => `<th>${e(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`
}

function card(label: string, value: string, sub?: string, small = false): string {
  return `<div class="card"><div class="cl">${e(label)}</div><div class="cv${small ? " small" : ""}">${e(value)}</div>${sub ? `<div class="cs">${e(sub)}</div>` : ""}</div>`
}

function boutTable(rows: ReportBout[]): string {
  return table(
    ["Opponent", "Affiliation", "Standing", "Result", "Event", "Date"],
    rows.map((b) => [
      `<b>${e(b.opponent)}</b>`,
      e(b.opponentSchool ?? "—"),
      `<span class="chip" style="${STANDING_STYLE[b.reason]}">${e(STANDING_LABEL[b.reason])}</span>` +
        [b.nationalRankLabel, b.stateLabel, b.fargoLabel, b.credential].filter(Boolean).map((l) => `<div class="sub">${e(l)}</div>`).join(""),
      `<span class="mono">${e(b.result ?? "—")}</span>`,
      e(b.event ?? "—"),
      `<span class="nowrap mono">${e(b.date ? dayLabel(b.date) : "—")}</span>`,
    ]),
  )
}

/** In-state, then national (out-of-state opponents), each split by standing - as the website prints it. */
function bouts(rows: ReportBout[], kind: "win" | "loss"): string {
  if (!rows.length) return note(noBoutsLine(kind))
  const scopes = [
    { title: "In-state", rows: rows.filter((r) => !isOutOfState(r)) },
    { title: "National (out-of-state opponents)", rows: rows.filter(isOutOfState) },
  ].filter((s) => s.rows.length)
  return scopes
    .map(
      (scope) =>
        `<h3>${e(scope.title)} <span class="muted">(${scope.rows.length})</span></h3>` +
        groupBouts(scope.rows, kind)
          .map((g) => `<h4>${e(g.heading)} <span class="muted">(${g.rows.length})</span></h4>${boutTable(g.rows)}`)
          .join(""),
    )
    .join("")
}

function resultsTable(rows: ScoutingReport["results"]): string {
  return table(
    ["Date", "Event", "Result"],
    rows.map((r) => [`<span class="nowrap mono">${e(r.date ? dayLabel(r.date) : r.year)}</span>`, `<b>${e(r.event)}</b>`, e(r.detail)]),
    "grid results",
  )
}

/**
 * The scouting report as a printable document. Mirrors the website's redesigned report (Oct 2026):
 * identity header with contact, recruiting snapshot, key facts, academics, a plain star rating,
 * the competition profile, then folkstyle and - last, behind its own divider - Freestyle &
 * Greco-Roman. The full star-rating method sits in the footer.
 */
export function reportHtml(report: ScoutingReport): string {
  const { identity, academics, membership, contact } = report
  const full = report.accessTier === "full"
  const fileNumber = `NCU-${report.athleteId.slice(0, 8).toUpperCase()}`
  const issued = dayLabel(report.generatedAt.slice(0, 10))
  let n = 0
  const block = (title: string, body: string, count?: number) =>
    `<section><div class="head"><span class="num">${String(++n).padStart(2, "0")}</span><h2>${e(title)}</h2>${
      count !== undefined ? `<span class="count">${count} recorded</span>` : ""
    }</div>${body}</section>`
  const stars = (count: number) => `<span class="stars">${[1, 2, 3, 4, 5].map((i) => (i <= count ? "★" : "☆")).join("")}</span>`

  const styleOf = (r: { event: string | null; style?: ScoutingReport["results"][number]["style"] }) => r.style ?? styleOfEvent(r.event)
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
  const handle = contact.instagramUrl?.replace(/^https:\/\/www\.instagram\.com\//, "")

  const contactLine = (label: string, value: string | null | undefined, href: string | null) =>
    `<tr><th>${e(label)}</th><td>${value && href ? `<a href="${e(href)}">${e(value)}</a>` : e(value ?? "—")}</td></tr>`
  const digits = (v: string) => v.replace(/[^\d+]/g, "")

  const sections: string[] = []
  if (facts.length || report.summary) {
    sections.push(
      block(
        "Evaluation",
        (facts.length ? `<ul class="facts">${facts.map((f) => `<li>${e(f)}</li>`).join("")}</ul>` : "") +
          (report.summary ? `<p class="serif">${e(report.summary)}</p>` : ""),
      ),
    )
  }
  sections.push(
    block(
      "Academics",
      (!full
        ? note(`Academic records are released to verified college coaching staff.${academics.academicInterest ? ` Intended major: ${academics.academicInterest}.` : ""}`)
        : `<div class="cards c4">${card("GPA", academics.gpa ?? "—")}${card("SAT", academics.sat ?? "—")}${card("ACT", academics.act ?? "—")}${card("Intended major", academics.academicInterest ?? "—", undefined, true)}</div>`) +
        (academics.academicSummary ? `<p class="serif">${e(academics.academicSummary)}</p>` : ""),
    ),
  )
  if (report.starRating) {
    const comp = (key: string) => report.starRating!.components.find((c) => c.key === key)
    const rows: [string, string][] = []
    const inState = starPart(report, "Best in-state finish") ?? comp("instate")?.detail
    if (inState) rows.push(["In-state performance", inState])
    const wins = starPart(report, "Significant wins")
    if (wins) rows.push(["Significant wins", wins])
    const national = [starPart(report, "National placement"), starPart(report, "National record")].filter(Boolean).join(" · ")
    if (national || comp("nationals")?.detail) rows.push(["National competition", national || comp("nationals")!.detail])
    if (comp("ranking")?.detail) rows.push(["RecruitNC ranking", comp("ranking")!.detail])
    sections.push(
      block(
        "Star rating",
        `<p class="starline">${stars(report.starRating.stars)} <b>${report.starRating.stars}-STAR PROSPECT</b>${report.starRating.floor ? ` <span class="sub inline">${e(report.starRating.floor)}</span>` : ""}${report.starRating.provisional ? ` <span class="sub inline">Provisional: thin record on file</span>` : ""}</p>` +
          `<table class="plain">${rows.map(([l, v]) => `<tr><th>${e(l)}</th><td>${e(v)}</td></tr>`).join("")}</table>`,
      ),
    )
  }
  const soc = report.strengthOfCompetition
  if (report.seasonStrength && report.seasonStrength.bouts > 0) {
    const progression = weightProgression(report.results)
    sections.push(
      block(
        "Competition profile",
        `<div class="cards c5">${card("In-season record", `${report.seasonStrength.wins}-${report.seasonStrength.losses}`, report.seasonStrengthSeason ?? undefined)}${card("Wins over ranked", String(soc.rankedWins.total))}${card("National events", String(soc.nationalEvents?.length ?? report.competition?.nationalEvents.length ?? 0))}${card("Post/preseason events", String(soc.offSeasonEvents ?? 0))}${card("Last competed", identity.lastCompetedWeight ? `${identity.lastCompetedWeight} lbs` : "—", identity.lastCompetedEvent ?? undefined)}</div>` +
          `<p class="lines"><b>Ranked wins:</b> ${soc.rankedWins.national} nationally ranked · ${soc.rankedWins.stateRanked} NC-ranked · ${soc.rankedWins.tocField} Tournament of Champions field. <b>Losses to ranked opponents:</b> ${soc.credentialedLosses}, listed under Notable losses.` +
          (progression ? `<br><b>Competed at:</b> ${e(progression)}` : "") +
          `<br><b>Competition level:</b> ${e(soc.grade.label)}. ${e(soc.grade.verdict)}${soc.grade.nextStep ? ` Next step: ${e(soc.grade.nextStep)}` : ""}</p>`,
      ),
    )
  }
  if (report.nationalRankings.length) {
    sections.push(
      block(
        "National ranking history",
        table(
          ["Outlet", "Current", "By month", "Movement"],
          report.nationalRankings.map((s) => [`<b>${e(s.sourceLabel)}</b>`, `#${s.current}`, e(s.editions.map((ed) => `${monthLabel(ed.rankingMonth)} #${ed.rank}`).join(" · ")), e(movementLabel(s.movement))]),
        ),
      ),
    )
  }
  sections.push(`<div class="divider"><b>FOLKSTYLE</b><span>NCHSAA State Championships, national tournaments, duals and the high-school season</span></div>`)
  sections.push(block("Competition record — Folkstyle", folkResults.length ? resultsTable(folkResults) : note("No folkstyle tournament results on file.")))
  sections.push(block("Significant wins — Folkstyle", bouts(folkWins, "win"), folkWins.length))
  sections.push(block("Notable losses — Folkstyle", bouts(folkLosses, "loss"), folkLosses.length))
  if (olyResults.length || olyWins.length || olyLosses.length) {
    sections.push(`<div class="divider"><b>OLYMPIC STYLES — FREESTYLE &amp; GRECO-ROMAN</b><span>USA Wrestling events — not folkstyle, and not part of the record above</span></div>`)
    sections.push(
      block(
        "Olympic Styles — Freestyle & Greco-Roman",
        `<h3>Individual results <span class="muted">(${olyIndividual.length})</span></h3>${olyIndividual.length ? resultsTable(olyIndividual) : note("No individual freestyle or Greco results on file.")}` +
          (olyDuals.length ? `<h3>Dual results <span class="muted">(${olyDuals.length})</span></h3>${resultsTable(olyDuals)}` : "") +
          `<h3>Significant wins <span class="muted">(${olyWins.length})</span></h3>${bouts(olyWins, "win")}` +
          `<h3>Notable losses <span class="muted">(${olyLosses.length})</span></h3>${bouts(olyLosses, "loss")}`,
      ),
    )
  }

  const confidential = report.watermark
    ? `${e(report.watermark)}. Contains contact information for a prospective student-athlete; do not redistribute. This copy is traceable to the recipient named above.`
    : "Competition analysis only. Contact details and academic records are released to verified college coaching staff."

  return `<!doctype html><html><head><meta charset="utf-8"><title>${e(pdfFileName(identity.name).replace(/\.pdf$/, ""))}</title><style>
  @page { margin: 0.45in; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1f2937; font-size: 11px; margin: 0; font-variant-numeric: tabular-nums; }
  ${report.watermark ? `body::before { content: "${e(report.watermark)}"; position: fixed; top: 45%; left: -10%; width: 120%; text-align: center; transform: rotate(-28deg); font-size: 30px; font-weight: 800; letter-spacing: .08em; color: rgba(3,21,76,.045); z-index: 0; }` : ""}
  .mast { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #03154C; padding-bottom: 7px; }
  .brand { font-size: 12px; font-weight: 900; letter-spacing: .2em; color: #03154C; text-transform: uppercase; }
  .kind { font-size: 9px; font-weight: 700; letter-spacing: .22em; color: #4b5563; text-transform: uppercase; }
  .file { text-align: right; font-size: 9.5px; color: #4b5563; line-height: 1.5; }
  .file b { color: #03154C; font-family: Menlo, monospace; }
  .conf { color: #B31B1B; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; }
  .subject { display: flex; gap: 16px; margin-top: 14px; align-items: flex-start; break-inside: avoid; }
  .photo { width: 120px; height: 150px; object-fit: cover; object-position: top; border: 1px solid #d1d5db; padding: 3px; }
  h1 { font-size: 28px; font-weight: 900; text-transform: uppercase; letter-spacing: -.01em; line-height: .95; margin: 0; color: #03154C; }
  .stars { color: #D3B574; font-size: 14px; letter-spacing: 1px; -webkit-text-stroke: .4px #9C7A2E; }
  .prospect { font-size: 10.5px; font-weight: 900; letter-spacing: .16em; color: #03154C; }
  .rank { font-size: 12.5px; font-weight: 700; color: #03154C; margin-top: 6px; }
  .status { display: inline-block; border: 2px solid #03154C; padding: 2px 9px; font-size: 10.5px; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; color: #03154C; margin-top: 8px; }
  .facts-id { margin-top: 8px; font-size: 11px; line-height: 1.5; }
  .contact { width: 2.5in; border: 1px solid #cfd6e0; background: #f3f5f8; padding: 8px 10px; }
  .contact .t { font-size: 9px; font-weight: 900; letter-spacing: .2em; color: #03154C; margin-bottom: 4px; }
  .contact table { border-collapse: collapse; width: 100%; font-size: 10.5px; }
  .contact th { text-align: left; font-size: 8.5px; font-weight: 900; letter-spacing: .14em; color: #03154C; text-transform: uppercase; padding: 2px 6px 2px 0; width: 5.2em; vertical-align: top; }
  .contact td { font-weight: 600; color: #111827; padding: 2px 0; word-break: break-word; }
  .snap { margin-top: 14px; break-inside: avoid; }
  .label { font-size: 9px; font-weight: 900; letter-spacing: .2em; color: #03154C; text-transform: uppercase; margin-bottom: 4px; }
  .cards { display: grid; gap: 6px; }
  .c4 { grid-template-columns: repeat(4, 1fr); } .c5 { grid-template-columns: repeat(5, 1fr); }
  .card { border: 1px solid #cfd6e0; background: #f3f5f8; padding: 6px 8px; min-width: 0; }
  .cl { font-size: 8px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #4b5563; }
  .cv { font-size: 18px; font-weight: 900; color: #03154C; line-height: 1.15; margin-top: 2px; }
  .cv.small { font-size: 11.5px; }
  .cs { font-size: 9px; color: #4b5563; margin-top: 2px; }
  section { margin-top: 16px; position: relative; z-index: 1; }
  .head { display: flex; align-items: baseline; gap: 8px; border-bottom: 2px solid #03154C; padding-bottom: 3px; margin-bottom: 6px; break-after: avoid; }
  .num { font-family: Menlo, monospace; font-size: 10px; font-weight: 700; color: #B31B1B; }
  h2 { font-size: 10.5px; font-weight: 900; letter-spacing: .18em; text-transform: uppercase; color: #03154C; margin: 0; }
  .count { margin-left: auto; font-family: Menlo, monospace; font-size: 9.5px; color: #4b5563; white-space: nowrap; }
  h3 { font-size: 10px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; color: #B31B1B; border-bottom: 1px solid rgba(3,21,76,.3); padding-bottom: 2px; margin: 12px 0 4px; break-after: avoid; }
  h4 { font-size: 9.5px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; color: #03154C; margin: 8px 0 3px; break-after: avoid; }
  ul.facts { columns: 2; column-gap: 24px; margin: 0; padding: 0; list-style: none; font-size: 11px; }
  ul.facts li { padding-left: 12px; position: relative; margin: 0 0 3px; break-inside: avoid; }
  ul.facts li::before { content: ""; position: absolute; left: 0; top: 5px; width: 6px; height: 6px; background: #03154C; }
  table.grid { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  table.grid th { text-align: left; font-size: 8.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #4b5563; border-bottom: 1px solid #9ca3af; padding: 0 6px 3px 0; }
  table.grid td { border-top: 1px solid #e5e7eb; padding: 4px 6px 4px 0; vertical-align: top; color: #1f2937; }
  table.grid td b { color: #03154C; }
  table.results th:nth-child(1) { width: 6.6rem; } table.results th:nth-child(2) { width: 15rem; }
  table.plain { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.plain th { text-align: left; width: 11rem; font-size: 9px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; color: #03154C; padding: 5px 10px 5px 0; vertical-align: top; border-top: 1px solid #d1d5db; }
  table.plain td { padding: 5px 0; border-top: 1px solid #d1d5db; color: #111827; }
  thead { display: table-header-group; }
  tr, li { break-inside: avoid; }
  .chip { display: inline-block; padding: 1px 4px; font-size: 8px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; }
  .sub { font-size: 8.5px; color: #4b5563; margin-top: 2px; } .sub.inline { display: inline; margin: 0 0 0 6px; font-size: 10px; }
  .starline { margin: 0 0 6px; } .starline b { font-size: 12px; letter-spacing: .16em; color: #03154C; margin-left: 6px; }
  .lines { font-size: 10px; line-height: 1.5; color: #374151; margin: 6px 0 0; } .lines b { color: #03154C; }
  .serif { font-family: Georgia, serif; font-size: 12px; line-height: 1.6; color: #111827; margin: 8px 0 0; }
  .note { font-family: Georgia, serif; font-style: italic; color: #4b5563; font-size: 11.5px; margin: 0; }
  .muted { color: #6b7280; font-family: Menlo, monospace; }
  .mono { font-family: Menlo, monospace; color: #1f2937; }
  .nowrap { white-space: nowrap; }
  .divider { margin-top: 22px; background: #03154C; color: #fff; padding: 7px 10px; break-inside: avoid; break-after: avoid; }
  .divider b { display: block; font-size: 11px; letter-spacing: .2em; } .divider span { font-size: 9px; opacity: .8; }
  a { color: #03154C; text-decoration: underline; }
  footer { margin-top: 22px; border-top: 2px solid #03154C; padding-top: 6px; font-size: 8.5px; color: #374151; line-height: 1.5; break-inside: avoid; }
  footer b { color: #B31B1B; letter-spacing: .08em; text-transform: uppercase; }
</style></head><body>
  <div class="mast">
    <div><div class="brand">NC United</div><div class="kind">Prospect scouting report</div></div>
    <div class="file"><div>File <b>${fileNumber}</b> · Issued ${e(issued)}</div><div class="conf">Confidential</div></div>
  </div>
  <div class="subject">
    ${identity.photoUrl ? `<img class="photo" src="${e(identity.photoUrl)}">` : ""}
    <div style="flex:1;min-width:0">
      <h1>${e(identity.name)}</h1>
      ${report.starRating ? `<div style="margin-top:6px">${stars(report.starRating.stars)} <span class="prospect">${report.starRating.stars}-STAR PROSPECT</span></div>` : ""}
      <div class="rank">${e([report.rankingPublished && report.prospectRanking ? `RecruitNC #${report.prospectRanking}` : null, identity.graduationYear ? `Class of ${identity.graduationYear}` : null].filter(Boolean).join("  ·  "))}</div>
      ${report.nationalRankings[0] ? `<div class="rank" style="margin-top:2px;font-size:11px">National #${report.nationalRankings[0].current} · ${e(report.nationalRankings[0].sourceLabel)}</div>` : ""}
      <div class="status">${e(statusLine(report))}</div>
      <div class="facts-id">${[identity.weightClass ? `<b style="color:#03154C">${e(identity.weightClass)} lbs</b>${identity.lastCompetedWeight && String(identity.lastCompetedWeight) !== String(identity.weightClass) ? ` · last competed ${e(identity.lastCompetedWeight)}` : ""}` : "", e(identity.highSchool ?? ""), e(identity.club ?? ""), membership.ncUnitedTeam ? `NC United ${e(membership.ncUnitedTeam.charAt(0).toUpperCase() + membership.ncUnitedTeam.slice(1))}` : ""].filter(Boolean).join("<br>")}</div>
    </div>
    <div class="contact">
      <div class="t">CONTACT</div>
      <table>
        ${full ? contactLine("Text", contact.cell, contact.cell ? `sms:${digits(contact.cell)}` : null) + contactLine("Call", contact.cell, contact.cell ? `tel:${digits(contact.cell)}` : null) + contactLine("Email", contact.email, contact.email ? `mailto:${contact.email}` : null) : ""}
        ${contactLine("Instagram", handle ? `@${handle}` : null, contact.instagramUrl ?? null)}
      </table>
      ${!full ? `<div class="sub" style="font-style:italic;margin-top:4px">Cell and email are released to verified college coaching staff.</div>` : ""}
      ${[["Highlight film", contact.highlightVideoUrl], ["FloWrestling", contact.floProfileUrl], ["TrackWrestling", contact.trackWrestlingProfileUrl]].filter(([, u]) => u).map(([l, u]) => `<div style="margin-top:4px;font-size:10px"><a href="${e(u)}"><b>${e(l)}</b></a></div>`).join("")}
    </div>
  </div>
  ${snapshot.length ? `<div class="snap"><div class="label">Recruiting snapshot</div><div class="cards" style="grid-template-columns:repeat(${snapshot.length},1fr)">${snapshot.map((f) => card(f.label, f.value, f.sub)).join("")}</div></div>` : ""}
  ${sections.join("\n")}
  <footer>
    <p><b>Method.</b> Significant results are those against wrestlers ranked nationally by FloWrestling, Sports Illustrated or MatScouts, ranked as North Carolina prospects, or who are NCHSAA/NCISA state champions or placers (top 8), and national tournament placers — grouped by that standing, since they are not the same claim. In-state and national are split by the opponent, not the event. This is not a complete match list — routine results are omitted by design.</p>
    ${report.starRating ? `<p><b>Star rating.</b> Built only from results on file, never a projection of college ceiling. Three equal parts: in-state performance (best Tournament of Champions or NCHSAA finish, plus significant wins), nationals (NHSCA, Super 32 and Fargo placing weigh most), and the RecruitNC class ranking. Five stars requires a current national ranking and a top-eight finish at Super 32.</p>` : ""}
    <p><b>Confidential.</b> ${confidential} File ${fileNumber} · issued ${e(issued)} · NC United Wrestling / RecruitNC.</p>
  </footer>
</body></html>`
}
