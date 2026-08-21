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
import Ionicons from "@expo/vector-icons/Ionicons"
import * as WebBrowser from "expo-web-browser"
import { colors, radius, space, type } from "@/theme/tokens"
import { sendPasswordReset, signIn, signUp, type ProfileType } from "@/lib/auth"

type Mode = "signin" | "signup"

const WEB = process.env.EXPO_PUBLIC_WEB_BASE_URL

/**
 * Who is signing up — the same six the website offers, in the same order.
 *
 * The app used to send "parent" for everybody, which made the role column meaningless and — worse
 * — silently required a phone number, because the signup API demands one for parent and athlete
 * accounts. The form called that field optional, so anyone who left it blank was rejected by a
 * rule the screen never mentioned.
 */
const ROLES: { value: ProfileType; label: string; hint: string }[] = [
  { value: "athlete", label: "Wrestler", hint: "Signing up for myself" },
  { value: "parent", label: "Parent", hint: "Registering a wrestler" },
  { value: "college-coach", label: "College coach", hint: "Recruiting athletes" },
  { value: "hs-club-coach", label: "HS or club coach", hint: "Coaching a team" },
  { value: "referee", label: "Referee", hint: "Officiating matches" },
  { value: "fan", label: "Fan", hint: "Following the sport" },
]

/**
 * Mirrors the server's auto-approval rule (lib/coach-auto-approve.ts in the web repo): a college
 * coach on a .edu address is approved on the spot. Only used to pick which sentence to show — the
 * server decides, this just avoids telling an already-approved coach to sit and wait.
 */
function isEduAddress(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@").pop() ?? ""
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.edu$/.test(domain)
}

/** Parent and athlete accounts need a reachable number; the signup API rejects them without one. */
function roleNeedsPhone(role: ProfileType | null): boolean {
  return role === "parent" || role === "athlete"
}

