import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { api, type Cafe } from '../api'

export default function QrSheet({ slug }: { slug: string }) {
  const [cafe, setCafe] = useState<Cafe | null>(null)
  const [codes, setCodes] = useState<{ table: number; url: string; img: string }[]>([])

  useEffect(() => {
    api<Cafe>(`/api/cafes/${slug}`).then(async (c) => {
      setCafe(c)
      const list = await Promise.all(
        Array.from({ length: c.table_count }, async (_, i) => {
          const url = `${location.origin}/c/${slug}/t/${i + 1}`
          return { table: i + 1, url, img: await QRCode.toDataURL(url, { width: 360, margin: 1 }) }
        }),
      )
      setCodes(list)
    })
  }, [slug])

  if (!cafe) return <main className="center-msg">Loading…</main>
  return (
    <main className="qr-sheet">
      <div className="row between no-print">
        <h1>{cafe.name} — table QR codes</h1>
        <button className="btn primary" onClick={() => print()}>Print</button>
      </div>
      <div className="qr-grid">
        {codes.map((c) => (
          <figure key={c.table} className="qr-card">
            <p className="qr-cafe">{cafe.name}</p>
            <img src={c.img} alt={`QR code for table ${c.table}`} />
            <figcaption>
              <strong>Table {c.table}</strong>
              <span>Scan to order · skip the line · meet people</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </main>
  )
}
