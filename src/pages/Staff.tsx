import { useEffect, useState } from 'react'
import { api, type OrderStatus } from '../api'

type StaffOrder = {
  id: number
  table: number
  status: OrderStatus
  note: string
  created_at: string
  eta: string | null
  items: { name: string; qty: number }[]
}

const NEXT: Partial<Record<OrderStatus, [OrderStatus, string]>> = {
  placed: ['preparing', 'Start'],
  preparing: ['ready', 'Ready'],
  ready: ['served', 'Served'],
}
const COLS: [OrderStatus, string][] = [
  ['placed', 'Queue'],
  ['preparing', 'Preparing'],
  ['ready', 'Ready'],
]

export default function Staff({ slug }: { slug: string }) {
  const [pin, setPin] = useState(() => sessionStorage.getItem('cc.pin') ?? '')
  const [authed, setAuthed] = useState(false)
  const [orders, setOrders] = useState<StaffOrder[]>([])
  const [error, setError] = useState('')

  const headers = { 'X-Staff-Pin': pin }

  async function load() {
    try {
      setOrders(await api<StaffOrder[]>(`/api/cafes/${slug}/staff/orders`, { headers }))
      setAuthed(true)
      setError('')
      sessionStorage.setItem('cc.pin', pin)
    } catch (e) {
      setError((e as Error).message)
      setAuthed(false)
    }
  }

  useEffect(() => {
    if (!authed) return
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed])

  async function move(o: StaffOrder, status: OrderStatus) {
    await api(`/api/cafes/${slug}/staff/orders/${o.id}`, { method: 'POST', body: { status }, headers })
    load()
  }

  if (!authed)
    return (
      <main className="home">
        <form className="home-card stack" onSubmit={(e) => (e.preventDefault(), load())}>
          <h1>Barista screen</h1>
          <input type="password" inputMode="numeric" placeholder="Staff PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
          <button className="btn primary">Open</button>
          {error && <p className="error">{error}</p>}
        </form>
      </main>
    )

  return (
    <div className="staff">
      <header className="topbar">
        <h1>Orders · {slug}</h1>
        <span className="muted small">auto-refreshing</span>
      </header>
      <div className="board">
        {COLS.map(([status, title]) => {
          const col = orders.filter((o) => o.status === status)
          return (
            <section key={status} className="column">
              <h2>{title} · {col.length}</h2>
              {col.map((o) => (
                <article key={o.id} className="card ticket">
                  <div className="row between">
                    <strong>#{o.id} · Table {o.table}</strong>
                    <span className="muted small">{minsAgo(o.created_at)}m ago</span>
                  </div>
                  <ul>{o.items.map((i, k) => <li key={k}>{i.qty}× {i.name}</li>)}</ul>
                  {o.note && <p className="note small">“{o.note}”</p>}
                  {o.eta && <p className="muted small">ETA {new Date(o.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
                  <div className="row">
                    {NEXT[o.status] && (
                      <button className="btn primary small" onClick={() => move(o, NEXT[o.status]![0])}>{NEXT[o.status]![1]}</button>
                    )}
                    {o.status !== 'ready' && <button className="btn small" onClick={() => move(o, 'cancelled')}>Cancel</button>}
                  </div>
                </article>
              ))}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function minsAgo(iso: string) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
}
