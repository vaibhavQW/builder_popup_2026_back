// Google Identity Services — OAuth2 token flow.
// We request an access token in the browser, hand it to our backend once, and the
// backend reads the user's *own* profile / YouTube channel / Blogger blogs with it.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

export const SCOPES = {
  base: ['openid', 'email', 'profile'],
  youtube: 'https://www.googleapis.com/auth/youtube.readonly',
  blogger: 'https://www.googleapis.com/auth/blogger.readonly',
}

type TokenResponse = { access_token?: string; error?: string; error_description?: string }
type TokenClient = { requestAccessToken: (o?: { prompt?: string }) => void }

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string
            scope: string
            callback: (r: TokenResponse) => void
            error_callback?: (e: { type: string; message?: string }) => void
          }) => TokenClient
        }
      }
    }
  }
}

let loading: Promise<void> | null = null

export function preloadGoogle(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve()
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      loading = null
      reject(new Error('Could not load Google sign-in'))
    }
    document.head.appendChild(s)
  })
  return loading
}

export function googleConfigured() {
  return Boolean(CLIENT_ID)
}

/** Must be called from a click handler so the consent popup isn't blocked. */
export function requestGoogleToken(opts: { youtube: boolean; blogger: boolean }): Promise<string> {
  if (!CLIENT_ID) return Promise.reject(new Error('VITE_GOOGLE_CLIENT_ID is not set'))
  const g = window.google
  if (!g) return Promise.reject(new Error('Google sign-in is still loading, try again'))
  const scope = [...SCOPES.base, ...(opts.youtube ? [SCOPES.youtube] : []), ...(opts.blogger ? [SCOPES.blogger] : [])]
  return new Promise((resolve, reject) => {
    const client = g.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: scope.join(' '),
      callback: (r) =>
        r.access_token ? resolve(r.access_token) : reject(new Error(r.error_description || r.error || 'Sign-in failed')),
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'Sign-in cancelled' : e.message || e.type)),
    })
    client.requestAccessToken({ prompt: 'consent' })
  })
}
