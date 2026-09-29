import { Platform } from "react-native"
import * as Sharing from "expo-sharing"
import { supabase } from "@/lib/supabase"
import { clientHeader } from "@/lib/client-header"
import { pdfFileName, reportHtml } from "@/lib/scouting-report-html"
import type { ScoutingReport } from "@/lib/scouting-report-format"

const BASE = (process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://app.ncwrestlingunited.com").replace(/\/$/, "")

export type PdfShareResult = "shared" | "unavailable" | "failed"

/**
 * expo-print, if this binary has it.
 *
 * It is a native module added after 1.1.3 shipped, and JS updates go out to every live runtime.
 * A static import would crash on load in the older binaries ("Cannot find native module
 * 'ExpoPrint'") — the whole app, not just this button. Required lazily instead, so an old binary
 * gets `null` and the caller falls back to the web report.
 */
function loadPrint(): typeof import("expo-print") | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-print") as typeof import("expo-print")
  } catch {
    return null
  }
}

/**
 * Give the file the wrestler's name. printToFileAsync writes a random id, which is what Mail
 * would attach and Files would save — thirty of those in a recruiter's folder are unreadable.
 * On any failure the random name is still a working PDF, so it is kept rather than lost.
 */
async function named(uri: string, name: string): Promise<string> {
  try {
    // Lazy for the same reason as expo-print: nothing in this file may break app launch.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { File, Paths } = require("expo-file-system") as typeof import("expo-file-system")
    const target = new File(Paths.cache, pdfFileName(name))
    if (target.exists) target.delete()
    await new File(uri).move(target)
    return target.uri
  } catch {
    return uri
  }
}

/** Saving a report is a stronger signal than opening one; the website logs it the same way. */
async function logDownload(athleteId: string): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    await fetch(`${BASE}/api/athletes/${encodeURIComponent(athleteId)}/scouting-report/download`, {
      method: "POST",
      headers: { ...clientHeader(), Authorization: `Bearer ${token}` },
    })
  } catch {
    // A missed log line must never block the coach.
  }
}

/**
 * The report as a PDF, handed to the iOS share sheet — Messages, Mail, Save to Files, AirDrop.
 *
 * "unavailable" means this binary cannot make one (no expo-print, or no share sheet); the caller
 * opens the web report instead.
 */
export async function shareScoutingReportPdf(report: ScoutingReport): Promise<PdfShareResult> {
  const Print = loadPrint()
  if (!Print) return "unavailable"
  try {
    if (!(await Sharing.isAvailableAsync())) return "unavailable"

    const { uri } = await Print.printToFileAsync({ html: reportHtml(report), width: 612, height: 792 })
    const file = await named(uri, report.identity.name)
    void logDownload(report.athleteId)

    await Sharing.shareAsync(file, {
      mimeType: "application/pdf",
      dialogTitle: pdfFileName(report.identity.name),
      UTI: Platform.OS === "ios" ? "com.adobe.pdf" : undefined,
    })
    return "shared"
  } catch (e) {
    console.warn("[scouting-report-pdf]", e instanceof Error ? e.message : e)
    return "failed"
  }
}
