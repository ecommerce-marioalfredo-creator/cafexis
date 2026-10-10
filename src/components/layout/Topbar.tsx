import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBusiness } from '@/hooks/useBusiness'
import { useAuth } from '@/context/AuthContext'
import { listAllBusinesses } from '@/services/api/businessOverride'
import type { Business } from '@/types/domain'
import './Topbar.css'

interface TopbarProps {
  title: string
  onOpenMenu: () => void
}

export function Topbar({ title, onOpenMenu }: TopbarProps) {
  const { business } = useBusiness()
  const { user, logout, switchBusiness } = useAuth()
  const navigate = useNavigate()

  const isSupervisor = user?.role === 'supervisor_tecnico'
  const [allBusinesses, setAllBusinesses] = useState<Business[]>([])
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    if (!isSupervisor) return
    listAllBusinesses()
      .then(setAllBusinesses)
      .catch(() => setAllBusinesses([]))
  }, [isSupervisor])

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

  const handleBusinessChange = async (businessId: string) => {
    setSwitching(true)
    try {
      await switchBusiness(businessId)
    } finally {
      setSwitching(false)
    }
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
        {isSupervisor ? (
          <select
            className="topbar__business-select"
            value={business?.id ?? ''}
            onChange={(e) => handleBusinessChange(e.target.value)}
            disabled={switching || allBusinesses.length === 0}
            aria-label="Negocio que estás viendo"
          >
            {allBusinesses.length === 0 && <option value="">Cargando negocios…</option>}
            {allBusinesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="topbar__business">{business?.name ?? 'Mi negocio'}</span>
        )}
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
