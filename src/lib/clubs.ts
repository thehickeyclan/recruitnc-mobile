const BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL

const REQUEST_TIMEOUT_MS = 20_000

export type ClubPin = {
  id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  latitude: number
  longitude: number
  website: string | null
  logoUrl: string | null
  verified: boolean
  contactPhone: string | null
  contactEmail: string | null
  instagramUrl: string | null
  facebookUrl: string | null
  athleteCount: number
  boysCount: number
  girlsCount: number
  commitCount: number
}

/** A club we hold but could not geocode — real clubs, so they belong in the list. */
export type UnlocatedClub = {
  id: string
  name: string
  city: string | null
  state: string | null
  website: string | null
  contactPhone: string | null
}

export type ClubDirectory = {
  pins: ClubPin[]
  unlocated: UnlocatedClub[]
}

/**
 * The club directory, from the same `/api/clubs/map-pins` the website's Mapbox view reads.
 * One endpoint, one set of clubs — the app and the site cannot show different directories.
 */
export async function fetchClubs(signal?: AbortSignal): Promise<ClubDirectory> {
  if (!BASE) throw new Error("This build has no EXPO_PUBLIC_WEB_BASE_URL.")

  const response = await fetch(`${BASE}/api/clubs/map-pins`, {
    headers: { Accept: "application/json" },
    signal: signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  const data = (await response.json().catch(() => null)) as
    | { pins?: ClubPin[]; unlocatedClubs?: UnlocatedClub[]; error?: string }
    | null

  if (!response.ok || !data || data.error) {
    throw new Error(data?.error ?? "Could not load clubs right now.")
  }

  // A pin without real coordinates would sit at (0, 0) in the Atlantic.
  const pins = (data.pins ?? []).filter(
    (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && (p.latitude !== 0 || p.longitude !== 0),
  )

  return { pins, unlocated: data.unlocatedClubs ?? [] }
}

const EARTH_RADIUS_MILES = 3958.8

/** Great-circle distance in miles. Good enough to sort a list of clubs by nearness. */
export function distanceMiles(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(to.latitude - from.latitude)
  const dLon = toRad(to.longitude - from.longitude)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Centre and zoom that fit every pin — the whole state when nothing else is known. */
export function fitCamera(pins: ClubPin[]): { coordinates: { latitude: number; longitude: number }; zoom: number } {
  if (pins.length === 0) {
    // Roughly the middle of North Carolina.
    return { coordinates: { latitude: 35.5, longitude: -79.2 }, zoom: 6 }
  }

  const lats = pins.map((p) => p.latitude)
  const lons = pins.map((p) => p.longitude)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)

  const span = Math.max(maxLat - minLat, maxLon - minLon)
  // Rough span → zoom mapping; the map clamps anything it cannot render.
  const zoom = span > 8 ? 5 : span > 4 ? 6 : span > 2 ? 7 : span > 1 ? 8 : 9

  return {
    coordinates: { latitude: (minLat + maxLat) / 2, longitude: (minLon + maxLon) / 2 },
    zoom,
  }
}

/** Apple Maps directions for a club, by coordinates with the name as the label. */
export function directionsUrl(club: Pick<ClubPin, "name" | "latitude" | "longitude">): string {
  const label = encodeURIComponent(club.name)
  return `http://maps.apple.com/?daddr=${club.latitude},${club.longitude}&q=${label}`
}
