import type { BusinessBranding } from '@/types/domain'

/**
 * Sobrescribe en runtime el token de acento de marca (--color-brand-orange)
 * con el color elegido por el negocio de la sesión activa, sin duplicar
 * el resto del sistema de tokens definido en styles/tokens.css. El logo de
 * Cafexis nunca se reemplaza: esto solo cambia el color de acento de la UI.
 */
export function applyBrandTheme(branding: BusinessBranding | undefined): void {
  const root = document.documentElement.style
  if (!branding?.primaryColor) {
    root.removeProperty('--color-brand-orange')
    root.removeProperty('--color-brand-orange-hover')
    return
  }
  root.setProperty('--color-brand-orange', branding.primaryColor)
  root.setProperty('--color-brand-orange-hover', shade(branding.primaryColor, -12))
}

/** Oscurece (o aclara) un color hex en `percent`% para el estado hover. */
function shade(hex: string, percent: number): string {
  const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex)
  if (!match) return hex
  const [, r, g, b] = match
  const adjust = (channel: string) => {
    const value = parseInt(channel, 16)
    const adjusted = Math.round(value + (percent / 100) * value)
    return Math.max(0, Math.min(255, adjusted)).toString(16).padStart(2, '0')
  }
  return `#${adjust(r)}${adjust(g)}${adjust(b)}`
}
