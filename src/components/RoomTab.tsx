import { useCallback, useEffect, useState } from 'react'
import { api, compact, session, type Cafe, type CheckIn, type Icebreaker, type Me, type Person, type Room } from '../api'
import { googleConfigured, requestGoogleToken } from '../google'

type Props = { cafe: Cafe; table: number; me: Me | null; setMe: (m: Me | null) => void }

export default function RoomTab({ cafe, table, me, setMe }: Props) {
  const [checkin, setCheckin] = useState<CheckIn | undefined>(undefined)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!me) return
    api<CheckIn>(`/api/cafes/${cafe.slug}/checkin`).then(setCheckin).catch((e) => setError(e.message))
  }, [me, cafe.slug])

  const doCheckin = useCallback(
    async (visible: boolean) => {
      setError('')
      try {
        setCheckin(await api<CheckIn>(`/api/cafes/${cafe.slug}/checkin`, { method: 'POST', body: { table, visible } }))
      } catch (e) {
        setError((e as Error).message)
      }
    },
    [cafe.slug, table],
  )

  if (!me) return <JoinCard onJoined={async (m) => { setMe(m); await doCheckin(true) }} />
  if (checkin === undefined) return <p className="muted center">Loading…</p>

  if (!checkin)
    return (
      <div className="card stack">
        <h2>Hi {me.name.split(' ')[0]} 👋</h2>
        <p>Join the room at table {table}? Others who joined will see your shared profile, and you’ll see theirs.</p>
        <button className="btn primary" onClick={() => doCheckin(true)}>Join the room</button>
        <SignOut slug={cafe.slug} setMe={setMe} />
        {error && <p className="error">{error}</p>}
      </div>
    )

  if (!checkin.visible)
    return (
      <div className="card stack">
        <h2>You’re hidden</h2>
        <p>While hidden, nobody can see you — and you can’t see who’s here either. It’s a two-way street.</p>
        <button className="btn primary" onClick={() => doCheckin(true)}>Become visible</button>
        <ProfilePanel cafe={cafe} me={me} setMe={setMe} onCheckout={() => setCheckin(null)} onHide={() => doCheckin(false)} visible={false} />
      </div>
    )

  return (
    <>
      <RoomVibe cafe={cafe} />
      <PeopleList cafe={cafe} me={me} table={table} />
      <ProfilePanel cafe={cafe} me={me} setMe={setMe} onCheckout={() => setCheckin(null)} onHide={() => doCheckin(false)} visible />
      {error && <p className="error">{error}</p>}
    </>
  )
}

