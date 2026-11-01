export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8080'

// ---------------------------------------------------------------- types
export type MenuItem = {
  id: number
  name: string
  description: string
  category: string
  price_cents: number
  prep_minutes: number
  tags: string[]
  available: boolean
}

export type Cafe = {
  slug: string
  name: string
  tagline: string
  currency: string
  table_count: number
  wait_minutes: number
  people_here: number
  menu: MenuItem[]
}

export type OrderStatus = 'placed' | 'preparing' | 'ready' | 'served' | 'cancelled'

export type Order = {
  id: number
  token: string
  table: number
  status: OrderStatus
  note: string
  total_cents: number
  created_at: string
  ready_at: string | null
  eta: string | null
  eta_minutes: number
  position: number
  items: { name: string; qty: number; price_cents: number }[]
}

export type YouTube = {
  channel_id: string
  title: string
  description: string
  thumbnail: string
  url: string
  subscribers: number | null
  videos: number | null
  views: number | null
  recent: { title: string; url: string; thumbnail: string; published_at: string }[]
}

export type Blog = {
  name: string
  url: string
  post_count: number
  recent: { title: string; url: string; published_at: string }[]
}

export type Person = {
  id: number
  name: string
  picture: string
  bio: string
  table: number | null
  youtube: YouTube | null
  blogs: Blog[] | null
  maps_url: string | null
  demo?: boolean
}

export type Me = Person & {
  email: string
  share_youtube: boolean
  share_blogs: boolean
  share_maps: boolean
  maps_url: string
}

export type CheckIn = { table: number; visible: boolean; expires_at: string } | null

export type Room = { count: number; summary: string; themes: string[]; icebreakers: string[]; ai: boolean }
export type Icebreaker = { common_ground: string; openers: string[]; ai: boolean }
export type Recommendation = { message: string; picks: { id: number; reason: string }[]; ai: boolean }

// ---------------------------------------------------------------- session
const TOKEN_KEY = 'cc.session'

export const session = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* storage unavailable */
    }
  },
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const headers: Record<string, string> = { ...opts.headers }
  const token = session.get()
  if (token) headers.Authorization = `Bearer ${token}`
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(API_URL + path, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const j = await res.json()
      detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
    } catch {
      /* not json */
    }
    if (res.status === 401 && token) session.set(null)
    throw new ApiError(res.status, detail)
  }
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------- misc
export function money(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    cents / 100,
  )
}

export function compact(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat(undefined, { notation: 'compact' }).format(n)
}

/** Order tokens this device placed, per cafe — lets guests track orders without signing in. */
export const myOrders = {
  key: (slug: string) => `cc.orders.${slug}`,
  list(slug: string): string[] {
    try {
      return JSON.parse(localStorage.getItem(this.key(slug)) ?? '[]')
    } catch {
      return []
    }
  },
  add(slug: string, token: string) {
    try {
      const next = [token, ...this.list(slug)].slice(0, 10)
      localStorage.setItem(this.key(slug), JSON.stringify(next))
    } catch {
      /* ignore */
    }
  },
}
