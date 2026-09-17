import type { ReactNode } from 'react'
import logo from '@/assets/logo-light.png'
import './AuthLayout.css'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}

/** Layout compartido para /ingreso y /registro: sin sidebar ni topbar. */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="auth-layout">
      <div className="auth-layout__panel">
        <img src={logo} alt="Cafexis" className="auth-layout__logo" />
        <h2>{title}</h2>
        <p className="auth-layout__subtitle">{subtitle}</p>
        {children}
        {footer && <div className="auth-layout__footer">{footer}</div>}
      </div>
    </div>
  )
}
