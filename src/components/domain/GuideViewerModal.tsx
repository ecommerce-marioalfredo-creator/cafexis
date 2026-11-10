import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { getProductGuideUrl } from '@/services/api/productGuidesService'
import { GUIDE_KIND_ICON, embedUrlFor } from './guideMedia'
import type { PublicProductGuide } from '@/types/domain'
import './GuideViewerModal.css'

interface GuideViewerModalProps {
  guide: PublicProductGuide
  /** Producto al que pertenece, para el título del modal. */
  productName?: string
  onClose: () => void
}

/**
 * Muestra un video o PDF de preparación. Lo usan el personal (/preparacion)
 * y el cliente final (catálogo); la URL de un archivo se firma al abrirlo,
 * así que solo funciona si quien mira tiene permiso (ver 0018).
 *
 *  - Video subido: reproductor del navegador.
 *  - PDF subido: visor embebido en pantallas grandes y, siempre, un botón
 *    para abrirlo aparte (los celulares no muestran PDF dentro de un iframe).
 *  - Enlace de YouTube, Vimeo o Drive: reproductor embebido.
 *  - Cualquier otro enlace: botón para abrirlo en una pestaña nueva.
 */
export function GuideViewerModal({ guide, productName, onClose }: GuideViewerModalProps) {
  const [url, setUrl] = useState<string>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    let cancelled = false
    setUrl(undefined)
    setError(undefined)
    getProductGuideUrl(guide)
      .then((result) => !cancelled && setUrl(result))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'No se pudo abrir el material.'))
    return () => {
      cancelled = true
    }
  }, [guide])

  const embedUrl = guide.externalUrl ? embedUrlFor(guide.externalUrl) : undefined
  const title = productName ? `${productName} · ${guide.title}` : guide.title

  const openLink = (label: string) =>
    url && (
      <a className="btn btn--secondary guide-viewer__open" href={url} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    )

  return (
    <Modal title={title} onClose={onClose} size="lg">
      {guide.description && <p className="guide-viewer__description">{guide.description}</p>}

      {error && <div className="form-error-banner">{error}</div>}
      {!url && !error && <p className="section-subtitle">Cargando {GUIDE_KIND_ICON[guide.kind]}…</p>}

      {url && guide.storagePath && guide.kind === 'video' && (
        <video className="guide-viewer__video" src={url} controls playsInline preload="metadata">
          Tu navegador no puede reproducir este video. {openLink('Descargar video')}
        </video>
      )}

      {url && guide.storagePath && guide.kind === 'pdf' && (
        <>
          <iframe className="guide-viewer__frame guide-viewer__frame--pdf" src={url} title={guide.title} />
          {openLink('Abrir PDF en pantalla completa')}
        </>
      )}

      {url && embedUrl && (
        <>
          <iframe
            className="guide-viewer__frame"
            src={embedUrl}
            title={guide.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
          {openLink('Abrir en el sitio original')}
        </>
      )}

      {url && guide.externalUrl && !embedUrl && (
        <div className="guide-viewer__external">
          <p>Este {guide.kind === 'pdf' ? 'documento' : 'video'} está en otro sitio.</p>
          {openLink(guide.kind === 'pdf' ? 'Abrir documento' : 'Abrir video')}
        </div>
      )}
    </Modal>
  )
}
