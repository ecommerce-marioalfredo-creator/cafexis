/**
 * Pantalla a la que volver tras el login con Google en la app nativa: el
 * flujo sale al navegador del sistema y regresa por deep link, así que la
 * ruta de origen se guarda antes de salir.
 */
const KEY = 'cafexis.nativeAuthReturn'

export function rememberNativeAuthReturn(path: string): void {
  try {
    localStorage.setItem(KEY, path)
  } catch {
    // Sin almacenamiento: al volver se usa la pantalla de inicio de la app.
  }
}

export function takeNativeAuthReturn(): string | undefined {
  try {
    const path = localStorage.getItem(KEY) ?? undefined
    localStorage.removeItem(KEY)
    return path
  } catch {
    return undefined
  }
}
