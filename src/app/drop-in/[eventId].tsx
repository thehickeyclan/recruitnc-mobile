import { useState } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useLocalSearchParams } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { ageFromDob, createDropInCheckout, digitsOnly } from "@/lib/drop-in"

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  optional,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder: string
  keyboardType?: "default" | "email-address" | "number-pad" | "phone-pad"
  autoCapitalize?: "none" | "words"
  optional?: boolean
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label.toUpperCase()}
        {optional ? <Text style={styles.optional}>  OPTIONAL</Text> : null}
      </Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "words"}
        autoCorrect={false}
      />
    </View>
  )
}

export default function DropInScreen() {
  const { eventId, title, date } = useLocalSearchParams<{ eventId: string; title?: string; date?: string }>()

  const [wrestlerName, setWrestlerName] = useState("")
  const [wrestlerDob, setWrestlerDob] = useState("")
  const [wrestlerCell, setWrestlerCell] = useState("")
  const [wrestlerWeight, setWrestlerWeight] = useState("")
  const [parentName, setParentName] = useState("")
  const [parentEmail, setParentEmail] = useState("")
  const [parentPhone, setParentPhone] = useState("")
  const [waiverAccepted, setWaiverAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const prettyDate = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : null

  function validate(): string | null {
    if (!wrestlerName.trim()) return "Enter the wrestler's name."
    const age = ageFromDob(wrestlerDob)
    if (age == null) return "Enter the wrestler's date of birth as MM/DD/YYYY."
    if (age < 5 || age > 18) return "Wrestler must be between 5 and 18 years old for drop-in practices."
    if (digitsOnly(wrestlerCell).length !== 10) return "Enter a valid 10-digit wrestler cell number."
    if (!parentName.trim()) return "Enter the parent or guardian's name."
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(parentEmail.trim())) return "Enter a valid parent email address."
    if (!waiverAccepted) return "You must accept the Waiver and Release of Liability before continuing."
    return null
  }

  async function onSubmit() {
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const checkoutUrl = await createDropInCheckout({
        eventId: String(eventId),
        wrestlerName: wrestlerName.trim(),
        wrestlerDob: wrestlerDob.trim(),
        wrestlerCell: wrestlerCell.trim(),
        wrestlerWeight: wrestlerWeight.trim() || undefined,
        parentName: parentName.trim(),
        parentEmail: parentEmail.trim(),
        parentPhone: parentPhone.trim() || undefined,
        waiverAccepted: true,
      })
      await WebBrowser.openBrowserAsync(checkoutUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.gold} />
          <Text style={styles.backText}>Calendar</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>DROP-IN PRACTICE</Text>
          <Text style={styles.title}>{title ?? "Practice"}</Text>
          {prettyDate ? <Text style={styles.subtitle}>{prettyDate}</Text> : null}

          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.noticeText}>
              This reserves a spot at an in-person practice. Payment is taken on the next screen.
            </Text>
          </View>

          <Text style={styles.sectionHeading}>Wrestler</Text>
          <Field label="Full name" value={wrestlerName} onChangeText={setWrestlerName} placeholder="Alex Smith" />
          <Field
            label="Date of birth"
            value={wrestlerDob}
            onChangeText={setWrestlerDob}
            placeholder="MM/DD/YYYY"
            keyboardType="number-pad"
          />
          <Field
            label="Cell number"
            value={wrestlerCell}
            onChangeText={setWrestlerCell}
            placeholder="(919) 555-0134"
            keyboardType="phone-pad"
          />
          <Field
            label="Weight"
            value={wrestlerWeight}
            onChangeText={setWrestlerWeight}
            placeholder="138"
            keyboardType="number-pad"
            optional
          />

          <Text style={styles.sectionHeading}>Parent or guardian</Text>
          <Field label="Full name" value={parentName} onChangeText={setParentName} placeholder="Jordan Smith" />
          <Field
            label="Email"
            value={parentEmail}
            onChangeText={setParentEmail}
            placeholder="you@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field
            label="Phone"
            value={parentPhone}
            onChangeText={setParentPhone}
            placeholder="(919) 555-0134"
            keyboardType="phone-pad"
            optional
          />

          <Pressable style={styles.waiver} onPress={() => setWaiverAccepted((v) => !v)}>
            <View style={[styles.checkbox, waiverAccepted && styles.checkboxOn]}>
              {waiverAccepted ? <Ionicons name="checkmark" size={14} color={colors.ink} /> : null}
            </View>
            <Text style={styles.waiverText}>
              I accept the Waiver and Release of Liability on behalf of this wrestler.
            </Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.submit, submitting && styles.submitDisabled]}
            onPress={() => void onSubmit()}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <Text style={styles.submitText}>Continue to payment</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  flex: { flex: 1 },
  navBar: { paddingHorizontal: space.md, paddingVertical: space.sm },
  back: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start" },
  backText: { ...type.body, color: colors.gold },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl * 2 },
  eyebrow: { ...type.caption, color: colors.gold, marginBottom: space.xs },
  title: { ...type.title, color: colors.text },
  subtitle: { ...type.body, color: colors.textSecondary, marginTop: 2 },
  notice: {
    flexDirection: "row",
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    marginTop: space.lg,
  },
  noticeText: { ...type.label, color: colors.textSecondary, fontWeight: "500", flex: 1, lineHeight: 18 },
  sectionHeading: { ...type.caption, color: colors.textMuted, marginTop: space.xl, marginBottom: space.sm },
  field: { marginBottom: space.md },
  label: { ...type.caption, color: colors.textSecondary, fontSize: 10, marginBottom: 6 },
  optional: { color: colors.textMuted, fontWeight: "600" },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    color: colors.text,
    fontSize: 15,
  },
  waiver: { flexDirection: "row", alignItems: "flex-start", gap: space.md, marginTop: space.lg },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  waiverText: { ...type.label, color: colors.textSecondary, fontWeight: "500", flex: 1, lineHeight: 18 },
  error: { ...type.label, color: "#FF6B6B", fontWeight: "500", marginTop: space.lg, lineHeight: 18 },
  submit: {
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: space.lg,
    alignItems: "center",
    marginTop: space.xl,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { ...type.heading, color: colors.ink },
})
