const WEB = process.env.EXPO_PUBLIC_WEB_BASE_URL

export type NewsItem = {
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
