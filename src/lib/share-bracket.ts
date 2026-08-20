import { Platform } from "react-native"
import { captureRef } from "react-native-view-shot"
import * as Sharing from "expo-sharing"

/**
 * Turn the bracket into an image and hand it to the share sheet.
 *
 * The ref must point at the *content* view — the one laid out at the bracket's natural width,
 * inside the horizontal ScrollView — not the ScrollView itself. A ScrollView only captures the
 * part currently on screen, so capturing the wrapper would crop a bracket wider than the phone
 * to whatever happened to be scrolled into view.
 */

export type ShareResult = "shared" | "unavailable" | "failed"

export async function shareBracketImage(
  ref: Parameters<typeof captureRef>[0],
  weightClass: number,
): Promise<ShareResult> {
  try {
    if (!(await Sharing.isAvailableAsync())) return "unavailable"

    const uri = await captureRef(ref, {
      format: "png",
      quality: 1,
      // Opaque background: a transparent PNG turns into a black rectangle in most messaging
      // apps, and the bracket is drawn on dark navy rather than on nothing.
      result: "tmpfile",
    })

    await Sharing.shareAsync(uri, {
      mimeType: "image/png",
      dialogTitle: `${weightClass} lbs bracket`,
      // Only iOS reads this; it is what Messages and Mail put in the subject line.
      UTI: Platform.OS === "ios" ? "public.png" : undefined,
    })

    return "shared"
  } catch (e) {
    console.warn("[share-bracket]", e instanceof Error ? e.message : e)
    return "failed"
  }
}
