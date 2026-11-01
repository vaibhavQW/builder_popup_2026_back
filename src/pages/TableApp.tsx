import { useEffect, useState } from 'react'
import { api, ApiError, myOrders, session, type Cafe, type Me } from '../api'
import { preloadGoogle } from '../google'
import MenuTab from '../components/MenuTab'
import OrdersTab from '../components/OrdersTab'
import RoomTab from '../components/RoomTab'

type Tab = 'menu' | 'orders' | 'room'

export default function TableApp({ slug, table }: { slug: string; table: number }) {
  const [cafe, setCafe] = useState<Cafe | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('menu')
  const [me, setMe] = useState<Me | null>(null)
  const [orderTokens, setOrderTokens] = useState<string[]>(() => myOrders.list(slug))

  useEffect(() => {
    api<Cafe>(`/api/cafes/${slug}`)
      .then(setCafe)
      .catch((e: ApiError) => setError(e.status === 404 ? 'We couldn’t find this cafe.' : e.message))
    if (session.get()) api<Me>('/api/me').then(setMe).catch(() => setMe(null))
    preloadGoogle().catch(() => {})
  }, [slug])

  if (error) return <main className="center-msg">{error}</main>
  if (!cafe) return <main className="center-msg">Brewing…</main>
  if (table > cafe.table_count) return <main className="center-msg">Table {table} doesn’t exist here.</main>

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>{cafe.name}</h1>
          <p className="muted small">
            Table {table} · ~{cafe.wait_minutes} min wait
            {cafe.people_here > 0 && ` · ${cafe.people_here} open to meet`}
          </p>
        </div>
        {me && <img className="avatar sm" src={me.picture} alt={me.name} referrerPolicy="no-referrer" />}
      </header>

      <main className="content">
        {tab === 'menu' && (
          <MenuTab
            cafe={cafe}
            table={table}
            onOrdered={(token) => {
              myOrders.add(slug, token)
              setOrderTokens(myOrders.list(slug))
              setTab('orders')
            }}
          />
        )}
        {tab === 'orders' && <OrdersTab cafe={cafe} tokens={orderTokens} onBrowse={() => setTab('menu')} />}
        {tab === 'room' && <RoomTab cafe={cafe} table={table} me={me} setMe={setMe} />}
      </main>

      <nav className="tabbar" aria-label="Sections">
        <TabBtn active={tab === 'menu'} onClick={() => setTab('menu')} icon="☕" label="Menu" />
        <TabBtn
          active={tab === 'orders'}
          onClick={() => setTab('orders')}
          icon="⏱"
          label="My orders"
          badge={orderTokens.length || undefined}
        />
        <TabBtn active={tab === 'room'} onClick={() => setTab('room')} icon="👋" label="The room" />
      </nav>
    </div>
  )
}

function TabBtn(p: { active: boolean; onClick: () => void; icon: string; label: string; badge?: number }) {
  return (
    <button className={'tab' + (p.active ? ' active' : '')} onClick={p.onClick} aria-current={p.active}>
      <span aria-hidden>{p.icon}</span>
      <span>{p.label}</span>
      {p.badge ? <span className="badge">{p.badge}</span> : null}
    </button>
  )
}
