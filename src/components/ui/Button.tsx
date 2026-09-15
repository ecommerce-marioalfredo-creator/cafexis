import type { ButtonHTMLAttributes } from 'react'
import './Button.css'

type Variant = 'primary' | 'secondary' | 'tertiary' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

/**
 * Botón base del sistema (Design System sección 7):
 * una acción principal por zona, texto con verbo, estados
 * default/hover/focus/pressed/disabled se resuelven vía CSS.
 */
export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  const classes = ['btn', `btn--${variant}`, className].filter(Boolean).join(' ')
  return <button className={classes} {...props} />
}
