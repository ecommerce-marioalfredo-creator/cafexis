import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import './SubscriptionExpiredPage.css'

/**
 * Bloqueo de acceso cuando la cuenta del negocio está cancelada. Desde la
 * 0019 vencer ya no bloquea (el negocio baja a Básica): solo llega aquí una
 * cuenta que el supervisor técnico canceló. RequireAuth.tsx redirige aquí;
 * se puede cerrar sesión, pero ninguna otra ruta del panel es alcanzable
 * hasta que el supervisor la reactive en Suscripción.
 */
export function SubscriptionExpiredPage() {
  const { logout } = useAuth()

  return (
    <div className="subscription-expired">
      <div className="subscription-expired__panel">
        <h1>Tu cuenta está cancelada</h1>
        <p>
          La cuenta de tu negocio en Cafexis está cancelada. Escríbenos a soporte para reactivarla y volver a usar el
          panel; tus datos se conservan.
        </p>
        <Button variant="secondary" onClick={logout}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  )
}
