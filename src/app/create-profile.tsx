import { useCallback, useMemo, useState } from "react"
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
import { router, useFocusEffect } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { currentUserId, claimAthleteProfile, saveAthleteEdits } from "@/lib/athlete-edit"
import { openWebPage } from "@/lib/profile-link"
import { createProfile, graduationYears, WEIGHTS, type CreateResult, type NewProfile } from "@/lib/create-profile"

/**
 * Create a profile, one question at a time.
 *
 * The website's form is a page of fields; a wrestler on a phone in a gym lobby gives up on that.
 * Here every screen asks one thing, most answers are a tap, and it is done in under a minute.
 * Grades are asked (optional, one screen) because coaches filter on them first; film and contact
 * details come after, on the profile, once there is something to add them to.
 *
 * If the site already holds this wrestler (by name, class and school), it asks before making a
 * second profile: most NC wrestlers already have one built from their results.
 */
type Step = "who" | "signature" | "name" | "gender" | "year" | "school" | "weight" | "academics" | "study" | "club" | "saving" | "found" | "done"

/** Opened from a link there is nothing underneath to go back to; go home instead. */
function close() {
  if (router.canGoBack()) router.back()
  else router.replace("/")
}

export default function CreateProfileScreen() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [step, setStep] = useState<Step>("who")
  const [rel, setRel] = useState<"self" | "parent">("self")
  const [signedName, setSignedName] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [gender, setGender] = useState<"Male" | "Female">("Male")
  const [year, setYear] = useState<number | null>(null)
  const [school, setSchool] = useState("")
  const [weight, setWeight] = useState<string | null>(null)
  const [gpa, setGpa] = useState("")
  const [sat, setSat] = useState("")
  const [act, setAct] = useState("")
  const [study, setStudy] = useState<string | null>(null)
  const [club, setClub] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [found, setFound] = useState<Extract<CreateResult, { kind: "existing" }> | null>(null)
  const [result, setResult] = useState<{ athleteId: string; athleteName: string } | null>(null)

  // Signing in happens on its own screen; when the wizard comes back into view, look again.
  useFocusEffect(
    useCallback(() => {
      void currentUserId().then((id) => setSignedIn(Boolean(id)))
    }, []),
  )

  const flow: Step[] = useMemo(
    () => ["who", ...(rel === "parent" ? (["signature"] as Step[]) : []), "name", "gender", "year", "school", "weight", "academics", "study", "club"],
    [rel],
  )
  const index = flow.indexOf(step)
  const progress = index >= 0 ? (index + 1) / flow.length : 1
  const next = () => setStep(flow[Math.min(index + 1, flow.length - 1)]!)
  const back = () => (index > 0 ? setStep(flow[index - 1]!) : close())
  const whose = rel === "self" ? "your" : "your wrestler's"
  const academicsProblem = checkAcademics(gpa, sat, act)

  const submit = async (force = false) => {
    setError(null)
    setStep("saving")
    const input: NewProfile = {
      relationship: rel,
      signedName: rel === "parent" ? signedName.trim() : undefined,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      gender,
      graduationYear: year!,
      highSchool: school.trim(),
      weightClass: weight!,
      club: club.trim() || undefined,
      academicGpa: gpa.trim() || undefined,
      academicSat: sat.trim() || undefined,
      academicAct: act.trim() || undefined,
      academicInterest: study ?? undefined,
    }
    try {
      const r = await createProfile(input, force)
      if (r.kind === "existing") {
        setFound(r)
        setStep("found")
      } else {
        setResult(r)
        setStep("done")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.")
      setStep("club")
    }
  }

  const claimFound = async () => {
    if (!found) return
    setError(null)
    setStep("saving")
    try {
      await claimAthleteProfile(found.athleteId, rel)
      // The profile already existed, so the grades typed in the wizard go on as an edit.
      const grades = Object.fromEntries(
        ([["gpa", gpa], ["sat", sat], ["act", act], ["intendedMajor", study ?? ""]] as const).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]),
      )
      if (Object.keys(grades).length > 0) await saveAthleteEdits(found.athleteId, grades).catch(() => undefined)
      setResult({ athleteId: found.athleteId, athleteName: found.athleteName })
      setStep("done")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not claim that profile.")
      setStep("found")
    }
  }

  if (signedIn === null) {
    return (
      <Shell onClose={close}>
        <ActivityIndicator color={colors.gold} />
      </Shell>
    )
  }

  if (!signedIn) {
    return (
      <Shell onClose={close}>
        <Question title="First, a free account" hint="It takes 30 seconds, and it's how you'll edit the profile later." />
        <Big label="Create account or sign in" icon="person-add" onPress={() => router.push("/sign-in")} />
      </Shell>
    )
  }

  return (
    <Shell onClose={close} onBack={["saving", "done"].includes(step) ? undefined : back} progress={progress}>
      {step === "who" ? (
        <>
          <Question title="Who's creating this profile?" />
          <Big label="I'm the wrestler" icon="person" onPress={() => { setRel("self"); setStep("name") }} />
          <Big label="I'm a parent or guardian" icon="people" onPress={() => { setRel("parent"); setStep("signature") }} />
        </>
      ) : null}

      {step === "signature" ? (
        <>
          <Question
            title="Your full name"
            hint="As the parent or guardian, typing your name confirms you're allowed to manage your wrestler's profile."
          />
          <Field value={signedName} onChange={setSignedName} placeholder="First and last name" autoFocus />
          <Next disabled={signedName.trim().split(/\s+/).length < 2} onPress={next} />
        </>
      ) : null}

      {step === "name" ? (
        <>
          <Question title={`What's ${whose} name?`} />
          <Field value={firstName} onChange={setFirstName} placeholder="First name" autoFocus />
          <Field value={lastName} onChange={setLastName} placeholder="Last name" />
          <Next disabled={!firstName.trim() || !lastName.trim()} onPress={next} />
        </>
      ) : null}

      {step === "gender" ? (
        <>
          <Question title="Boy or girl?" />
          <Big label="Boy" onPress={() => { setGender("Male"); setWeight(null); next() }} />
          <Big label="Girl" onPress={() => { setGender("Female"); setWeight(null); next() }} />
        </>
      ) : null}

      {step === "year" ? (
        <>
          <Question title="Graduating class?" />
          <View style={styles.grid}>
            {graduationYears().map((y) => (
              <Chip key={y} label={`Class of ${y}`} on={year === y} onPress={() => { setYear(y); next() }} wide />
            ))}
          </View>
        </>
      ) : null}

      {step === "school" ? (
        <>
          <Question title="High school?" />
          <Field value={school} onChange={setSchool} placeholder="e.g. Leesville Road" autoFocus />
          <Next disabled={school.trim().length < 2} onPress={next} />
        </>
      ) : null}

      {step === "weight" ? (
        <>
          <Question title="Weight class right now?" hint="Results update this automatically after every tournament." />
          {rows(WEIGHTS[gender], 4).map((row, i) => (
            <View key={i} style={styles.row}>
              {row.map((w, j) =>
                w ? <Chip key={w} label={w} on={weight === w} onPress={() => { setWeight(w); next() }} fill /> : <View key={`pad${j}`} style={[styles.chip, styles.flex, styles.ghost]} />,
              )}
            </View>
          ))}
        </>
      ) : null}

      {step === "academics" ? (
        <>
          <Question title="Grades?" hint="Optional, but it's the first thing college coaches filter on." />
          <Field value={gpa} onChange={setGpa} placeholder="GPA (e.g. 3.6)" keyboard="decimal-pad" autoFocus />
          <View style={styles.row}>
            <View style={styles.flex}><Field value={sat} onChange={setSat} placeholder="SAT" keyboard="number-pad" /></View>
            <View style={styles.flex}><Field value={act} onChange={setAct} placeholder="ACT" keyboard="number-pad" /></View>
          </View>
          {academicsProblem ? <Text style={styles.error}>{academicsProblem}</Text> : null}
          <Next disabled={Boolean(academicsProblem)} onPress={next} />
          {!gpa.trim() && !sat.trim() && !act.trim() ? (
            <Pressable onPress={next}><Text style={styles.skip}>Skip for now</Text></Pressable>
          ) : null}
        </>
      ) : null}

      {step === "study" ? (
        <>
          <Question title="What do you want to study in college?" hint="Pick the closest — you can change it later." />
          {rows(STUDY, 2).map((row, i) => (
            <View key={i} style={styles.row}>
              {row.map((f, j) =>
                f ? <Chip key={f} label={f} on={study === f} onPress={() => { setStudy(f); next() }} fill small /> : <View key={`pad${j}`} style={[styles.chip, styles.flex, styles.ghost]} />,
              )}
            </View>
          ))}
          <Pressable onPress={() => { setStudy(null); next() }}><Text style={styles.skip}>Not sure yet</Text></Pressable>
        </>
      ) : null}

      {step === "club" ? (
        <>
          <Question title="Wrestling club?" hint="Optional." />
          <Field value={club} onChange={setClub} placeholder="e.g. Combat, RAW, Darkhorse" autoFocus />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Big label="Create profile" icon="checkmark-circle" onPress={() => void submit()} />
          {!club.trim() ? <Pressable onPress={() => void submit()}><Text style={styles.skip}>Skip — no club</Text></Pressable> : null}
        </>
      ) : null}

      {step === "saving" ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.hint}>Setting it up…</Text>
        </View>
      ) : null}

      {step === "found" && found ? (
        <>
          <Question
            title={rel === "self" ? "Is this you?" : "Is this your wrestler?"}
            hint="We already have a profile built from tournament results."
          />
          <View style={styles.card}>
            <Text style={styles.cardName}>{found.athleteName}</Text>
            <Text style={styles.hint}>{[found.highSchool, `Class of ${found.graduationYear}`].filter(Boolean).join(" · ")}</Text>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Big label={rel === "self" ? "Yes, that's me" : "Yes, that's my wrestler"} icon="checkmark-circle" onPress={() => void claimFound()} />
          <Pressable onPress={() => void submit(true)}>
            <Text style={styles.skip}>No — create a new profile</Text>
          </Pressable>
        </>
      ) : null}

      {step === "done" && result ? (
        <>
          <View style={styles.centre}>
            <Ionicons name="checkmark-circle" size={64} color={colors.gold} />
          </View>
          <Question
            title={`${result.athleteName} is on RecruitNC`}
            hint="College coaches can find the profile now. Add a photo next — profiles with one get opened the most."
          />
          {/* The app cannot pick a photo until a native build adds the picker; the website's
              editor opens signed in, straight to the photo (?edit=photo). */}
          <Big
            label="Add a photo"
            icon="camera"
            onPress={() => openWebPage(`/view-profile?id=${encodeURIComponent(result.athleteId)}&edit=photo`)}
          />
          <Big
            label="Add film and contact"
            icon="create"
            onPress={() => router.replace({ pathname: "/athlete-edit", params: { id: result.athleteId, name: result.athleteName } })}
          />
          <Pressable onPress={() => router.replace({ pathname: "/athlete/[id]", params: { id: result.athleteId, name: result.athleteName } })}>
            <Text style={styles.skip}>View the profile</Text>
          </Pressable>
        </>
      ) : null}
    </Shell>
  )
}

