/**
 * Lectura/escritura pura de localStorage para el override de negocio del
 * supervisor técnico. Separado de businessOverride.ts (que sí importa
 * supabaseClient) para que supabaseClient.ts pueda leer el override sin
 * crear una dependencia circular entre ambos módulos.
 */
const STORAGE_KEY = 'cafexis:business-override'

export function getBusinessOverride(): string | undefined {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? undefined
  } catch {
    return undefined
  }
}

export function setBusinessOverride(businessId: string | null): void {
  try {
    if (businessId) {
      localStorage.setItem(STORAGE_KEY, businessId)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Almacenamiento no disponible (navegación privada, etc.): no es crítico,
    // el supervisor simplemente verá su propio negocio por defecto.
  }
}
