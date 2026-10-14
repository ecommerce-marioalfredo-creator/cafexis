import { Outlet } from 'react-router-dom'
import { CustomerAuthProvider } from '@/context/CustomerAuthContext'

/** Monta CustomerAuthProvider solo para el subárbol de rutas del cliente final (ver router.tsx). */
export function CustomerAuthRoot() {
  return (
    <CustomerAuthProvider>
      <Outlet />
    </CustomerAuthProvider>
  )
}
