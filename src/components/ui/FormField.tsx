import type { ReactNode } from 'react'
import './FormField.css'

interface FormFieldProps {
  label: string
  htmlFor: string
  error?: string
  children: ReactNode
  hint?: string
}

/**
 * Wrapper label + control + error (Design System sección 8, Formularios:
 * labels visibles, errores junto al campo).
 */
export function FormField({ label, htmlFor, error, children, hint }: FormFieldProps) {
  return (
    <div className="form-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error && <span className="form-field__hint">{hint}</span>}
      {error && <span className="form-field__error">{error}</span>}
    </div>
  )
}
