import type { ReactNode } from 'react'
import logoOnDark from '@/assets/logo-dark.png'
import logoOnLight from '@/assets/logo-light.png'
import { useColorTheme } from '@/hooks/useColorTheme'
import './AuthLayout.css'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}

/** Layout compartido para /ingreso y /registro: sin sidebar ni topbar. */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  // El logo para fondo claro tiene letras oscuras: en modo oscuro no se leería.
  const { resolved } = useColorTheme()

  return (
    <div className="auth-layout">
      <div className="auth-layout__panel">
        <img src={resolved === 'dark' ? logoOnDark : logoOnLight} alt="Cafexis" className="auth-layout__logo" />
        <h2>{title}</h2>
        <p className="auth-layout__subtitle">{subtitle}</p>
        {children}
        {footer && <div className="auth-layout__footer">{footer}</div>}
      </div>
    </div>
  )
}