function RolePicker({
  value,
  onChange,
}: {
  value: ProfileType | null
  onChange: (r: ProfileType) => void
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>I AM A</Text>
      <View style={styles.roleRow}>
        {ROLES.map((r) => {
          const active = value === r.value
          return (
            <Pressable
              key={r.value}
              onPress={() => onChange(r.value)}
              style={[styles.role, active && styles.roleActive]}
            >
              <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>{r.label}</Text>
              <Text style={[styles.roleHint, active && styles.roleHintActive]}>{r.hint}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
  autoCapitalize,
  optional,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder: string
  secure?: boolean
  keyboardType?: "default" | "email-address" | "phone-pad"
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
        secureTextEntry={secure}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "words"}
        autoCorrect={false}
      />
    </View>
  )
}

export default function SignInScreen() {
  const { reason } = useLocalSearchParams<{ reason?: string }>()
  const [mode, setMode] = useState<Mode>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [cellPhone, setCellPhone] = useState("")
  const [role, setRole] = useState<ProfileType | null>(null)
  /** Set after signup, so the role-specific follow-up survives the flip back to sign-in. */
  const [signedUpAs, setSignedUpAs] = useState<ProfileType | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit() {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === "signin") {
        await signIn(email, password)
        router.back()
      } else {
        if (!role) throw new Error("Choose which of these you are so we set your account up right.")
        if (!firstName.trim() || !lastName.trim()) throw new Error("Enter your first and last name.")
        // Checked here as well as on the server so the message names the field the form shows,
        // rather than the API's wording about account types the user never chose.
        if (roleNeedsPhone(role) && cellPhone.replace(/\D/g, "").length < 10) {
          throw new Error("Enter a cell phone number — we need a way to reach you about practices.")
        }
        await signUp({
          email,
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          cellPhone: cellPhone.trim() || undefined,
          profileType: role,
        })
        setSignedUpAs(role)
        setNotice("Account created. Check your email for the verification link, then sign in.")
        setMode("signin")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setBusy(false)
    }
  }

  async function forgot() {
    if (!email.trim()) {
      setError("Enter your email address first, then tap Forgot password.")
      return
    }
    try {
      await sendPasswordReset(email)
      setNotice("If that address has an account, a reset link is on its way.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the reset email.")
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.gold} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>NC UNITED</Text>
          <Text style={styles.title}>{mode === "signin" ? "Sign in" : "Create account"}</Text>
          {reason ? <Text style={styles.subtitle}>{reason}</Text> : null}

          {mode === "signup" ? (
            <>
              <RolePicker value={role} onChange={setRole} />
              <Field label="First name" value={firstName} onChangeText={setFirstName} placeholder="Jordan" />
              <Field label="Last name" value={lastName} onChangeText={setLastName} placeholder="Smith" />
              <Field
                label="Cell phone"
                value={cellPhone}
                onChangeText={setCellPhone}
                placeholder="(919) 555-0134"
                keyboardType="phone-pad"
                optional={!roleNeedsPhone(role)}
              />
            </>
          ) : null}

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder={mode === "signup" ? "At least 6 characters" : ""}
            secure
            autoCapitalize="none"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          {/* A wrestler who signs up and stops there is invisible to the coaches searching this
              site, which is the whole reason they signed up. The prompt is deliberately shown
              after the account exists rather than as another step before it. */}
          {signedUpAs === "athlete" ? (
            <View style={styles.recruit}>
              <Text style={styles.recruitTitle}>Get in front of college coaches</Text>
              <Text style={styles.recruitBody}>
                Verify your email and sign in, then build your recruiting profile — results, weight,
                graduation year and film, in the place coaches already look.
              </Text>
              <Pressable
                style={styles.recruitButton}
                onPress={() =>
                  void WebBrowser.openBrowserAsync(`${WEB}/create-profile`, {
                    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
                    toolbarColor: colors.ink,
                    controlsColor: colors.gold,
                    dismissButtonStyle: "done",
                  }).catch(() => undefined)
                }
              >
                <Ionicons name="person-add-outline" size={16} color={colors.ink} />
                <Text style={styles.recruitButtonText}>Build my recruiting profile</Text>
              </Pressable>
            </View>
          ) : null}

          {/* A college coach's account is only half-open until an admin approves it. Saying so
              here stops the first question being "why can't I see contact details?" */}
          {signedUpAs === "college-coach" ? (
            <View style={styles.recruit}>
              <Text style={styles.recruitTitle}>Welcome, coach</Text>
              <Text style={styles.recruitBody}>
                {isEduAddress(email)
                  ? "Your .edu address approved you automatically. Verify your email, sign in, and you will have rankings, profiles, GPA, test scores and athlete contact details straight away."
                  : "Verify your email and you can browse rankings and profiles straight away. GPA, test scores and athlete contact details unlock once we have approved your account — we check these by hand, so it is usually within the hour."}
              </Text>
            </View>
          ) : null}

          <Pressable style={[styles.submit, busy && styles.disabled]} onPress={() => void submit()} disabled={busy}>
            {busy ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <Text style={styles.submitText}>{mode === "signin" ? "Sign in" : "Create account"}</Text>
            )}
          </Pressable>

          {mode === "signin" ? (
            <Pressable onPress={() => void forgot()} style={styles.link}>
              <Text style={styles.linkText}>Forgot password?</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => {
              setMode(mode === "signin" ? "signup" : "signin")
              setError(null)
              setNotice(null)
            }}
            style={styles.link}
          >
            <Text style={styles.linkText}>
              {mode === "signin" ? "No account? Create one" : "Already have an account? Sign in"}
            </Text>
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
  title: { ...type.display, color: colors.text },
  subtitle: { ...type.body, color: colors.textSecondary, marginTop: space.xs, marginBottom: space.md },
  field: { marginTop: space.md },
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
  error: { ...type.label, color: "#FF6B6B", fontWeight: "500", marginTop: space.lg, lineHeight: 18 },
  notice: { ...type.label, color: colors.success, fontWeight: "500", marginTop: space.lg, lineHeight: 18 },
  submit: {
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: space.lg,
    alignItems: "center",
    marginTop: space.xl,
  },
  disabled: { opacity: 0.6 },
  submitText: { ...type.heading, color: colors.ink },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  role: {
    // Two per row, sized so the six options stay one tidy grid rather than six stacked cards.
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    gap: 2,
  },
  roleActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  roleLabel: { ...type.label, color: colors.text, fontWeight: "700" },
  roleLabelActive: { color: colors.ink },
  roleHint: { ...type.caption, color: colors.textMuted, fontSize: 10 },
  roleHintActive: { color: colors.ink, opacity: 0.7 },

  recruit: {
    marginTop: space.lg,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.sm,
  },
  recruitTitle: { ...type.heading, color: colors.text },
  recruitBody: { ...type.label, color: colors.textSecondary, lineHeight: 19 },
  recruitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    marginTop: space.xs,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: space.md,
  },
  recruitButtonText: { ...type.label, color: colors.ink, fontWeight: "700" },

  link: { alignItems: "center", paddingVertical: space.md },
  linkText: { ...type.label, color: colors.gold },
})
