import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Pressable, Text, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors } from "@/theme/tokens"
import { Big, Chip, Field, Next, Question, Shell, rows, wizardStyles as styles } from "@/components/wizard"
import {
  PROFILE_CLASS_YEARS,
  REPORTER_ROLES,
  isContact,
  loadColleges,
  ncDay,
  searchWrestlers,
  sendCommitmentReport,
  signedInEmail,
  type College,
  type ReporterRole,
  type WrestlerHit,
} from "@/lib/report-commitment"

/**
 * Report a commitment, one question at a time (Matt, 26 October 2026).
 *
 * The wrestler, a parent or a coach - whoever has the news. It asks only what we do not hold: pick
 * the wrestler and the school, class and club come from the profile. Matt gets a text, approves
 * with one tap, and the profile, the Commits tab and the alert to every phone follow. Opened with
 * `?athlete=<id>&name=` from a profile, it starts at the college.
 */
type Step = "who" | "wrestler" | "basics" | "college" | "when" | "post" | "you" | "sending" | "done"

function close() {
  if (router.canGoBack()) router.back()
  else router.replace("/")
}

const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })

export default function ReportCommitmentScreen() {
  const params = useLocalSearchParams<{ athlete?: string; name?: string; role?: string }>()
  const preset: WrestlerHit | null = params.athlete
    ? { id: String(params.athlete), name: String(params.name ?? ""), graduationYear: null, highSchool: null, club: null, college: null }
    : null

  const [step, setStep] = useState<Step>("who")
  const [role, setRole] = useState<ReporterRole | null>(null)
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<WrestlerHit[]>([])
  const [searching, setSearching] = useState(false)
  const [wrestler, setWrestler] = useState<WrestlerHit | null>(preset)
  const [newName, setNewName] = useState("")
  const [newSchool, setNewSchool] = useState("")
  const [newYear, setNewYear] = useState<number | null>(null)
  const [newGender, setNewGender] = useState<"Male" | "Female" | null>(null)
  const [colleges, setColleges] = useState<College[]>([])
  const [collegeQuery, setCollegeQuery] = useState("")
  const [college, setCollege] = useState<College | null>(null)
  const [collegeTyped, setCollegeTyped] = useState("")
  const [date, setDate] = useState(ncDay(0))
  const [earlier, setEarlier] = useState(false)
  const [post, setPost] = useState("")
  const [yourName, setYourName] = useState("")
  const [contact, setContact] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadColleges().then(setColleges)
    void signedInEmail().then((e) => e && setContact((c) => c || e))
  }, [])

  useEffect(() => {
    if (step !== "wrestler") return
    const q = query.trim()
    if (q.length < 2) return setHits([])
    setSearching(true)
    const t = setTimeout(() => {
      void searchWrestlers(q).then((h) => {
        setHits(h)
        setSearching(false)
      })
    }, 250)
    return () => clearTimeout(t)
  }, [query, step])

  const collegeHits = useMemo(() => {
    const q = collegeQuery.trim().toLowerCase()
    return q.length < 2 ? [] : colleges.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6)
  }, [collegeQuery, colleges])

  const self = role === "athlete"
  const flow: Step[] = useMemo(
    () => ["who", ...(preset ? [] : (["wrestler", ...(wrestler ? [] : ["basics"])] as Step[])), "college", "when", "post", "you"],
    [preset, wrestler],
  )
  const index = flow.indexOf(step)
  const progress = index >= 0 ? (index + 1) / flow.length : 1
  const next = () => setStep(flow[Math.min(index + 1, flow.length - 1)]!)
  const back = () => (index > 0 ? setStep(flow[index - 1]!) : close())
  const wrestlerName = wrestler?.name || newName.trim()
  const collegeName = college?.name ?? collegeTyped

  const send = async () => {
    if (!role) return
    setError(null)
    setStep("sending")
    const out = await sendCommitmentReport({
      athleteId: wrestler?.id ?? null,
      athleteName: wrestler ? null : newName.trim(),
      highSchool: wrestler ? null : newSchool.trim() || null,
      graduationYear: wrestler ? null : newYear,
      gender: wrestler ? null : newGender,
      collegeId: college?.id ?? null,
      collegeName: college ? null : collegeTyped,
      commitmentDate: date,
      announcementUrl: post.trim() || null,
      submitterName: yourName.trim(),
      submitterRole: role,
      submitterContact: contact.trim(),
    })
    if (out.ok) setStep("done")
    else {
      setError(out.error)
      setStep("you")
    }
  }

  return (
    <Shell onClose={close} onBack={["sending", "done"].includes(step) ? undefined : back} progress={step === "done" ? 1 : progress}>
      {step === "who" ? (
        <>
          <Question title="Report a commitment" hint="Who's sending it? We check every one, then it goes on the profile and out to everyone on the app." />
          {REPORTER_ROLES.map(({ role: r, label }) => (
            <Chip key={r} label={label} on={role === r} wide onPress={() => { setRole(r); next() }} />
          ))}
        </>
      ) : null}

      {step === "wrestler" ? (
        <>
          <Question title={self ? "Find your profile" : "Who committed?"} />
          <Field value={query} onChange={(v) => { setQuery(v); setWrestler(null) }} placeholder="Start typing the name" autoFocus />
          {searching ? <ActivityIndicator color={colors.gold} /> : null}
          {hits.map((h) => (
            <Pressable key={h.id} style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => { setWrestler(h); setStep("college") }}>
              <Text style={styles.cardName}>{h.name}</Text>
              <Text style={styles.hint}>{[h.highSchool, h.graduationYear ? `Class of ${h.graduationYear}` : null, h.club].filter(Boolean).join(" · ") || "No school on file"}</Text>
              {h.college ? <Text style={[styles.hint, { color: colors.gold }]}>Profile already says {h.college}</Text> : null}
            </Pressable>
          ))}
          {query.trim().length >= 2 && !searching ? (
            <Pressable onPress={() => { setNewName(query.trim()); setStep("basics") }}>
              <Text style={styles.skip}>{hits.length ? "Not in this list? Add the basics" : `No profile for ${query.trim()} yet. Add the basics`}</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {step === "basics" ? (
        <>
          <Question title="No profile yet" hint="These are all we need to add one." />
          <Field value={newName} onChange={setNewName} placeholder="First and last name" />
          <Field value={newSchool} onChange={setNewSchool} placeholder="High school" />
          <View style={styles.row}>
            {PROFILE_CLASS_YEARS.map((y) => (
              <Chip key={y} label={String(y)} on={newYear === y} fill small onPress={() => setNewYear(y)} />
            ))}
          </View>
          <View style={styles.row}>
            <Chip label="Boys" on={newGender === "Male"} fill onPress={() => setNewGender("Male")} />
            <Chip label="Girls" on={newGender === "Female"} fill onPress={() => setNewGender("Female")} />
          </View>
          <Next disabled={newName.trim().split(/\s+/).length < 2 || !newYear} onPress={next} />
        </>
      ) : null}

      {step === "college" ? (
        <>
          <Question
            title={wrestlerName ? `Where is ${wrestlerName.split(" ")[0]} going?` : "Which college?"}
            hint={wrestler?.college ? `The profile already says ${wrestler.college}. Send this only if that has changed.` : undefined}
          />
          <Field value={collegeQuery} onChange={(v) => { setCollegeQuery(v); setCollege(null); setCollegeTyped("") }} placeholder="Start typing the college" autoFocus />
          {collegeHits.map((c) => (
            <Pressable key={c.id} style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => { setCollege(c); setCollegeTyped(""); next() }}>
              <Text style={styles.cardName}>{c.name}</Text>
              {c.division ? <Text style={styles.hint}>{c.division}</Text> : null}
            </Pressable>
          ))}
          {collegeQuery.trim().length >= 3 ? (
            <Pressable onPress={() => { setCollege(null); setCollegeTyped(collegeQuery.trim()); next() }}>
              <Text style={styles.skip}>Use “{collegeQuery.trim()}”</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {step === "when" ? (
        <>
          <Question title="When did it go public?" />
          <Chip label="Today" on={date === ncDay(0)} wide onPress={() => { setDate(ncDay(0)); next() }} />
          <Chip label="Yesterday" on={date === ncDay(1)} wide onPress={() => { setDate(ncDay(1)); next() }} />
          {earlier ? (
            rows(Array.from({ length: 28 }, (_, i) => ncDay(i + 2)), 2).map((row, i) => (
              <View key={i} style={styles.row}>
                {row.map((d, j) => (d ? <Chip key={d} label={dayLabel(d)} on={date === d} fill small onPress={() => { setDate(d); next() }} /> : <View key={`pad${j}`} style={[styles.chip, styles.flex, styles.ghost]} />))}
              </View>
            ))
          ) : (
            <Chip label="Earlier" on={false} wide onPress={() => setEarlier(true)} />
          )}
        </>
      ) : null}

      {step === "post" ? (
        <>
          <Question title="Link to the post?" hint="The Instagram or X announcement helps us confirm it in one look." />
          <Field value={post} onChange={setPost} placeholder="Paste the link" keyboard="url" plain autoFocus />
          {post.trim() ? (
            <Next disabled={false} onPress={next} />
          ) : (
            <Pressable onPress={next}>
              <Text style={styles.skip}>Skip, no link</Text>
            </Pressable>
          )}
        </>
      ) : null}

      {step === "you" ? (
        <>
          <Question title="Your name and how to reach you" hint="Only to tell you it's live, or to ask if something is unclear. Never shown." />
          <Field value={yourName} onChange={setYourName} placeholder="Your name" autoFocus />
          <Field value={contact} onChange={setContact} placeholder="Email or cell" keyboard="email-address" plain />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={[styles.big, !(yourName.trim() && isContact(contact)) && styles.disabled]}
            disabled={!(yourName.trim() && isContact(contact))}
            onPress={() => void send()}
          >
            <Ionicons name="paper-plane" size={18} color={colors.ink} />
            <Text style={styles.bigText}>Send {wrestlerName.split(" ")[0]} to {collegeName}</Text>
          </Pressable>
        </>
      ) : null}

      {step === "sending" ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.hint}>Sending…</Text>
        </View>
      ) : null}

      {step === "done" ? (
        <>
          <View style={styles.centre}>
            <Ionicons name="checkmark-circle" size={64} color={colors.gold} />
          </View>
          <Question
            title={self ? `Congratulations, ${wrestlerName.split(" ")[0]}.` : "Thank you. We have it."}
            hint={`${wrestlerName} to ${collegeName} is with us now. Once we check it, it goes on the profile and out to everyone on the app, and we'll ${/@/.test(contact) ? "email" : "text"} you when it's live.`}
          />
          <Big label="Done" icon="checkmark" onPress={close} />
        </>
      ) : null}
    </Shell>
  )
}
