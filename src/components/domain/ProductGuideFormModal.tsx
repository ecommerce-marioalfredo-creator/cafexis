import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import { GUIDE_FILE_MAX_BYTES, GUIDE_FILE_TYPES, guideFileType } from '@/services/api/productGuidesService'
import { GUIDE_KIND_ICON, GUIDE_KIND_LABEL, formatMegabytes, isHttpUrl } from './guideMedia'
import type { Product, ProductGuide, ProductGuideInput, ProductGuideKind } from '@/types/domain'
import './ProductGuideFormModal.css'

type Source = 'archivo' | 'enlace'

interface ProductGuideFormModalProps {
  products: Product[]
  /** Al editar. */
  guide?: ProductGuide
  /** Producto preseleccionado al crear desde la tarjeta de un producto. */
  defaultProductId?: string
  onSave: (input: ProductGuideInput, file?: File) => Promise<void>
  onClose: () => void
}

const FILE_HINT: Record<ProductGuideKind, string> = {
  video: 'MP4 o WebM, máximo 50 MB. Para videos más pesados usa un enlace.',
  pdf: 'PDF, máximo 50 MB.',
}

/**
 * Sube o edita un video o PDF de preparación (solo administrador y supervisor
 * técnico; la base de datos lo exige igual). Se puede subir el archivo o pegar
 * un enlace (YouTube no listado, Vimeo, Google Drive…), y decidir si el
 * cliente final lo ve desde el catálogo.
 */
