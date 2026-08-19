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
import { colors, radius, space, type } from "@/theme/tokens"
import { sendPasswordReset, signIn, signUp } from "@/lib/auth"

type Mode = "signin" | "signup"

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
        if (!firstName.trim() || !lastName.trim()) throw new Error("Enter your first and last name.")
        await signUp({
          email,
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          cellPhone: cellPhone.trim() || undefined,
          profileType: "parent",
        })
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
              <Field label="First name" value={firstName} onChangeText={setFirstName} placeholder="Jordan" />
              <Field label="Last name" value={lastName} onChangeText={setLastName} placeholder="Smith" />
              <Field
                label="Cell phone"
                value={cellPhone}
                onChangeText={setCellPhone}
                placeholder="(919) 555-0134"
                keyboardType="phone-pad"
                optional
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
  link: { alignItems: "center", paddingVertical: space.md },
  linkText: { ...type.label, color: colors.gold },
})
