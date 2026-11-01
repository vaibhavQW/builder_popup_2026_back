import { useEffect, useState } from 'react'
import { api, money, type Cafe, type Order } from '../api'

const STEPS = ['placed', 'preparing', 'ready', 'served'] as const
const LABEL: Record<string, string> = {
  placed: 'In the queue',
  preparing: 'Being prepared',
  ready: 'Ready! Pick it up or it’s on the way',
  served: 'Served — enjoy',
  cancelled: 'Cancelled',
}

export default function OrdersTab({ cafe, tokens, onBrowse }: { cafe: Cafe; tokens: string[]; onBrowse: () => void }) {
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    if (!tokens.length) return
    let alive = true
    const load = () =>
      Promise.all(tokens.map((t) => api<Order>(`/api/orders/${t}`).catch(() => null))).then((os) => {
        if (alive) setOrders(os.filter((o): o is Order => o !== null))
      })
    load()
    const id = setInterval(load, 8000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [tokens])

  if (!tokens.length)
    return (
      <div className="empty">
        <p>No orders yet.</p>
        <button className="btn primary" onClick={onBrowse}>Browse the menu</button>
      </div>
    )

  return (
    <>
      {orders.map((o) => {
        const step = STEPS.indexOf(o.status as (typeof STEPS)[number])
        return (
          <article key={o.token} className={'card order ' + o.status}>
            <div className="row between">
              <h2>Order #{o.id}</h2>
              <span className="muted small">{new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="status-line">{LABEL[o.status]}</p>
            {(o.status === 'placed' || o.status === 'preparing') && (
              <p className="eta">
                <span className="big">{o.eta_minutes <= 1 ? '<1' : o.eta_minutes}</span> min
                <span className="muted small">
                  {' '}
                  · {o.position === 0 ? 'you’re next' : `${o.position} order${o.position > 1 ? 's' : ''} ahead`}
                </span>
              </p>
            )}
            {o.status !== 'cancelled' && (
              <ol className="progress" aria-label="Order progress">
                {STEPS.map((s, i) => (
                  <li key={s} className={i <= step ? 'done' : ''}>{s}</li>
                ))}
              </ol>
            )}
            <ul className="items">
              {o.items.map((i, k) => (
                <li key={k}>
                  {i.qty}× {i.name}
                </li>
              ))}
            </ul>
            <p className="small">
              Total <strong>{money(o.total_cents, cafe.currency)}</strong>
            </p>
          </article>
        )
      })}
    </>
  )
}
