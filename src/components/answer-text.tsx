import { Fragment } from "react"
import { StyleSheet, Text, View } from "react-native"
import { colors, space, type } from "@/theme/tokens"

/**
 * Data Dawg answers come back as light markdown (**bold**, "- " bullets, "### " headings).
 * Rendering just those three inline avoids pulling a markdown engine into the bundle for
 * formatting this narrow.
 */
function Bold({ line }: { line: string }) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <Text key={i} style={styles.bold}>
            {part.slice(2, -2)}
          </Text>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
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
              <Bold line={line.replace(/^#+\s*/, "")} />
            </Text>
          )
        }

        if (/^[-*]\s+/.test(line.trim())) {
          return (
            <View key={i} style={styles.bullet}>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.body}>
                <Bold line={line.trim().replace(/^[-*]\s+/, "")} />
              </Text>
            </View>
          )
        }

        return (
          <Text key={i} style={styles.body}>
            <Bold line={line} />
          </Text>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  gap: { height: space.sm },
  body: { ...type.body, color: colors.text, lineHeight: 21, flexShrink: 1 },
  bold: { fontWeight: "700", color: colors.gold },
  heading: { ...type.heading, color: colors.text, marginBottom: 2 },
  bullet: { flexDirection: "row", gap: space.sm, paddingRight: space.sm },
  dot: { ...type.body, color: colors.textMuted, lineHeight: 21 },
})
