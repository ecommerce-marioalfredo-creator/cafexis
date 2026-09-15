/**
 * Cliente HTTP base para cuando exista el backend real.
 * Hoy nadie lo usa (los *Service resuelven contra services/mock/data.ts),
 * pero queda listo para que el swap a la API real sea solo cambiar el
 * cuerpo de cada método de servicio por una llamada a `apiFetch`.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })

  if (!response.ok) {
    throw new ApiError(response.status, `Error ${response.status} al llamar ${path}`)
  }

  return response.json() as Promise<T>
}

/** Simula latencia de red para que el mock se sienta como una llamada real. */
export function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}
