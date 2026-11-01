import { useMemo, useState } from 'react'
import { api, money, type Cafe, type Order, type Recommendation } from '../api'

export default function MenuTab({ cafe, table, onOrdered }: { cafe: Cafe; table: number; onOrdered: (token: string) => void }) {
  const [cart, setCart] = useState<Record<number, number>>({})
  const [note, setNote] = useState('')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')
  const [showCart, setShowCart] = useState(false)

  const byId = useMemo(() => Object.fromEntries(cafe.menu.map((m) => [m.id, m])), [cafe.menu])
  const categories = useMemo(() => [...new Set(cafe.menu.map((m) => m.category))], [cafe.menu])
  const lines = Object.entries(cart).filter(([, q]) => q > 0)
  const count = lines.reduce((s, [, q]) => s + q, 0)
  const total = lines.reduce((s, [id, q]) => s + byId[Number(id)].price_cents * q, 0)

  const add = (id: number, d: number) => setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(20, (c[id] ?? 0) + d)) }))

  async function place() {
    setPlacing(true)
    setError('')
    try {
      const order = await api<Order>(`/api/cafes/${cafe.slug}/orders`, {
        method: 'POST',
        body: { table, note, items: lines.map(([id, qty]) => ({ menu_item_id: Number(id), qty })) },
      })
      setCart({})
      setNote('')
      setShowCart(false)
      onOrdered(order.token)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPlacing(false)
    }
  }

  return (
    <>
      <Recommender cafe={cafe} onAdd={(id) => add(id, 1)} />

      {categories.map((cat) => (
        <section key={cat} className="menu-section">
          <h2>{cat}</h2>
          {cafe.menu
            .filter((m) => m.category === cat)
            .map((m) => (
              <article key={m.id} className={'menu-item' + (m.available ? '' : ' sold-out')}>
                <div className="grow">
                  <h3>{m.name}</h3>
                  <p className="muted small">{m.description}</p>
                  <p className="small">
                    <strong>{money(m.price_cents, cafe.currency)}</strong>
                    <span className="muted"> · ~{m.prep_minutes} min</span>
                  </p>
                </div>
                {m.available ? (
                  <Qty value={cart[m.id] ?? 0} onChange={(d) => add(m.id, d)} name={m.name} />
                ) : (
                  <span className="muted small">Sold out</span>
                )}
              </article>
            ))}
        </section>
      ))}

      {count > 0 && (
        <div className="cart-bar">
          <button className="btn primary block" onClick={() => setShowCart(true)}>
            View order · {count} item{count > 1 ? 's' : ''} · {money(total, cafe.currency)}
          </button>
        </div>
      )}

      {showCart && (
        <div className="sheet-backdrop" onClick={() => setShowCart(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Your order">
            <div className="sheet-head">
              <h2>Your order · Table {table}</h2>
              <button className="icon-btn" onClick={() => setShowCart(false)} aria-label="Close">✕</button>
            </div>
            {lines.map(([id, q]) => {
              const m = byId[Number(id)]
              return (
                <div key={id} className="cart-line">
                  <span className="grow">{m.name}</span>
                  <Qty value={q} onChange={(d) => add(m.id, d)} name={m.name} />
                  <span className="price">{money(m.price_cents * q, cafe.currency)}</span>
                </div>
              )
            })}
            <textarea
              placeholder="Notes for the barista (oat milk, less sugar…)"
              maxLength={280}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {error && <p className="error">{error}</p>}
            <button className="btn primary block" disabled={placing || count === 0} onClick={place}>
              {placing ? 'Placing…' : `Place order · ${money(total, cafe.currency)}`}
            </button>
            <p className="muted small center">Pay at the counter or when it's served. No sign-in needed.</p>
          </div>
        </div>
      )}
    </>
  )
}

function Qty({ value, onChange, name }: { value: number; onChange: (d: number) => void; name: string }) {
  if (value === 0)
    return (
      <button className="btn small" onClick={() => onChange(1)} aria-label={`Add ${name}`}>
        Add
      </button>
    )
  return (
    <div className="qty">
      <button onClick={() => onChange(-1)} aria-label={`Remove one ${name}`}>−</button>
      <span>{value}</span>
      <button onClick={() => onChange(1)} aria-label={`Add one ${name}`}>+</button>
    </div>
  )
}

function Recommender({ cafe, onAdd }: { cafe: Cafe; onAdd: (id: number) => void }) {
  const [mood, setMood] = useState('')
  const [rec, setRec] = useState<Recommendation | null>(null)
  const [loading, setLoading] = useState(false)
  const byId = Object.fromEntries(cafe.menu.map((m) => [m.id, m]))

  async function ask(e: React.FormEvent) {
    e.preventDefault()
    if (!mood.trim()) return
    setLoading(true)
    try {
      setRec(await api<Recommendation>(`/api/cafes/${cafe.slug}/recommend`, { method: 'POST', body: { mood } }))
    } catch (err) {
      setRec({ message: (err as Error).message, picks: [], ai: false })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card recommender">
      <form onSubmit={ask} className="row">
        <input
          value={mood}
          onChange={(e) => setMood(e.target.value)}
          placeholder="What are you in the mood for? e.g. “cold, not too sweet, I'm in a hurry”"
          maxLength={300}
          aria-label="Describe what you feel like"
        />
        <button className="btn" disabled={loading}>{loading ? '…' : 'Suggest'}</button>
      </form>
      {rec && (
        <div className="rec-result">
          <p className="small">
            {rec.ai && <span className="chip ai">Gemini</span>} {rec.message}
          </p>
          {rec.picks.map((p) =>
            byId[p.id] ? (
              <div key={p.id} className="rec-pick">
                <div className="grow">
                  <strong>{byId[p.id].name}</strong>
                  <p className="muted small">{p.reason}</p>
                </div>
                <button className="btn small" onClick={() => onAdd(p.id)}>Add</button>
              </div>
            ) : null,
          )}
        </div>
      )}
    </section>
  )
}
