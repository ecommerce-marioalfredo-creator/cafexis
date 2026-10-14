import { Capacitor } from '@capacitor/core'

/**
 * Qué app se está compilando (Fase 7). El mismo código produce:
 *   - 'web': cafexis.vercel.app, con todo (panel interno + cliente final).
 *   - 'clientes': app "Cafexis" de las tiendas, solo la experiencia del
 *     cliente final (catálogo, pedidos, trazabilidad).
 *   - 'equipo': app "Cafexis Equipo", solo el panel del personal.
 * Se elige con el modo de Vite: `vite build --mode clientes|equipo` (ver
 * scripts/mobile.mjs). Cualquier otro modo (development, production) es web.
 */
export type AppTarget = 'web' | 'clientes' | 'equipo'

const mode = import.meta.env.MODE
export const APP_TARGET: AppTarget = mode === 'clientes' || mode === 'equipo' ? mode : 'web'

/** Corriendo dentro de la app nativa (Android/iOS), no en un navegador. */
export const IS_NATIVE = Capacitor.isNativePlatform()

/**
 * Esquema de deep links de cada app (debe coincidir con capacitor.config.ts
 * y con las "Redirect URLs" permitidas en Supabase Auth).
 */
export const NATIVE_URL_SCHEME = APP_TARGET === 'equipo' ? 'co.cafexis.equipo' : 'co.cafexis.clientes'

/** A dónde vuelve Google tras iniciar sesión dentro de la app nativa. */
export const NATIVE_AUTH_CALLBACK = `${NATIVE_URL_SCHEME}://auth-callback`
