import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import type { CoffeeLot, CoffeeLotInput, CoffeeProcess } from '@/types/domain'

interface CoffeeLotModalProps {
  lot?: CoffeeLot
  onSave: (input: CoffeeLotInput) => Promise<void>
  onClose: () => void
}

const PROCESS_LABEL: Record<CoffeeProcess, string> = {
  lavado: 'Lavado',
  honey: 'Honey',
  natural: 'Natural',
  otro: 'Otro',
}

const currentYear = new Date().getFullYear()

/** Crea o edita un lote de café, con su origen hasta la finca cuando aplica. */
export function CoffeeLotModal({ lot, onSave, onClose }: CoffeeLotModalProps) {
  const isEditing = Boolean(lot)

  const [code, setCode] = useState(lot?.code ?? '')
  const [variety, setVariety] = useState(lot?.variety ?? '')
  const [process, setProcess] = useState<CoffeeProcess>(lot?.process ?? 'lavado')
  const [originCountry, setOriginCountry] = useState(lot?.origin.country ?? 'Colombia')
  const [originRegion, setOriginRegion] = useState(lot?.origin.region ?? '')
  const [originFarm, setOriginFarm] = useState(lot?.origin.farm ?? '')
  const [story, setStory] = useState(lot?.story ?? '')
  const [quantityKg, setQuantityKg] = useState(lot ? String(lot.quantityKg) : '')
  const [harvestYear, setHarvestYear] = useState(lot ? String(lot.harvestYear) : String(currentYear))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!code.trim()) next.code = 'El código del lote es obligatorio.'
    if (!variety.trim()) next.variety = 'La variedad es obligatoria.'
    if (!originRegion.trim()) next.originRegion = 'La región de origen es obligatoria.'
    const quantityNumber = Number(quantityKg)
    if (quantityKg === '' || Number.isNaN(quantityNumber) || quantityNumber < 0) next.quantityKg = 'Ingresa una cantidad válida.'
    const yearNumber = Number(harvestYear)
    if (!harvestYear || Number.isNaN(yearNumber) || yearNumber < 1900 || yearNumber > currentYear + 1) {
      next.harvestYear = 'Ingresa un año de cosecha válido.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaveError(undefined)
    if (!validate()) return

    setSaving(true)
    try {
      await onSave({
        code: code.trim(),
        variety: variety.trim(),
        process,
        origin: {
          country: originCountry.trim(),
          region: originRegion.trim(),
          farm: originFarm.trim() || undefined,
        },
        story: story.trim() || undefined,
        quantityKg: Number(quantityKg),
        harvestYear: Number(harvestYear),
      })
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar el lote.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isEditing ? 'Editar lote' : 'Nuevo lote'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="coffee-lot-form" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar lote'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} id="coffee-lot-form">
        <FormField label="Código del lote" htmlFor="lot-code" error={errors.code}>
          <input id="lot-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ej. HUI-2026-03" />
        </FormField>

        <FormField label="Variedad" htmlFor="lot-variety" error={errors.variety}>
          <input id="lot-variety" value={variety} onChange={(e) => setVariety(e.target.value)} placeholder="Ej. Castillo" />
        </FormField>

        <FormField label="Proceso" htmlFor="lot-process">
          <select id="lot-process" value={process} onChange={(e) => setProcess(e.target.value as CoffeeProcess)}>
            {Object.entries(PROCESS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="País de origen" htmlFor="lot-origin-country">
          <input id="lot-origin-country" value={originCountry} onChange={(e) => setOriginCountry(e.target.value)} />
        </FormField>

        <FormField label="Región de origen" htmlFor="lot-origin-region" error={errors.originRegion}>
          <input id="lot-origin-region" value={originRegion} onChange={(e) => setOriginRegion(e.target.value)} placeholder="Ej. Huila" />
        </FormField>

        <FormField label="Finca (opcional)" htmlFor="lot-origin-farm">
          <input id="lot-origin-farm" value={originFarm} onChange={(e) => setOriginFarm(e.target.value)} placeholder="Ej. Finca El Mirador" />
        </FormField>

        <FormField label="Cantidad (kg)" htmlFor="lot-quantity" error={errors.quantityKg}>
          <input
            id="lot-quantity"
            type="number"
            min={0}
            step={0.01}
            value={quantityKg}
            onChange={(e) => setQuantityKg(e.target.value)}
          />
        </FormField>

        <FormField label="Año de cosecha" htmlFor="lot-year" error={errors.harvestYear}>
          <input
            id="lot-year"
            type="number"
            min={1900}
            max={currentYear + 1}
            value={harvestYear}
            onChange={(e) => setHarvestYear(e.target.value)}
          />
        </FormField>

        <FormField label="Historia del lote (opcional)" htmlFor="lot-story" hint="Puede compartirse con el cliente final.">
          <textarea id="lot-story" value={story} onChange={(e) => setStory(e.target.value)} rows={3} />
        </FormField>

        {saveError && <div className="form-error-banner">{saveError}</div>}
      </form>
    </Modal>
  )
}
