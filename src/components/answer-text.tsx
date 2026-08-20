import { Fragment } from "react"
import { StyleSheet, Text, View } from "react-native"
import * as WebBrowser from "expo-web-browser"
import { colors, space, type } from "@/theme/tokens"

/**
 * Data Dawg answers come back as light markdown: `**bold**`, `[name](url)` links, and "- "
 * bullets. Rendering those inline avoids pulling a markdown engine into the bundle for
 * formatting this narrow.
 *
 * Links matter more than they look. Every athlete answer opens with the wrestler's name linked
 * to their profile, so before this the first line of most replies was a raw 70-character URL.
 */

/** `[label](url)` or `**bold**`, whichever comes first. */
const INLINE_TOKEN = /(\[[^\]\n]+\]\([^)\s]+\))|(\*\*[^*\n]+\*\*)/g

const LINK = /^\[([^\]\n]+)\]\(([^)\s]+)\)$/

function openLink(url: string) {
  // Profiles live on the website — the app has no profile screen yet. Anything that isn't a
  // web URL is not ours to open.
  if (!/^https?:\/\//i.test(url)) return
  void WebBrowser.openBrowserAsync(url).catch(() => undefined)
}

function Inline({ line }: { line: string }) {
  const parts = line.split(INLINE_TOKEN).filter((p) => p)

  return (
    <>
      {parts.map((part, i) => {
        const link = LINK.exec(part)
        if (link) {
          const [, label, url] = link
          return (
            <Text
              key={i}
              style={styles.link}
              accessibilityRole="link"
              accessibilityHint="Opens the profile on the RecruitNC website"
              onPress={() => openLink(url)}
            >
              {label}
            </Text>
          )
        }

        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <Text key={i} style={styles.bold}>
              {part.slice(2, -2)}
            </Text>
          )
        }

        return <Fragment key={i}>{part}</Fragment>
      })}
    </>
  )
}

export function AnswerText({ content }: { content: string }) {
  const lines = content.split("\n")

  return (
    <View style={styles.wrap}>
      {lines.map((raw, i) => {
        const line = raw.trimEnd()
        if (!line.trim()) return <View key={i} style={styles.gap} />

        if (line.startsWith("###") || line.startsWith("##")) {
          return (
            <Text key={i} style={styles.heading}>
              <Inline line={line.replace(/^#+\s*/, "")} />
            </Text>
          )
        }

        if (/^[-*]\s+/.test(line.trim())) {
          return (
            <View key={i} style={styles.bullet}>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.body}>
                <Inline line={line.trim().replace(/^[-*]\s+/, "")} />
              </Text>
            </View>
          )
        }

        return (
          <Text key={i} style={styles.body}>
            <Inline line={line} />
          </Text>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  // Blank line between paragraphs — prose needs real air, not a line break.
  gap: { height: space.md },
  body: { ...type.body, color: colors.text, lineHeight: 22, flexShrink: 1 },
  bold: { fontWeight: "700", color: colors.gold },
  link: { fontWeight: "700", color: colors.gold, textDecorationLine: "underline" },
  heading: { ...type.heading, color: colors.text, marginBottom: 2 },
  bullet: { flexDirection: "row", gap: space.sm, paddingRight: space.sm },
  dot: { ...type.body, color: colors.textMuted, lineHeight: 21 },
})
