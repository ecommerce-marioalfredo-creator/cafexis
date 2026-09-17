import { useNavigate } from 'react-router-dom'
import { useBusiness } from '@/hooks/useBusiness'
import { useAuth } from '@/context/AuthContext'
import './Topbar.css'

interface TopbarProps {
  title: string
  onOpenMenu: () => void
}

export function Topbar({ title, onOpenMenu }: TopbarProps) {
  const { business } = useBusiness()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const initials = (user?.name ?? business?.name ?? 'C')
    .split(' ')
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const handleLogout = async () => {
    await logout()
    navigate('/ingreso', { replace: true })
  }

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button className="topbar__menu-btn" onClick={onOpenMenu} aria-label="Abrir menú de navegación">
          <span />
          <span />
          <span />
        </button>
        <h1 className="topbar__title">{title}</h1>
      </div>
      <div className="topbar__user">
        <span className="topbar__business">{business?.name ?? 'Mi negocio'}</span>
        <div className="topbar__avatar" aria-hidden="true">
          {initials}
        </div>
        <button className="topbar__logout" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>
    </header>
  )
}
