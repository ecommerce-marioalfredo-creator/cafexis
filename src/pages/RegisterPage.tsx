import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { FormField } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import type { BusinessType } from '@/types/domain'
import './RegisterPage.css'

const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
  cafeteria: 'Cafetería (bebidas preparadas)',
  grano_molido: 'Venta de café en grano o molido',
  mixto: 'Ambos (cafetería y café empacado)',
}

const COLOR_SWATCHES = ['#D85A30', '#1D9E75', '#2C6E9E', '#8E44AD', '#C0392B', '#2C2C2A']

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState<BusinessType>('cafeteria')
  const [country, setCountry] = useState('Colombia')
  const [ownerName, setOwnerName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#D85A30')
  const [logoUrl, setLogoUrl] = useState('')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  const handleLogoFile = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setLogoUrl(String(reader.result))
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(undefined)
    setSubmitting(true)
    try {
      await register({
        businessName,
        businessType,
        country,
        ownerName,
        email,
        password,
        primaryColor,
        logoUrl: logoUrl || undefined,
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos crear tu cuenta.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Registra tu negocio"
      subtitle="Crea tu cuenta en Cafexis y personaliza tu panel con tu propia marca."
      footer={
        <span>
          ¿Ya tienes cuenta? <Link to="/ingreso">Ingresa aquí</Link>
        </span>
      }
    >
      {error && <div className="auth-layout__error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <FormField label="Nombre del negocio" htmlFor="reg-business-name">
          <input
            id="reg-business-name"
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Ej. Café La Esquina"
          />
        </FormField>

        <FormField label="Tipo de negocio" htmlFor="reg-business-type">
          <select id="reg-business-type" value={businessType} onChange={(e) => setBusinessType(e.target.value as BusinessType)}>
            {Object.entries(BUSINESS_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="País" htmlFor="reg-country">
          <input id="reg-country" required value={country} onChange={(e) => setCountry(e.target.value)} />
        </FormField>

        <FormField label="Tu nombre" htmlFor="reg-owner-name">
          <input id="reg-owner-name" required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Nombre y apellido" />
        </FormField>

        <FormField label="Correo electrónico" htmlFor="reg-email">
          <input id="reg-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@negocio.com" />
        </FormField>

        <FormField label="Contraseña" htmlFor="reg-password" hint="Mínimo 6 caracteres">
          <input
            id="reg-password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </FormField>

        <FormField label="Color principal de tu marca" htmlFor="reg-color">
          <div className="register-page__color-row">
            <input id="reg-color" type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
            <div className="register-page__swatches">
              {COLOR_SWATCHES.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="register-page__swatch"
                  style={{ background: color }}
                  aria-label={`Usar color ${color}`}
                  onClick={() => setPrimaryColor(color)}
                />
              ))}
            </div>
          </div>
        </FormField>

        <FormField label="Logo de tu negocio (opcional)" htmlFor="reg-logo" hint="Se mostrará junto al logo de Cafexis en tu panel">
          <input id="reg-logo" type="file" accept="image/*" onChange={(e) => handleLogoFile(e.target.files?.[0])} />
        </FormField>

        {logoUrl && (
          <div className="register-page__preview">
            <img src={logoUrl} alt="Vista previa del logo" />
            <span>Vista previa de tu logo</span>
          </div>
        )}

        <Button variant="primary" type="submit" disabled={submitting} className="btn--block">
          {submitting ? 'Creando cuenta…' : 'Crear cuenta y entrar'}
        </Button>
      </form>
    </AuthLayout>
  )
}