// ------------------------------------------------------------------ join / consent
function JoinCard({ onJoined }: { onJoined: (m: Me) => Promise<void> }) {
  const [youtube, setYoutube] = useState(true)
  const [blogger, setBlogger] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function signIn() {
    setBusy(true)
    setError('')
    try {
      const access_token = await requestGoogleToken({ youtube, blogger })
      const res = await api<{ token: string; user: Me }>('/api/auth/google', { method: 'POST', body: { access_token } })
      session.set(res.token)
      await onJoined(res.user)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card stack join">
      <h2>See who’s here</h2>
      <p>
        Sign in with Google to join the room. You’ll see others who joined — their name, photo, YouTube channel, blogs
        and Google Maps contributions — and they’ll see yours.
      </p>

      <fieldset className="consent">
        <legend className="label">What you’ll share</legend>
        <label><input type="checkbox" checked disabled /> Name &amp; profile photo</label>
        <label><input type="checkbox" checked={youtube} onChange={(e) => setYoutube(e.target.checked)} /> My YouTube channel &amp; public videos</label>
        <label><input type="checkbox" checked={blogger} onChange={(e) => setBlogger(e.target.checked)} /> My Blogger blogs &amp; public posts</label>
        <p className="muted small">Google Maps: you can add your public contributor link after signing in.</p>
      </fieldset>

      <ul className="muted small privacy">
        <li>Your email is never shown to anyone.</li>
        <li>You’re only visible while checked in here ({'≤'} 3 hours), and you can hide or leave anytime.</li>
        <li>You can delete everything we stored with one tap.</li>
      </ul>

      <button className="btn google" onClick={signIn} disabled={busy || !googleConfigured()}>
        <span className="g">G</span> {busy ? 'Signing in…' : 'Continue with Google'}
      </button>
      {!googleConfigured() && <p className="error small">Google sign-in isn’t configured (VITE_GOOGLE_CLIENT_ID).</p>}
      {error && <p className="error">{error}</p>}
      <p className="muted small center">Prefer to stay private? No problem — the menu and ordering work without signing in.</p>
    </div>
  )
}

// ------------------------------------------------------------------ Gemini room read
function RoomVibe({ cafe }: { cafe: Cafe }) {
  const [room, setRoom] = useState<Room | null>(null)
  useEffect(() => {
    api<Room>(`/api/cafes/${cafe.slug}/room`).then(setRoom).catch(() => setRoom(null))
  }, [cafe.slug])
  if (!room) return null
  return (
    <section className="card vibe">
      <div className="row between">
        <h2>The room right now</h2>
        {room.ai && <span className="chip ai">Gemini</span>}
      </div>
      <p>{room.summary}</p>
      {room.themes.length > 0 && (
        <div className="chips">{room.themes.map((t) => <span key={t} className="chip">{t}</span>)}</div>
      )}
      {room.icebreakers.length > 0 && (
        <ul className="small icebreakers">{room.icebreakers.map((q) => <li key={q}>{q}</li>)}</ul>
      )}
    </section>
  )
}

// ------------------------------------------------------------------ people
function PeopleList({ cafe, me, table }: { cafe: Cafe; me: Me; table: number }) {
  const [people, setPeople] = useState<Person[] | null>(null)
  const [open, setOpen] = useState<Person | null>(null)

  useEffect(() => {
    let alive = true
    const load = () => api<Person[]>(`/api/cafes/${cafe.slug}/people`).then((p) => alive && setPeople(p)).catch(() => {})
    load()
    const id = setInterval(load, 20000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [cafe.slug])

  if (!people) return null
  return (
    <section>
      <h2 className="section-title">Here now · {people.length + 1}</h2>
      <div className="people">
        <div className="person you" aria-label="You">
          <Avatar person={me} />
          <div className="grow left">
            <strong>{me.name} <span className="chip">You</span></strong>
            <p className="muted small">Table {table}{me.bio ? ` · ${me.bio}` : ''}</p>
            <div className="chips">
              {me.youtube && me.share_youtube && <span className="chip yt">▶ {compact(me.youtube.subscribers)} subs</span>}
              {me.blogs?.length && me.share_blogs ? <span className="chip">✎ {me.blogs.length} blog{me.blogs.length > 1 ? 's' : ''}</span> : null}
              {me.maps_url && me.share_maps && <span className="chip">📍 Maps</span>}
            </div>
          </div>
        </div>
        {people.map((p) => (
          <button key={p.id} className="person" onClick={() => setOpen(p)}>
            <Avatar person={p} />
            <div className="grow left">
              <strong>{p.name} {p.demo && <span className="chip demo">Demo</span>}</strong>
              <p className="muted small">Table {p.table}{p.bio ? ` · ${p.bio}` : ''}</p>
              <div className="chips">
                {p.youtube && <span className="chip yt">▶ {compact(p.youtube.subscribers)} subs</span>}
                {p.blogs?.length ? <span className="chip">✎ {p.blogs.length} blog{p.blogs.length > 1 ? 's' : ''}</span> : null}
                {p.maps_url && <span className="chip">📍 Maps</span>}
              </div>
            </div>
          </button>
        ))}
      </div>
      {people.length === 0 && <p className="muted">Nobody else has joined yet. Check back in a bit!</p>}
      {open && <PersonSheet cafe={cafe} person={open} onClose={() => setOpen(null)} />}
    </section>
  )
}

function Avatar({ person, size = '' }: { person: Pick<Person, 'name' | 'picture'>; size?: string }) {
  return person.picture ? (
    <img className={'avatar ' + size} src={person.picture} alt="" referrerPolicy="no-referrer" />
  ) : (
    <span className={'avatar placeholder ' + size}>{person.name[0]}</span>
  )
}

function PersonSheet({ cafe, person, onClose }: { cafe: Cafe; person: Person; onClose: () => void }) {
  const [ice, setIce] = useState<Icebreaker | null>(null)
  const [loadingIce, setLoadingIce] = useState(false)
  const yt = person.youtube

  async function getIce() {
    setLoadingIce(true)
    try {
      setIce(await api<Icebreaker>(`/api/cafes/${cafe.slug}/people/${person.id}/icebreaker`))
    } finally {
      setLoadingIce(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={person.name}>
        <div className="sheet-head">
          <div className="row">
            <Avatar person={person} size="lg" />
            <div>
              <h2>{person.name} {person.demo && <span className="chip demo">Demo</span>}</h2>
              <p className="muted small">Table {person.table}</p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {person.bio && <p>{person.bio}</p>}

        {yt && (
          <section className="block">
            <h3>YouTube</h3>
            <a className="row link-card" href={yt.url} target="_blank" rel="noreferrer">
              {yt.thumbnail && <img className="avatar" src={yt.thumbnail} alt="" referrerPolicy="no-referrer" />}
              <div className="grow">
                <strong>{yt.title}</strong>
                <p className="muted small">
                  {compact(yt.subscribers)} subscribers · {compact(yt.videos)} videos · {compact(yt.views)} views
                </p>
              </div>
            </a>
            {yt.recent.length > 0 && (
              <div className="videos">
                {yt.recent.map((v) => (
                  <a key={v.url} href={v.url} target="_blank" rel="noreferrer" className="video">
                    {v.thumbnail && <img src={v.thumbnail} alt="" referrerPolicy="no-referrer" />}
                    <span className="small">{v.title}</span>
                  </a>
                ))}
              </div>
            )}
          </section>
        )}

        {person.blogs && person.blogs.length > 0 && (
          <section className="block">
            <h3>Blogs</h3>
            {person.blogs.map((b) => (
              <div key={b.url} className="blog">
                <a href={b.url} target="_blank" rel="noreferrer"><strong>{b.name}</strong></a>
                <span className="muted small"> · {b.post_count} posts</span>
                <ul className="small">
                  {b.recent.map((p) => (
                    <li key={p.url}><a href={p.url} target="_blank" rel="noreferrer">{p.title}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {person.maps_url && (
          <section className="block">
            <h3>Google Maps</h3>
            <a className="btn small" href={person.maps_url} target="_blank" rel="noreferrer">
              📍 See their reviews, ratings &amp; photos
            </a>
          </section>
        )}

        {!yt && !person.blogs?.length && !person.maps_url && (
          <p className="muted small">{person.name.split(' ')[0]} hasn’t shared any channels — just say hi!</p>
        )}

        <section className="block">
          {!ice ? (
            <button className="btn primary block" onClick={getIce} disabled={loadingIce}>
              {loadingIce ? 'Thinking…' : '✨ Suggest a conversation starter'}
            </button>
          ) : (
            <div className="card inset">
              <div className="row between">
                <h3>Say hi</h3>
                {ice.ai && <span className="chip ai">Gemini</span>}
              </div>
              {ice.common_ground && <p className="small">{ice.common_ground}</p>}
              <ul className="small">{ice.openers.map((o) => <li key={o}>{o}</li>)}</ul>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ my profile & privacy
function ProfilePanel({
  cafe, me, setMe, onCheckout, onHide, visible,
}: { cafe: Cafe; me: Me; setMe: (m: Me | null) => void; onCheckout: () => void; onHide: () => void; visible: boolean }) {
  const [bio, setBio] = useState(me.bio)
  const [maps, setMaps] = useState(me.maps_url)
  const [msg, setMsg] = useState('')

  async function patch(body: Partial<Me>) {
    setMsg('')
    try {
      setMe(await api<Me>('/api/me', { method: 'PATCH', body }))
      setMsg('Saved')
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  async function checkout() {
    await api(`/api/cafes/${cafe.slug}/checkin`, { method: 'DELETE' })
    onCheckout()
  }

  async function deleteAll() {
    if (!confirm('Delete your profile and everything Cafe Companion stored about you?')) return
    await api('/api/me', { method: 'DELETE' })
    session.set(null)
    setMe(null)
  }

  return (
    <details className="card profile">
      <summary>Your profile &amp; privacy</summary>
      <div className="stack">
        <label className="label" htmlFor="bio">One-liner others see</label>
        <input id="bio" value={bio} maxLength={280} onChange={(e) => setBio(e.target.value)} placeholder="Product designer, here till 6, happy to chat" />

        <label className="label" htmlFor="maps">Google Maps contributor link</label>
        <input id="maps" value={maps} onChange={(e) => setMaps(e.target.value)} placeholder="https://www.google.com/maps/contrib/…" />
        <p className="muted small">Google Maps app → your profile picture → <em>Your contributions</em> → Share profile.</p>
        <button className="btn" onClick={() => patch({ bio, maps_url: maps })}>Save</button>

        <p className="label">Show to others</p>
        <Toggle label={me.youtube ? `YouTube · ${me.youtube.title}` : 'YouTube (not connected)'} checked={me.share_youtube} disabled={!me.youtube} onChange={(v) => patch({ share_youtube: v })} />
        <Toggle label={me.blogs?.length ? `Blogs · ${me.blogs.length}` : 'Blogs (not connected)'} checked={me.share_blogs} disabled={!me.blogs?.length} onChange={(v) => patch({ share_blogs: v })} />
        <Toggle label="Google Maps link" checked={me.share_maps} disabled={!me.maps_url} onChange={(v) => patch({ share_maps: v })} />
        {msg && <p className="small muted">{msg}</p>}

        <div className="row wrap">
          {visible && <button className="btn" onClick={onHide}>Hide me</button>}
          <button className="btn" onClick={checkout}>Leave the room</button>
          <SignOut slug={cafe.slug} setMe={setMe} />
        </div>
        <button className="btn danger" onClick={deleteAll}>Delete my data</button>
      </div>
    </details>
  )
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={'toggle' + (disabled ? ' disabled' : '')}>
      <span className="grow">{label}</span>
      <input type="checkbox" checked={checked && !disabled} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

function SignOut({ slug, setMe }: { slug: string; setMe: (m: Me | null) => void }) {
  async function signOut() {
    // Leaving means you also disappear from the room immediately.
    await api(`/api/cafes/${slug}/checkin`, { method: 'DELETE' }).catch(() => {})
    session.set(null)
    setMe(null)
  }
  return (
    <button className="btn" onClick={signOut}>
      Sign out
    </button>
  )
}
