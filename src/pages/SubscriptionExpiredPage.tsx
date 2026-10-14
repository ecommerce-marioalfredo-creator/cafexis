import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import './SubscriptionExpiredPage.css'

/**
 * Bloqueo real de acceso cuando la suscripción del negocio venció (Fase 6).
 * RequireAuth.tsx redirige aquí; el administrador puede cerrar sesión, pero
 * ninguna otra ruta del panel es alcanzable hasta que el supervisor técnico
 * reactive la suscripción (ver listAllSubscriptions/updateSubscriptionStatus).
 */
export function SubscriptionExpiredPage() {
  const { logout } = useAuth()

  return (
    <div className="subscription-expired">
      <div className="subscription-expired__panel">
        <h1>Tu suscripción venció</h1>
        <p>
          Tu período de prueba o suscripción a Cafexis llegó a su fin. Contacta a soporte para reactivar tu cuenta y
          seguir usando el panel.
        </p>
        <Button variant="secondary" onClick={logout}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  )
}