export function ProductGuideFormModal({ products, guide, defaultProductId, onSave, onClose }: ProductGuideFormModalProps) {
  const [productId, setProductId] = useState(guide?.productId ?? defaultProductId ?? '')
  const [title, setTitle] = useState(guide?.title ?? '')
  const [description, setDescription] = useState(guide?.description ?? '')
  const [kind, setKind] = useState<ProductGuideKind>(guide?.kind ?? 'video')
  const [source, setSource] = useState<Source>(guide?.externalUrl ? 'enlace' : 'archivo')
  const [file, setFile] = useState<File>()
  const [externalUrl, setExternalUrl] = useState(guide?.externalUrl ?? '')
  const [visibleToCustomers, setVisibleToCustomers] = useState(guide?.visibleToCustomers ?? false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const isEditing = Boolean(guide)
  // Al editar con "Subir archivo" y sin elegir uno nuevo, se conserva el actual.
  const keepsCurrentFile = Boolean(guide?.storagePath) && source === 'archivo' && !file && guide?.kind === kind

  const sortedProducts = [...products].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))

  const changeKind = (next: ProductGuideKind) => {
    setKind(next)
    // Un archivo elegido para el otro tipo ya no aplica.
    if (file && !GUIDE_FILE_TYPES[next].includes(guideFileType(file))) setFile(undefined)
  }

  const handleFile = (selected: File | undefined) => {
    if (!selected) return
    const type = guideFileType(selected)
    if (!GUIDE_FILE_TYPES[kind].includes(type)) {
      setErrors((prev) => ({ ...prev, file: kind === 'pdf' ? 'El archivo debe ser un PDF.' : 'El video debe ser MP4 o WebM.' }))
      return
    }
    if (selected.size > GUIDE_FILE_MAX_BYTES) {
      setErrors((prev) => ({
        ...prev,
        file: `El archivo pesa ${formatMegabytes(selected.size)}; el máximo es ${formatMegabytes(GUIDE_FILE_MAX_BYTES)}. Súbelo a YouTube (no listado) o Drive y pega el enlace.`,
      }))
      return
    }
    setErrors(({ file: _file, ...rest }) => rest)
    setFile(selected)
    if (!title.trim()) setTitle(selected.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 120))
  }

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!productId) next.productId = 'Elige el producto.'
    if (title.trim().length < 2) next.title = 'Escribe un título (mínimo 2 caracteres).'
    if (description.length > 1000) next.description = 'Máximo 1000 caracteres.'
    if (source === 'archivo' && !file && !keepsCurrentFile) next.file = 'Elige el archivo a subir.'
    if (source === 'enlace' && !isHttpUrl(externalUrl)) next.externalUrl = 'Pega un enlace completo, que empiece por https://'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaveError(undefined)
    if (!validate()) return

    setSaving(true)
    try {
      await onSave(
        {
          productId,
          title: title.trim(),
          description: description.trim() || undefined,
          kind,
          externalUrl: source === 'enlace' ? externalUrl.trim() : undefined,
          visibleToCustomers,
        },
        source === 'archivo' ? file : undefined,
      )
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar el material.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isEditing ? 'Editar material de preparación' : 'Nuevo video o PDF'}
      onClose={saving ? () => undefined : onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="product-guide-form" disabled={saving}>
            {saving ? (file ? 'Subiendo…' : 'Guardando…') : 'Guardar material'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} id="product-guide-form">
        <FormField label="Producto" htmlFor="guide-product" error={errors.productId}>
          <select id="guide-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Selecciona un producto…</option>
            {sortedProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.category}
              </option>
            ))}
          </select>
        </FormField>

        <div className="guide-form__group" role="radiogroup" aria-label="Tipo de material">
          <span className="guide-form__label">Tipo</span>
          <div className="page-toolbar__filters">
            {(Object.keys(GUIDE_KIND_LABEL) as ProductGuideKind[]).map((k) => (
              <button
                type="button"
                key={k}
                role="radio"
                aria-checked={kind === k}
                className={['filter-chip', kind === k ? 'filter-chip--active' : ''].join(' ')}
                onClick={() => changeKind(k)}
              >
                {GUIDE_KIND_ICON[k]} {GUIDE_KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>

        <div className="guide-form__group" role="radiogroup" aria-label="Origen del material">
          <span className="guide-form__label">¿Cómo lo agregas?</span>
          <div className="page-toolbar__filters">
            <button
              type="button"
              role="radio"
              aria-checked={source === 'archivo'}
              className={['filter-chip', source === 'archivo' ? 'filter-chip--active' : ''].join(' ')}
              onClick={() => setSource('archivo')}
            >
              Subir archivo
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={source === 'enlace'}
              className={['filter-chip', source === 'enlace' ? 'filter-chip--active' : ''].join(' ')}
              onClick={() => setSource('enlace')}
            >
              Pegar enlace
            </button>
          </div>
        </div>

        {source === 'archivo' ? (
          <FormField
            label={kind === 'pdf' ? 'Archivo PDF' : 'Archivo de video'}
            htmlFor="guide-file"
            error={errors.file}
            hint={keepsCurrentFile ? `Ya tiene un archivo subido; elige otro solo si quieres reemplazarlo. ${FILE_HINT[kind]}` : FILE_HINT[kind]}
          >
            <input
              id="guide-file"
              type="file"
              accept={GUIDE_FILE_TYPES[kind].join(',')}
              onChange={(e) => {
                handleFile(e.target.files?.[0])
                e.target.value = '' // Permite volver a elegir el mismo archivo.
              }}
            />
          </FormField>
        ) : (
          <FormField
            label="Enlace"
            htmlFor="guide-url"
            error={errors.externalUrl}
            hint="YouTube, Vimeo y Google Drive se ven dentro de Cafexis. En Drive, compártelo con “cualquiera con el enlace”."
          >
            <input
              id="guide-url"
              type="url"
              inputMode="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://youtu.be/…"
            />
          </FormField>
        )}

        {source === 'archivo' && file && (
          <p className="guide-form__file">
            {GUIDE_KIND_ICON[kind]} {file.name} · {formatMegabytes(file.size)}
          </p>
        )}

        <FormField label="Título" htmlFor="guide-title" error={errors.title}>
          <input
            id="guide-title"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Cómo montar la leche para un latte"
          />
        </FormField>

        <FormField label="Descripción (opcional)" htmlFor="guide-description" error={errors.description}>
          <textarea
            id="guide-description"
            rows={3}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notas para quien prepara: temperatura, tiempos, trucos…"
          />
        </FormField>

        <label className="guide-form__visibility">
          <input type="checkbox" checked={visibleToCustomers} onChange={(e) => setVisibleToCustomers(e.target.checked)} />
          <span>
            <strong>Disponible para el cliente</strong>
            <span className="guide-form__visibility-hint">
              {visibleToCustomers
                ? 'El cliente verá el enlace a este material en el catálogo, junto al producto.'
                : 'Solo lo ve el personal del negocio (baristas y administradores).'}
            </span>
          </span>
        </label>

        {saveError && <div className="form-error-banner">{saveError}</div>}
      </form>
    </Modal>
  )
}