function Shell({
  children,
  onClose,
  onBack,
  progress,
}: {
  children: React.ReactNode
  onClose: () => void
  onBack?: () => void
  progress?: number
}) {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.bar}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} style={styles.barButton}>
            <Ionicons name="chevron-back" size={22} color={colors.gold} />
          </Pressable>
        ) : (
          <View style={styles.barButton} />
        )}
        <View style={styles.track}>{progress != null ? <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} /> : null}</View>
        <Pressable onPress={onClose} hitSlop={12} style={styles.barButton} accessibilityLabel="Close">
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </Pressable>
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function Question({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.question}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

/** Stored as the label, in the same free-text column the website's "Academic interest" box fills. */
const STUDY = [
  "Business",
  "Engineering",
  "Pre-Med / Medicine",
  "Nursing & Health",
  "Pre-Law / Law",
  "Education",
  "Sports Science",
  "Computer Science",
  "Criminal Justice",
  "Communications",
  "Agriculture",
  "Military / ROTC",
] as const

/** Blank is fine; anything typed has to be a real score. */
function checkAcademics(gpa: string, sat: string, act: string): string | null {
  const bad = (v: string, min: number, max: number) => v.trim() !== "" && !(Number(v) >= min && Number(v) <= max)
  if (bad(gpa, 0, 5)) return "GPA should be between 0 and 5."
  if (bad(sat, 400, 1600)) return "SAT should be between 400 and 1600."
  if (bad(act, 1, 36)) return "ACT should be between 1 and 36."
  return null
}

/** Equal-width rows; the last is padded with nulls so its buttons match the rest. */
function rows<T>(items: readonly T[], size: number): (T | null)[][] {
  const out: (T | null)[][] = []
  for (let i = 0; i < items.length; i += size) {
    const row: (T | null)[] = items.slice(i, i + size)
    while (row.length < size) row.push(null)
    out.push(row)
  }
  return out
}

function Field(props: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  autoFocus?: boolean
  keyboard?: "decimal-pad" | "number-pad"
}) {
  return (
    <TextInput
      style={styles.input}
      value={props.value}
      onChangeText={props.onChange}
      placeholder={props.placeholder}
      placeholderTextColor={colors.textMuted}
      autoFocus={props.autoFocus}
      keyboardType={props.keyboard ?? "default"}
      autoCapitalize="words"
      autoCorrect={false}
      returnKeyType="next"
    />
  )
}

