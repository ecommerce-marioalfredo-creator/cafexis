import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import type { Supplier, SupplierInput } from '@/types/domain'
import './SupplierModal.css'

interface SupplierModalProps {
  onFindByNit: (nit: string) => Promise<Supplier | undefined>
  onSave: (input: SupplierInput) => Promise<void>
  onClose: () => void
}

/**
 * Da de alta un proveedor buscando primero por NIT: si ya existe en el
 * directorio compartido, se reutiliza (los campos quedan de solo lectura);
 * si no, quedan editables para registrarlo. Las sucursales se añaden como
 * una lista dinámica de nombres.
 */
export function SupplierModal({ onFindByNit, onSave, onClose }: SupplierModalProps) {
  const [nit, setNit] = useState('')
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [newBranch, setNewBranch] = useState('')
  const [existing, setExisting] = useState<Supplier>()
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const isReused = Boolean(existing)

  const handleSearch = async () => {
    if (!nit.trim()) {
      setErrors({ nit: 'Ingresa el NIT a buscar.' })
      return
    }
    setErrors({})
    setSearching(true)
    try {
      const found = await onFindByNit(nit.trim())
      setExisting(found)
      setSearched(true)
      if (found) {
        setName(found.name)
        setLocation(found.location)
        setBranches(found.branches ?? [])
      } else {
        setName('')
        setLocation('')
        setBranches([])
      }
    } finally {
      setSearching(false)
    }
  }

  const addBranch = () => {
    const trimmed = newBranch.trim()
    if (!trimmed) return
    setBranches((prev) => [...prev, trimmed])
    setNewBranch('')
  }

  const removeBranch = (index: number) => setBranches((prev) => prev.filter((_, i) => i !== index))

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!nit.trim()) next.nit = 'El NIT es obligatorio.'
    if (!isReused) {
      if (!name.trim()) next.name = 'El nombre es obligatorio.'
      if (!location.trim()) next.location = 'La ubicación es obligatoria.'
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
      await onSave({ nit: nit.trim(), name: name.trim(), location: location.trim(), branches })
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar el proveedor.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Agregar proveedor"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="supplier-form" disabled={saving || !searched}>
            {saving ? 'Guardando…' : isReused ? 'Usar este proveedor' : 'Crear proveedor'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} id="supplier-form">
        <FormField label="NIT" htmlFor="supplier-nit" error={errors.nit}>
          <div className="supplier-form__nit-row">
            <input
              id="supplier-nit"
              value={nit}
              onChange={(e) => {
                setNit(e.target.value)
                setSearched(false)
                setExisting(undefined)
              }}
              placeholder="Ej. 900123456-7"
            />
            <Button variant="secondary" type="button" onClick={handleSearch} disabled={searching}>
              {searching ? 'Buscando…' : 'Buscar'}
            </Button>
          </div>
        </FormField>

        {searched && (
          <p className={isReused ? 'supplier-form__found' : 'supplier-form__not-found'}>
            {isReused
              ? 'Proveedor existente — se reutilizará su información para tu negocio.'
              : 'No existe un proveedor con este NIT. Completa los datos para registrarlo.'}
          </p>
        )}

        <FormField label="Nombre" htmlFor="supplier-name" error={errors.name}>
          <input id="supplier-name" value={name} onChange={(e) => setName(e.target.value)} disabled={isReused} />
        </FormField>

        <FormField label="Ubicación" htmlFor="supplier-location" error={errors.location}>
          <input id="supplier-location" value={location} onChange={(e) => setLocation(e.target.value)} disabled={isReused} />
        </FormField>

        <FormField label="Sucursales" htmlFor="supplier-branch" hint="Opcional">
          <div className="supplier-form__branch-row">
            <input
              id="supplier-branch"
              value={newBranch}
              onChange={(e) => setNewBranch(e.target.value)}
              placeholder="Nombre de la sucursal"
              disabled={isReused}
            />
            <Button variant="secondary" type="button" onClick={addBranch} disabled={isReused}>
              + Agregar
            </Button>
          </div>
          {branches.length > 0 && (
            <ul className="supplier-form__branches">
              {branches.map((branch, i) => (
                <li key={`${branch}-${i}`}>
                  {branch}
                  {!isReused && (
                    <button type="button" onClick={() => removeBranch(i)} aria-label={`Quitar ${branch}`}>
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </FormField>

        {saveError && <div className="form-error-banner">{saveError}</div>}
      </form>
    </Modal>
  )
}
