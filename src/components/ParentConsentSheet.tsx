import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { splitName } from "@/lib/athlete-profile"
import { accountHasCell, type ParentConsent } from "@/lib/athlete-edit"
import { colors, radius, space, type } from "@/theme/tokens"

/**
 * A parent signs before linking to a wrestler's existing profile.
 *
 * On 19 Nov 2026 a fan account linked itself to a stranger's son as his parent with one tap. The
 * server now refuses a parent link without a typed name, and this is where the app collects it —
 * the same statement the website's claim box and the create-profile wizard's signature step use.
 * Typing a name is not proof, but it is a deliberate statement by a person, recorded with the
 * wording they agreed to.
 */
export function ParentConsentSheet({
  visible,
  athleteName,
  busy,
  error,
  onCancel,
  onSign,
}: {
  visible: boolean
  athleteName: string
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onSign: (consent: ParentConsent) => void
}) {
  const [first, setFirst] = useState("")
  const [last, setLast] = useState("")
  const [cell, setCell] = useState("")
  // Shown until we know the account already has a cell; the server never overwrites one anyway.
  const [askCell, setAskCell] = useState(true)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    void accountHasCell().then((has) => {
      if (!cancelled) setAskCell(!has)
    })
    return () => {
      cancelled = true
    }
  }, [visible])

  const fullName = athleteName.trim() || "this wrestler"
  const firstName = splitName(athleteName).first || fullName
  const ready = first.trim().length > 0 && last.trim().length > 0 && !busy
  const cellDigits = cell.replace(/\D/g, "")

  const sign = () => {
    if (!ready) return
    onSign({
      signedName: `${first.trim()} ${last.trim()}`,
      cellPhone: askCell && cellDigits.length >= 10 ? cell.trim() : null,
    })
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.dismiss} onPress={busy ? undefined : onCancel} accessibilityLabel="Cancel" />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text style={styles.title}>Link as parent or guardian</Text>
            <Text style={styles.statement}>
              I confirm I am the parent or legal guardian of <Text style={styles.strong}>{fullName}</Text>. I consent, on{" "}
              {firstName}'s behalf, to NC United showing {firstName}'s wrestling results, school, weight class and graduation
              year on a public profile, and to managing that profile. I can ask for it to be removed at any time. Typing my
              name is my electronic signature.
            </Text>

            <Text style={styles.label}>TYPE YOUR NAME TO SIGN</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.flex]}
                value={first}
                onChangeText={setFirst}
                placeholder="First name"
                placeholderTextColor={colors.textMuted}
                autoComplete="given-name"
                textContentType="givenName"
                autoCapitalize="words"
                editable={!busy}
              />
              <TextInput
                style={[styles.input, styles.flex]}
                value={last}
                onChangeText={setLast}
                placeholder="Last name"
                placeholderTextColor={colors.textMuted}
                autoComplete="family-name"
                textContentType="familyName"
                autoCapitalize="words"
                editable={!busy}
              />
            </View>

            {askCell ? (
              <>
                <Text style={styles.label}>CELL PHONE</Text>
                <TextInput
                  style={styles.input}
                  value={cell}
                  onChangeText={setCell}
                  placeholder="(919) 555-0100"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  editable={!busy}
                />
                <Text style={styles.hint}>So we can reach you about this profile.</Text>
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.primary, !ready && styles.disabled]}
              disabled={!ready}
              onPress={sign}
              accessibilityRole="button"
            >
              {busy ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.primaryText}>Sign and link</Text>}
            </Pressable>
            <Pressable style={styles.cancel} disabled={busy} onPress={onCancel} accessibilityRole="button">
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  dismiss: { flex: 1 },
  sheet: {
    backgroundColor: colors.ink,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    maxHeight: "90%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.line,
    marginTop: space.sm,
  },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.sm },
  title: { ...type.title, color: colors.text, marginBottom: space.xs },
  statement: { ...type.body, color: colors.textSecondary, lineHeight: 22 },
  strong: { color: colors.text, fontWeight: "800" },
  label: { ...type.caption, color: colors.textMuted, marginTop: space.md },
  row: { flexDirection: "row", gap: space.sm },
  flex: { flex: 1 },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  hint: { ...type.label, color: colors.textMuted, fontWeight: "500" },
  error: { ...type.label, color: colors.gold, marginTop: space.sm },
  primary: {
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: "center",
    marginTop: space.lg,
  },
  disabled: { opacity: 0.4 },
  primaryText: { ...type.heading, color: colors.ink, fontWeight: "800" },
  cancel: { alignItems: "center", paddingVertical: space.md },
  cancelText: { ...type.body, color: colors.textSecondary, fontWeight: "700" },
})
