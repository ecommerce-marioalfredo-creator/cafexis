import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import './ConnectModal.css'

interface ConnectModalProps {
  onGoogle: () => Promise<void>
  onGuest: (name: string) => Promise<void>
  onClose: () => void
}

const NAME_MAX_LENGTH = 60

/**
 * Las dos formas de conectarse en la vista del cliente: con Google, que guarda
 * el historial en su cuenta, o sin cuenta, solo con el nombre que verá el
 * negocio en la comanda.
 */
export function ConnectModal({ onGoogle, onGuest, onClose }: ConnectModalProps) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const run = async (connect: () => Promise<void>) => {
    setError(undefined)
    setBusy(true)
    try {
      await connect()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos conectarte. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const handleGuest = (e: FormEvent) => {
    e.preventDefault()
    const cleanName = name.trim()
    if (cleanName.length < 2) {
      setError('Escribe tu nombre para continuar.')
      return
    }
    void run(() => onGuest(cleanName))
  }

  return (
    <Modal title="Conéctate" onClose={onClose}>
      <Button variant="primary" type="button" className="btn--block" disabled={busy} onClick={() => void run(onGoogle)}>
        Continuar con Google
      </Button>
      <p className="connect-modal__hint">Guarda tu historial en tu cuenta, para verlo desde cualquier celular.</p>

      <div className="connect-modal__divider">o</div>

      <form onSubmit={handleGuest}>
        <FormField label="Tu nombre" htmlFor="guest-name" hint="El negocio lo verá en tu pedido.">
          <input
            id="guest-name"
            value={name}
            maxLength={NAME_MAX_LENGTH}
            autoComplete="given-name"
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
        <Button variant="secondary" type="submit" className="btn--block" disabled={busy}>
          {busy ? 'Conectando…' : 'Continuar sin cuenta'}
        </Button>
      </form>
      <p className="connect-modal__hint">Sin cuenta, tu historial solo queda en este dispositivo.</p>

      {error && <div className="form-error-banner connect-modal__error">{error}</div>}
    </Modal>
  )
}
