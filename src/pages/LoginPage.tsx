import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { FormField } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(undefined)
    setSubmitting(true)
    try {
      await login({ email, password })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos iniciar sesión.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Ingresa a tu cuenta"
      subtitle="Gestiona tu negocio de café desde un solo lugar."
      footer={
        <span>
          ¿Aún no tienes cuenta? <Link to="/registro">Registra tu negocio</Link>
        </span>
      }
    >
      <p className="auth-layout__demo-hint">
        Cuenta demo: <strong>laura@micafeteria.co</strong> · contraseña <strong>cafexis123</strong>
      </p>

      {error && <div className="auth-layout__error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <FormField label="Correo electrónico" htmlFor="login-email">
          <input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tucorreo@negocio.com"
          />
        </FormField>
        <FormField label="Contraseña" htmlFor="login-password">
          <input
            id="login-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </FormField>
        <Button variant="primary" type="submit" disabled={submitting} className="btn--block">
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>
    </AuthLayout>
  )
}
