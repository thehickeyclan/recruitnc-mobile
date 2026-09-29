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
  lastCompetedLine,
  monthLabel,
  movementLabel,
  noBoutsLine,
  statusLine,
  weightProgression,
  type ReportBout,
  type ScoutingReport,
} from "./scouting-report-format"

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

const STANDING_COLOR: Record<ReportBout["reason"], string> = {
  "national-ranked": "background:#B31B1B;color:#fff",
  "toc-field": "background:#D3B574;color:#0A1628",
  ranked: "background:#03154C;color:#fff",
  "state-champion": "background:#1f6f43;color:#fff",
  "state-placer": "background:#e5e7eb;color:#111",
}

const BAND_COLOR: Record<ScoutingReport["strengthOfCompetition"]["grade"]["band"], string> = {
  green: "#047857",
  amber: "#b45309",
  orange: "#c2410c",
  red: "#b91c1c",
}

const e = escapeHtml

function vital(label: string, value: string | null): string {
  return value ? `<tr><th>${e(label)}</th><td>${e(value)}</td></tr>` : ""
}

function note(text: string): string {
  return `<p class="note">${e(text)}</p>`
}

function table(head: string[], rows: string[][]): string {
  return `<table class="grid"><thead><tr>${head.map((h) => `<th>${e(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`
}

function bouts(rows: ReportBout[], kind: "win" | "loss"): string {
  const groups = groupBouts(rows, kind)
  if (!groups.length) return note(noBoutsLine(kind))
  return groups
    .map(
      (group) =>
        `<h4>${e(group.heading)} <span class="muted">(${group.rows.length})</span></h4>` +
        table(
          ["Opponent", "Affiliation", "Standing", "Result", "Event", "Date"],
          group.rows.map((b) => [
            `<b>${e(b.opponent)}</b>`,
            e(b.opponentSchool ?? "—"),
            `<span class="chip" style="${STANDING_COLOR[b.reason]}">${e(STANDING_LABEL[b.reason])}</span>` +
              (b.nationalRankLabel ? `<div class="sub">${e(b.nationalRankLabel)}</div>` : "") +
              (b.stateLabel ? `<div class="sub">${e(b.stateLabel)}</div>` : ""),
            e(b.result ?? "—"),
            e(b.event ?? "—"),
            `<span class="nowrap">${e(b.date ? dayLabel(b.date) : "—")}</span>`,
          ]),
        ),
    )
    .join("")
}

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

  const stars = (count: number) =>
    `<span class="stars">${[1, 2, 3, 4, 5].map((i) => (i <= count ? "★" : "☆")).join("")}</span>`

  const chips = [
    report.nationalRankings[0]
      ? `<span class="chip" style="background:#B31B1B;color:#fff">National #${report.nationalRankings[0].current} · ${e(report.nationalRankings[0].sourceLabel)}</span>`
      : "",
    report.rankingPublished && report.prospectRanking
      ? `<span class="chip" style="background:#D3B574;color:#0A1628">NC #${report.prospectRanking} · Class of ${e(identity.graduationYear)}</span>`
      : "",
    membership.ncUnitedTeam ? `<span class="chip" style="background:#03154C;color:#fff">NC United ${e(membership.ncUnitedTeam)}</span>` : "",
    `<span class="chip outline">${e(statusLine(report))}</span>`,
  ].join(" ")

  const sections: string[] = []
  if (report.summary) sections.push(block("Evaluation", `<p class="serif">${e(report.summary)}</p>`))

  const film = [
    ["Highlight film", contact.highlightVideoUrl],
    ["FloWrestling", contact.floProfileUrl],
    ["TrackWrestling", contact.trackWrestlingProfileUrl],
  ].filter(([, url]) => url)
  if (film.length) {
    sections.push(
      block(
        "Film and profiles",
        `<ul>${film.map(([label, url]) => `<li><b>${e(label)}</b> <a href="${e(url)}">${e(url)}</a></li>`).join("")}</ul>`,
      ),
    )
  }

  sections.push(
    block(
      "Academics",
      (!full
        ? note(
            `Academic records are released to verified college coaching staff.${
              academics.academicInterest ? ` Intended major: ${academics.academicInterest}.` : ""
            }`,
          )
        : academics.gpa || academics.sat || academics.act || academics.academicInterest
          ? table(["GPA", "SAT", "ACT", "Intended major"], [
              [e(academics.gpa ?? "—"), e(academics.sat ?? "—"), e(academics.act ?? "—"), e(academics.academicInterest ?? "—")],
            ])
          : note("No academic information on file.")) +
        (academics.academicSummary ? `<p class="serif">${e(academics.academicSummary)}</p>` : ""),
    ),
  )

  if (report.starRating) {
    sections.push(
      block(
        "Star rating",
        `<p>${stars(report.starRating.stars)} <span class="mono">${report.starRating.score}/100${
          report.starRating.provisional ? " · provisional, thin record on file" : ""
        }</span></p>` +
          table(
            ["Component", "Earned", "Basis"],
            report.starRating.components.map((c) => [`<b>${e(c.label)}</b>`, `${c.points}/${c.max}`, e(c.detail)]),
          ) +
          `<p class="fine">Built only from results on file, never a projection of college ceiling. Five stars requires a current national ranking from FloWrestling, Sports Illustrated or MatScouts and a record that independently earns four. Rated for the classes RecruitNC ranks.</p>`,
      ),
    )
  }

  if (report.nationalRankings.length) {
    sections.push(
      block(
        "National ranking history",
        table(
          ["Outlet", "Current", "By month", "Movement"],
          report.nationalRankings.map((s) => [
            `<b>${e(s.sourceLabel)}</b>`,
            `#${s.current}`,
            e(s.editions.map((ed) => `${monthLabel(ed.rankingMonth)} #${ed.rank}`).join(" · ")),
            e(movementLabel(s.movement)),
          ]),
        ) +
          `<p class="fine">Weight class as published by the outlet. Only the most recent monthly editions are retained, so movement describes that window and no further back.</p>`,
      ),
    )
  }

  const soc = report.strengthOfCompetition
  if (report.seasonStrength && report.seasonStrength.bouts > 0) {
    const progression = weightProgression(report.results)
    const rows = [
      [
        "<b>In-season record</b>",
        `${report.seasonStrength.wins}-${report.seasonStrength.losses}`,
        e(
          `${report.seasonStrength.bouts} bouts${report.seasonStrengthSeason ? ` in the ${report.seasonStrengthSeason} season` : ""} — duals, tris, invitationals and the NCHSAA postseason. National and post/preseason events are listed under Competition record, not counted here.`,
        ),
      ],
      [
        "<b>Wins over ranked opponents</b>",
        String(soc.rankedWins.total),
        e(`${soc.rankedWins.national} nationally ranked · ${soc.rankedWins.tocField} Tournament of Champions field · ${soc.rankedWins.stateRanked} NC ranked`),
      ],
      ["<b>Losses to ranked opponents</b>", String(soc.credentialedLosses), "Listed in full under Notable losses"],
      ...(progression ? [["<b>Competed at</b>", "—", e(progression)]] : []),
    ]
    const color = BAND_COLOR[soc.grade.band]
    sections.push(
      block(
        "Strength of competition",
        table(["Measure", "Value", "Basis"], rows) +
          `<div class="grade" style="border-color:${color}"><div class="gradehead"><b style="color:${color}">${e(
            soc.grade.label.toUpperCase(),
          )}</b><span class="mono">${soc.grade.score}/6</span></div><p>${e(soc.grade.verdict)}</p><ul>${soc.grade.factors
            .map(
              (f) =>
                `<li><span class="dot" style="background:${f.points === 2 ? "#059669" : f.points === 1 ? "#f59e0b" : "#ef4444"}"></span><b>${e(
                  f.label,
                )}:</b> ${e(f.detail)}</li>`,
            )
            .join("")}</ul>${soc.grade.nextStep ? `<p><b>Next step:</b> ${e(soc.grade.nextStep)}</p>` : ""}</div>` +
          (soc.seasonsOnFile <= 1
            ? `<p class="fine warn">One season on file. A wrestler who transferred in, or is in their first year, will read as quiet here whatever they have done elsewhere.</p>`
            : ""),
      ),
    )
  }

  sections.push(
    block(
      "Competition record",
      report.results.length
        ? table(
            ["Date", "Event", "Result"],
            report.results.map((r) => [
              `<span class="nowrap">${e(r.date ? dayLabel(r.date) : r.year)}</span>`,
              `<b>${e(r.event)}</b>`,
              e(r.detail),
            ]),
          )
        : note("No tournament results on file."),
    ),
  )
  sections.push(block("Significant wins", bouts(report.significantWins, "win"), report.significantWins.length))
  sections.push(block("Notable losses", bouts(report.significantLosses, "loss"), report.significantLosses.length))

  const confidential = report.watermark
    ? `${e(report.watermark)}. Contains contact information for a prospective student-athlete; do not redistribute. This copy is traceable to the recipient named above.`
    : "Competition analysis only. Contact details and academic records are released to verified college coaching staff."

  return `<!doctype html><html><head><meta charset="utf-8"><title>${e(pdfFileName(identity.name).replace(/\.pdf$/, ""))}</title><style>
  @page { margin: 0.45in; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111827; font-size: 11px; margin: 0; font-variant-numeric: tabular-nums; }
  ${report.watermark ? `body::before { content: "${e(report.watermark)}"; position: fixed; top: 45%; left: -10%; width: 120%; text-align: center; transform: rotate(-28deg); font-size: 30px; font-weight: 800; letter-spacing: .08em; color: rgba(3,21,76,.06); z-index: 0; }` : ""}
  .mast { display: flex; justify-content: space-between; border-bottom: 3px solid #03154C; padding-bottom: 8px; }
  .brand { font-size: 13px; font-weight: 900; letter-spacing: .18em; color: #03154C; text-transform: uppercase; }
  .kind { font-size: 9px; font-weight: 700; letter-spacing: .22em; color: #B31B1B; text-transform: uppercase; }
  .file { text-align: right; font-size: 9.5px; color: #4b5563; line-height: 1.5; }
  .file b { color: #03154C; font-family: Menlo, monospace; }
  .conf { color: #B31B1B; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .subject { display: flex; gap: 16px; margin-top: 14px; align-items: flex-start; }
  .photo { width: 96px; height: 120px; object-fit: cover; object-position: top; border: 1px solid #d1d5db; padding: 3px; }
  h1 { font-family: Georgia, serif; font-size: 28px; margin: 2px 0 6px; color: #03154C; }
  .label { font-size: 9px; font-weight: 700; letter-spacing: .2em; color: #9ca3af; text-transform: uppercase; }
  .stars { color: #D3B574; font-size: 13px; letter-spacing: 1px; }
  .chip { display: inline-block; padding: 1px 6px; font-size: 8.5px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; margin: 2px 2px 0 0; }
  .chip.outline { border: 1px solid #d1d5db; color: #4b5563; }
  table.vitals { border: 1px solid #d1d5db; background: #f7f8fa; border-collapse: collapse; width: 2.9in; font-size: 10.5px; }
  table.vitals th { text-align: left; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; padding: 4px 8px; font-size: 9px; vertical-align: top; border-bottom: 1px solid #e5e7eb; }
  table.vitals td { text-align: right; font-weight: 600; color: #03154C; padding: 4px 8px; border-bottom: 1px solid #e5e7eb; }
  section { margin-top: 16px; position: relative; z-index: 1; }
  .head { display: flex; align-items: baseline; gap: 8px; border-bottom: 2px solid #03154C; padding-bottom: 3px; margin-bottom: 6px; break-after: avoid; }
  .num { font-family: Menlo, monospace; font-size: 10px; font-weight: 700; color: #B31B1B; }
  h2 { font-size: 10.5px; font-weight: 900; letter-spacing: .18em; text-transform: uppercase; color: #03154C; margin: 0; }
  .count { margin-left: auto; font-family: Menlo, monospace; font-size: 9.5px; color: #6b7280; }
  h4 { font-size: 9.5px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; color: #03154C; margin: 10px 0 3px; }
  table.grid { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  table.grid th { text-align: left; font-size: 8.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #9ca3af; padding: 0 6px 3px 0; }
  table.grid td { border-top: 1px solid #e5e7eb; padding: 4px 6px 4px 0; vertical-align: top; color: #374151; }
  table.grid td b { color: #03154C; }
  tr, li { break-inside: avoid; }
  .sub { font-size: 8.5px; color: #6b7280; margin-top: 2px; }
  .serif { font-family: Georgia, serif; font-size: 12px; line-height: 1.6; color: #111827; margin: 0 0 4px; }
  .note { font-family: Georgia, serif; font-style: italic; color: #6b7280; font-size: 11.5px; margin: 0; }
  .fine { font-size: 8.5px; color: #6b7280; line-height: 1.5; margin: 4px 0 0; }
  .warn { color: #b45309; }
  .muted { color: #6b7280; font-family: Menlo, monospace; }
  .mono { font-family: Menlo, monospace; color: #4b5563; font-size: 10px; }
  .nowrap { white-space: nowrap; }
  .grade { border: 1px solid; border-radius: 4px; padding: 8px 10px; margin-top: 8px; break-inside: avoid; }
  .gradehead { display: flex; justify-content: space-between; }
  .grade ul { list-style: none; padding: 0; margin: 4px 0; }
  .grade li { margin: 2px 0; }
  .dot { display: inline-block; width: 7px; height: 7px; border-radius: 4px; margin-right: 6px; }
  ul { margin: 0; padding-left: 16px; }
  a { color: #03154C; word-break: break-all; }
  footer { margin-top: 20px; border-top: 2px solid #03154C; padding-top: 6px; font-size: 8.5px; color: #6b7280; line-height: 1.5; }
  footer b { color: #B31B1B; letter-spacing: .08em; text-transform: uppercase; }
</style></head><body>
  <div class="mast">
    <div><div class="brand">NC United Wrestling</div><div class="kind">Prospect scouting report</div></div>
    <div class="file"><div>FILE <b>${fileNumber}</b></div><div>ISSUED ${e(issued)}</div><div class="conf">Confidential</div></div>
  </div>
  <div class="subject">
    ${identity.photoUrl ? `<img class="photo" src="${e(identity.photoUrl)}">` : ""}
    <div style="flex:1;min-width:0">
      <div class="label">Subject</div>
      <h1>${e(identity.name)}</h1>
      ${report.starRating ? `<div>${stars(report.starRating.stars)} <span class="label">${report.starRating.stars} star${report.starRating.stars === 1 ? "" : "s"}${report.starRating.provisional ? " · provisional" : ""}</span></div>` : ""}
      <div>${chips}</div>
    </div>
    <table class="vitals">
      ${vital("Class", identity.graduationYear ? String(identity.graduationYear) : null)}
      ${vital("Listed weight", identity.weightClass ? `${identity.weightClass} lbs` : null)}
      ${vital("Last competed", lastCompetedLine(identity))}
      ${vital("Projected college", identity.collegeWeightClass ? `${identity.collegeWeightClass} lbs · athlete-stated` : null)}
      ${vital("High school", identity.highSchool)}
      ${vital("Club", identity.club)}
      ${vital("Career", report.careerRecord)}
      ${vital("Cell", full ? contact.cell : null)}
      ${vital("Email", full ? contact.email : null)}
      ${!full ? `<tr><td colspan="2" style="text-align:left;font-style:italic;font-weight:400;color:#6b7280;font-size:9px">Contact details released to verified college coaching staff.</td></tr>` : ""}
    </table>
  </div>
  ${sections.join("\n")}
  <footer>
    <p><b>Method.</b> Significant results are those against wrestlers ranked nationally by FloWrestling, Sports Illustrated or MatScouts, ranked as North Carolina prospects, or who are NCHSAA/NCISAA state champions or placers (top 8) — grouped by that standing, since they are not the same claim. This is not a complete match list — routine results are omitted by design.</p>
    <p><b>Confidential.</b> ${confidential} File ${fileNumber} · issued ${e(issued)} · NC United Wrestling / RecruitNC.</p>
  </footer>
</body></html>`
}
