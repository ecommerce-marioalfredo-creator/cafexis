import { useBusiness } from '@/hooks/useBusiness'
import './Topbar.css'

interface TopbarProps {
  title: string
}

export function Topbar({ title }: TopbarProps) {
  const { business } = useBusiness()

  return (
    <header className="topbar">
      <h1 className="topbar__title">{title}</h1>
      <div className="topbar__user">
        <span className="topbar__business">{business?.name ?? 'Mi negocio'}</span>
        <div className="topbar__avatar" aria-hidden="true">
          LG
        </div>
      </div>
    </header>
  )
}
