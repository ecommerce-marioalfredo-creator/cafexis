import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import type { Business, BusinessType, BusinessUpdateInput } from '@/types/domain'
import './BusinessEditModal.css'

interface BusinessEditModalProps {
  business: Business
  onSave: (input: BusinessUpdateInput) => Promise<void>
  onUploadLogo: (file: File) => Promise<void>
  onClose: () => void
}

const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
  cafeteria: 'Cafetería (bebidas preparadas)',
  grano_molido: 'Venta de café en grano o molido',
  mixto: 'Ambos (cafetería y café empacado)',
}

/** Edita nombre, tipo, país y color del negocio, y sube un logo nuevo a Supabase Storage. */
export function BusinessEditModal({ business, onSave, onUploadLogo, onClose }: BusinessEditModalProps) {
  const [name, setName] = useState(business.name)
  const [type, setType] = useState<BusinessType>(business.type)
  const [country, setCountry] = useState(business.country)
  const [primaryColor, setPrimaryColor] = useState(business.branding.primaryColor)
  const [logoFile, setLogoFile] = useState<File>()
  const [logoPreview, setLogoPreview] = useState(business.branding.logoUrl)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const handleLogoFile = (file: File | undefined) => {
    setLogoFile(file)
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setLogoPreview(String(reader.result))
    reader.readAsDataURL(file)
  }

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'El nombre es obligatorio.'
    if (!country.trim()) next.country = 'El país es obligatorio.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaveError(undefined)
    if (!validate()) return

    setSaving(true)
    try {
      await onSave({ name: name.trim(), type, country: country.trim(), primaryColor })
      if (logoFile) {
        await onUploadLogo(logoFile)
      }
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar el negocio.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Editar datos del negocio"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="business-edit-form" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} id="business-edit-form">
        <FormField label="Nombre del negocio" htmlFor="business-name" error={errors.name}>
          <input id="business-name" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>

        <FormField label="Tipo de negocio" htmlFor="business-type">
          <select id="business-type" value={type} onChange={(e) => setType(e.target.value as BusinessType)}>
            {Object.entries(BUSINESS_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="País" htmlFor="business-country" error={errors.country}>
          <input id="business-country" value={country} onChange={(e) => setCountry(e.target.value)} />
        </FormField>

        <FormField label="Color de marca" htmlFor="business-color">
          <input id="business-color" type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
        </FormField>

        <FormField label="Logo" htmlFor="business-logo" hint="Se guarda en tu panel de inmediato al cambiarlo.">
          <input id="business-logo" type="file" accept="image/*" onChange={(e) => handleLogoFile(e.target.files?.[0])} />
        </FormField>

        {logoPreview && (
          <div className="business-edit-form__preview">
            <img src={logoPreview} alt="Vista previa del logo" />
          </div>
        )}

        {saveError && <div className="form-error-banner">{saveError}</div>}
      </form>
    </Modal>
  )
}
