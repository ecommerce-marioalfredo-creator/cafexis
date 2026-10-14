import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import { CATEGORY_LABEL, PRIORITY_META } from './supportLabels'
import type { NewSupportCaseInput, SupportCaseCategory, SupportCasePriority } from '@/types/domain'

interface NewCaseModalProps {
  onSave: (input: NewSupportCaseInput) => Promise<string>
  onCreated: (caseId: string) => void
  onClose: () => void
  /** Equipo de plataforma: abrir el caso a nombre de un negocio (ej. reportado por teléfono). */
  businesses?: Array<{ id: string; name: string }>
  defaultBusinessId?: string
}

export function NewCaseModal({ onSave, onCreated, onClose, businesses, defaultBusinessId }: NewCaseModalProps) {
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<SupportCaseCategory>('otro')
  const [priority, setPriority] = useState<SupportCasePriority>('media')
  const [businessId, setBusinessId] = useState(defaultBusinessId ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaveError(undefined)
    const next: Record<string, string> = {}
    if (subject.trim().length < 3) next.subject = 'Escribe un asunto de al menos 3 caracteres.'
    if (!description.trim()) next.description = 'Cuéntanos qué pasa.'
    if (businesses && !businessId) next.business = 'Elige el negocio.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    try {
      const id = await onSave({
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
        businessId: businesses ? businessId : undefined,
      })
      onCreated(id)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo abrir el caso.')
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Nuevo caso de soporte"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="new-case-form" disabled={saving}>
            {saving ? 'Enviando…' : 'Abrir caso'}
          </Button>
        </>
      }
    >
      <form id="new-case-form" onSubmit={handleSubmit}>
        {businesses && (
          <FormField label="Negocio" htmlFor="case-business" error={errors.business}>
            <select id="case-business" value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
              <option value="">Selecciona un negocio…</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </FormField>
        )}
        <FormField label="Asunto" htmlFor="case-subject" error={errors.subject}>
          <input
            id="case-subject"
            value={subject}
            maxLength={140}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ej. El inventario de leche no cuadra"
          />
        </FormField>
        <div className="new-case__row">
          <FormField label="Tema" htmlFor="case-category">
            <select id="case-category" value={category} onChange={(e) => setCategory(e.target.value as SupportCaseCategory)}>
              {(Object.keys(CATEGORY_LABEL) as SupportCaseCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Urgencia" htmlFor="case-priority" hint="Urgente: no puedes vender o entrar.">
            <select id="case-priority" value={priority} onChange={(e) => setPriority(e.target.value as SupportCasePriority)}>
              {(Object.keys(PRIORITY_META) as SupportCasePriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_META[p].label}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <FormField
          label="Descripción"
          htmlFor="case-description"
          error={errors.description}
          hint="Qué intentabas hacer, qué pasó y desde cuándo. Si hay un mensaje de error, cópialo."
        >
          <textarea id="case-description" rows={6} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        {saveError && <div className="form-error-banner">{saveError}</div>}
      </form>
    </Modal>
  )
}