function Big({ label, icon, onPress }: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.big, pressed && styles.pressed]} onPress={onPress}>
      {icon ? <Ionicons name={icon} size={20} color={colors.ink} /> : null}
      <Text style={styles.bigText}>{label}</Text>
    </Pressable>
  )
}

function Next({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.big, disabled && styles.disabled]} disabled={disabled} onPress={onPress}>
      <Text style={styles.bigText}>Next</Text>
      <Ionicons name="arrow-forward" size={18} color={colors.ink} />
    </Pressable>
  )
}

function Chip(props: { label: string; on: boolean; onPress: () => void; wide?: boolean; fill?: boolean; small?: boolean }) {
  const { label, on, onPress, wide, fill, small } = props
  return (
    <Pressable style={[styles.chip, wide && styles.chipWide, fill && styles.flex, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, small && styles.chipSmall, on && styles.chipTextOn]} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  flex: { flex: 1 },
  bar: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  barButton: { width: 28, alignItems: "center" },
  track: { flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: colors.surface, overflow: "hidden" },
  fill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.gold },
  content: { padding: space.xl, gap: space.md, paddingBottom: space.xxl * 2 },
  question: { gap: space.sm, marginBottom: space.sm, marginTop: space.lg },
  title: { ...type.title, fontSize: 26, color: colors.text },
  hint: { ...type.body, color: colors.textSecondary, fontWeight: "400", lineHeight: 21 },
  input: {
    ...type.body,
    fontSize: 18,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space.lg,
    paddingVertical: 16,
  },
  big: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 18,
    marginTop: space.sm,
  },
  bigText: { ...type.heading, color: colors.ink, fontWeight: "800" },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.35 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  row: { flexDirection: "row", gap: space.sm },
  ghost: { opacity: 0 },
  chip: {
    minWidth: 72,
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipWide: { width: "100%" },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { ...type.heading, color: colors.text },
  chipTextOn: { color: colors.ink },
  chipSmall: { fontSize: 15, fontWeight: "700" },
  skip: { ...type.label, color: colors.gold, textAlign: "center", marginTop: space.md },
  error: { ...type.label, color: colors.red, fontWeight: "600" },
  centre: { alignItems: "center", gap: space.md, marginTop: space.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space.lg, gap: 4 },
  cardName: { ...type.title, color: colors.text },
})
