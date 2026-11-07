/**
 * Tema claro / oscuro del panel y del catálogo del cliente. La preferencia es
 * de este dispositivo (localStorage), no de la cuenta: un mismo usuario puede
 * querer el panel claro en el computador de la caja y oscuro en su celular.
 *
 * "system" sigue al sistema operativo y cambia en vivo si este cambia. El tema
 * resuelto queda en <html data-theme="light|dark">, que es lo que leen los
 * tokens de styles/tokens.css. El script de index.html hace lo mismo antes de
 * que cargue la app, para que no se vea un destello claro: si cambias
 * STORAGE_KEY o los valores, cámbialos también allá.
 */
export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export interface ColorThemeState {
  preference: ThemePreference
  resolved: ResolvedTheme
}

const STORAGE_KEY = 'cafexis-theme'
const darkQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : undefined

const listeners = new Set<() => void>()
let state: ColorThemeState = resolve(readPreference())

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // Almacenamiento bloqueado (modo privado, webview restringida): se usa el del sistema.
  }
  return 'system'
}

function resolve(preference: ThemePreference): ColorThemeState {
  const resolved = preference === 'system' ? (darkQuery?.matches ? 'dark' : 'light') : preference
  return { preference, resolved }
}

function apply(preference: ThemePreference) {
  state = resolve(preference)
  const root = document.documentElement
  if (root.dataset.theme !== state.resolved) {
    // Sin transiciones durante el cambio: si no, lo que anima su color (botones,
    // menú lateral) cambia con retraso y el resto de golpe. Ver global.css.
    root.dataset.themeSwitching = ''
    root.dataset.theme = state.resolved
    void getComputedStyle(root).color
    setTimeout(() => delete root.dataset.themeSwitching, 1)
  }
  listeners.forEach((listener) => listener())
}

/** Aplica el tema guardado y escucha al sistema operativo y a las otras pestañas. Una vez, al iniciar. */
export function initColorTheme(): void {
  apply(state.preference)
  darkQuery?.addEventListener('change', () => {
    if (state.preference === 'system') apply('system')
  })
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) apply(readPreference())
  })
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Sin almacenamiento el cambio dura hasta recargar la página.
  }
  apply(preference)
}

export function getColorTheme(): ColorThemeState {
  return state
}

export function subscribeColorTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
