import { useCallback, useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "./supabase"

const BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL

export type Profile = {
  firstName: string | null
  lastName: string | null
  email: string | null
}

/**
 * Session state for the app. Sign-in talks to Supabase directly — the session has to live on the
 * device — but sign-up goes through the web app's /api/auth/signup so accounts created on a phone
 * get the same validation, verification email and profile row as accounts created on the website.
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => sub.subscription.unsubscribe()
  }, [])

  return { session, loading, signedIn: Boolean(session) }
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) {
    // Supabase says "Invalid login credentials" for both wrong password and unverified email.
    throw new Error(
      /invalid login/i.test(error.message)
        ? "Email or password is incorrect. If you just signed up, check your email for the verification link first."
        : error.message,
    )
  }
}

export async function signUp(input: {
  email: string
  password: string
  firstName: string
  lastName: string
  cellPhone?: string
  profileType: "parent" | "athlete" | "fan"
}): Promise<{ needsVerification: boolean }> {
  const response = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const data = (await response.json().catch(() => null)) as { error?: string } | null
  if (!response.ok) {
    throw new Error(data?.error ?? "Could not create your account.")
  }
  return { needsVerification: true }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${BASE}/auth/reset-password`,
  })
  if (error) throw new Error(error.message)
}

/** Apple requires account deletion to be reachable in the app, not by emailing support. */
export async function deleteAccount(): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("You are not signed in.")

  const response = await fetch(`${BASE}/api/account/delete`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? "Could not delete your account.")
  }
  await supabase.auth.signOut()
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from("user_profiles")
    .select("first_name, last_name, email")
    .eq("user_id", userId)
    .maybeSingle()
  if (!data) return null
  return { firstName: data.first_name, lastName: data.last_name, email: data.email }
}
