import { useEffect, useState } from 'react'
import Home from './pages/Home'
import TableApp from './pages/TableApp'
import Staff from './pages/Staff'
import QrSheet from './pages/QrSheet'

// Tiny path router — routes:
//   /                     landing
//   /c/:slug/t/:table     guest app (what the table QR opens)
//   /c/:slug/staff        barista order board
//   /c/:slug/qr           printable QR codes for every table
function usePath() {
  const [path, setPath] = useState(location.pathname)
  useEffect(() => {
    const on = () => setPath(location.pathname)
    window.addEventListener('popstate', on)
    return () => window.removeEventListener('popstate', on)
  }, [])
  return path
}

export default function App() {
  const path = usePath()
  let m: RegExpMatchArray | null

  if ((m = path.match(/^\/c\/([\w-]+)\/t\/(\d+)\/?$/))) return <TableApp key={path} slug={m[1]} table={Number(m[2])} />
  if ((m = path.match(/^\/c\/([\w-]+)\/staff\/?$/))) return <Staff slug={m[1]} />
  if ((m = path.match(/^\/c\/([\w-]+)\/qr\/?$/))) return <QrSheet slug={m[1]} />
  return <Home />
}
