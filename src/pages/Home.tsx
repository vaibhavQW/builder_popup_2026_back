import { useState } from 'react'
import { navigate } from '../router'

export default function Home() {
  const [slug, setSlug] = useState('demo')
  const [table, setTable] = useState('1')

  return (
    <main className="home">
      <div className="home-card">
        <div className="logo">☕</div>
        <h1>Cafe Companion</h1>
        <p className="muted">Scan the QR code on your table to see the menu, order without waiting in line, and meet people here.</p>

        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            if (slug && Number(table) > 0) navigate(`/c/${slug.trim()}/t/${Number(table)}`)
          }}
        >
          <p className="label">No camera? Enter your table</p>
          <div className="row">
            <input aria-label="Cafe code" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Cafe code" />
            <input
              aria-label="Table number"
              value={table}
              onChange={(e) => setTable(e.target.value)}
              inputMode="numeric"
              placeholder="Table"
              style={{ maxWidth: 90 }}
            />
          </div>
          <button className="btn primary" type="submit">Open menu</button>
        </form>

        <div className="home-links">
          <a href={`/c/${slug}/qr`} onClick={(e) => (e.preventDefault(), navigate(`/c/${slug}/qr`))}>Print table QR codes</a>
          <a href={`/c/${slug}/staff`} onClick={(e) => (e.preventDefault(), navigate(`/c/${slug}/staff`))}>Barista screen</a>
        </div>
      </div>
    </main>
  )
}
