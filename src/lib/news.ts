const WEB = process.env.EXPO_PUBLIC_WEB_BASE_URL

export type NewsItem = {
  /** The top-story card's tap line, sent per story by the site (e.g. "Follow NC live at Super 32 HQ"). */
  actionLabel?: string | null
  slug: string
  title: string
  summary: string
  category: string | null
  date: string
  image: string | null
  /** In-site path to open in the web sheet, when the article lives on the website. */
  path: string | null
  url: string | null
}

/** The newest articles, newest (or pinned) first. From the website's registry, lib/news.ts. */
export async function fetchLatestNews(): Promise<NewsItem[]> {
  const res = await fetch(`${WEB}/api/mobile/v1/news`)
  if (!res.ok) throw new Error(`news ${res.status}`)
  const body = (await res.json()) as { items?: NewsItem[] }
  return body.items ?? []
}
