import { useCallback, useEffect, useState } from "react"
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
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import {
  changedFields,
  loadAthleteEdits,
  saveAthleteEdits,
  type AthleteEditFields,
} from "@/lib/athlete-edit"

/**
 * The athlete filling in their own profile.
 *
 * These six fields are what a college coach looks for and what is most often blank: 30% of
 * profiles carry a GPA, 10% an intended major, 2% an SAT. The reason is not that families refuse
 * to answer — it is that answering meant finding a laptop. This is the same form on the phone
 * that is already in their hand.
 *
 * Only what changed is sent. The endpoint leaves absent fields alone and clears the ones it is
 * given empty, so posting the whole form would wipe anything this screen does not show.
 */

const EMPTY: AthleteEditFields = {
  gpa: "",
  sat: "",
  act: "",
  intendedMajor: "",
  collegeWeightClass: "",
  weightClass: "",
  highlightVideoUrl: "",
  bio: "",
  instagram: "",
}

function Field({
  label,
  hint,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
  multiline,
  placeholder,
}: {
  label: string
  hint?: string
  value: string
  onChangeText: (v: string) => void
  keyboardType?: "default" | "numeric" | "decimal-pad" | "url"
  autoCapitalize?: "none" | "sentences" | "words"
  multiline?: boolean
  placeholder?: string
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, multiline && styles.inputMultiline]}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "sentences"}
        autoCorrect={!multiline ? false : undefined}
        multiline={multiline}
      />
    </View>
  )
}

export default function AthleteEditScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>()
  const [original, setOriginal] = useState<AthleteEditFields>(EMPTY)
  const [fields, setFields] = useState<AthleteEditFields>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const result = await loadAthleteEdits(String(id))
      if (!result) {
        setError("You can only edit a profile you have claimed.")
        return
      }
      setOriginal(result.fields)
      setFields(result.fields)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load that profile.")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const set = (key: keyof AthleteEditFields) => (value: string) => {
    setSaved(false)
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  const pending = changedFields(original, fields)
  const dirty = Object.keys(pending).length > 0

  const save = async () => {
    if (!dirty || saving) return
    setSaving(true)
    setError(null)
    try {
      await saveAthleteEdits(String(id), pending)
      setOriginal(fields)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save those changes.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.gold} />
          <Text style={styles.backText}>{name ? String(name) : "Profile"}</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : error && !dirty && original === EMPTY ? (
        <View style={styles.centre}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={8}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Your profile</Text>
            <Text style={styles.lede}>
              What college coaches look for first. Anything you leave blank simply does not show.
            </Text>

            <Text style={styles.sectionHeading}>ACADEMICS</Text>
            <Field
              label="GPA"
              hint="Weighted or unweighted — whichever your school reports."
              value={fields.gpa}
              onChangeText={set("gpa")}
              keyboardType="decimal-pad"
              placeholder="3.8"
            />
            <Field label="SAT" value={fields.sat} onChangeText={set("sat")} keyboardType="numeric" placeholder="1200" />
            <Field label="ACT" value={fields.act} onChangeText={set("act")} keyboardType="numeric" placeholder="26" />
            <Field
              label="Intended major"
              hint="Lets a coach match you to what their school actually offers."
              value={fields.intendedMajor}
              onChangeText={set("intendedMajor")}
              autoCapitalize="words"
              placeholder="Pre-Med"
            />

            <Text style={styles.sectionHeading}>WRESTLING</Text>
            <Field
              label="Current weight class"
              value={fields.weightClass}
              onChangeText={set("weightClass")}
              keyboardType="numeric"
              placeholder="138"
            />
            <Field
              label="Projected college weight"
              hint="Your own projection. It shows on your scouting report as athlete-stated."
              value={fields.collegeWeightClass}
              onChangeText={set("collegeWeightClass")}
              keyboardType="numeric"
              placeholder="141"
            />
            <Field
              label="Highlight film"
              hint="The first thing a college coach asks for after your record."
              value={fields.highlightVideoUrl}
              onChangeText={set("highlightVideoUrl")}
              keyboardType="url"
              autoCapitalize="none"
              placeholder="https://"
            />
            <Field
              label="Instagram"
              value={fields.instagram}
              onChangeText={set("instagram")}
              autoCapitalize="none"
              placeholder="ncunited"
            />
            <Field
              label="About you"
              value={fields.bio}
              onChangeText={set("bio")}
              multiline
              placeholder="A few lines in your own words."
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {saved && !dirty ? <Text style={styles.savedText}>Saved.</Text> : null}

            <Pressable
              style={[styles.save, (!dirty || saving) && styles.saveDisabled]}
              onPress={() => void save()}
              disabled={!dirty || saving}
            >
              <Text style={styles.saveText}>
                {saving ? "Saving…" : dirty ? `Save ${Object.keys(pending).length} change${Object.keys(pending).length === 1 ? "" : "s"}` : "Saved"}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  flex: { flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xxl * 2, gap: space.sm },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xl },

  navBar: { paddingHorizontal: space.md, paddingVertical: space.sm },
  back: { flexDirection: "row", alignItems: "center" },
  backText: { ...type.label, color: colors.gold },

  title: { ...type.display, color: colors.text },
  lede: { ...type.body, color: colors.textSecondary, marginBottom: space.sm },
  sectionHeading: { ...type.caption, color: colors.textMuted, marginTop: space.lg, marginBottom: space.xs },

  field: { gap: 4, marginBottom: space.md },
  label: { ...type.label, color: colors.text, fontWeight: "700" },
  hint: { ...type.caption, color: colors.textMuted, letterSpacing: 0.2, textTransform: "none", fontWeight: "500" },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    color: colors.text,
    ...type.body,
  },
  inputMultiline: { minHeight: 110, textAlignVertical: "top" },

  errorText: { ...type.label, color: colors.red, marginTop: space.sm },
  savedText: { ...type.label, color: colors.success, marginTop: space.sm },

  save: {
    marginTop: space.lg,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: "center",
  },
  saveDisabled: { opacity: 0.45 },
  saveText: { ...type.label, color: colors.ink, fontWeight: "800" },
})
