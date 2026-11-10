import type { ProductGuideKind } from '@/types/domain'

export const GUIDE_KIND_LABEL: Record<ProductGuideKind, string> = {
  video: 'Video',
  pdf: 'PDF',
}

export const GUIDE_KIND_ICON: Record<ProductGuideKind, string> = {
  video: '🎬',
  pdf: '📄',
}

/** ¿Es un enlace http(s) válido? (la base de datos exige lo mismo). */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Convierte un enlace de YouTube, Vimeo o Google Drive en su versión
 * "embebible", para verlo dentro de Cafexis sin salir de la app. Cualquier
 * otro enlace devuelve undefined y se abre en una pestaña nueva.
 */
export function embedUrlFor(rawUrl: string): string | undefined {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return undefined
  }
  const host = url.hostname.replace(/^(www|m)\./, '')
  const segments = url.pathname.split('/').filter(Boolean)

  // YouTube: youtu.be/ID, youtube.com/watch?v=ID, /shorts/ID, /embed/ID, /live/ID
  let youtubeId: string | null | undefined
  if (host === 'youtu.be') youtubeId = segments[0]
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    youtubeId = segments[0] === 'watch' ? url.searchParams.get('v') : ['shorts', 'embed', 'live'].includes(segments[0]) ? segments[1] : undefined
  }
  if (youtubeId && /^[\w-]{11}$/.test(youtubeId)) return `https://www.youtube-nocookie.com/embed/${youtubeId}`

  // Vimeo: vimeo.com/ID o player.vimeo.com/video/ID
  if (host === 'vimeo.com' && /^\d+$/.test(segments[0] ?? '')) return `https://player.vimeo.com/video/${segments[0]}`
  if (host === 'player.vimeo.com' && segments[0] === 'video' && /^\d+$/.test(segments[1] ?? '')) {
    return `https://player.vimeo.com/video/${segments[1]}`
  }

  // Google Drive: drive.google.com/file/d/ID/view (el archivo debe estar compartido con "cualquiera con el enlace").
  if (host === 'drive.google.com' && segments[0] === 'file' && segments[1] === 'd' && /^[\w-]+$/.test(segments[2] ?? '')) {
    return `https://drive.google.com/file/d/${segments[2]}/preview`
  }

  return undefined
}

/** Tamaño legible para mensajes ("12,4 MB"). */
export function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString('es-CO', { maximumFractionDigits: 1 })} MB`
}
