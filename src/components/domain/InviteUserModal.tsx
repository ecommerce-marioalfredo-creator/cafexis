import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import type { InvitableRole } from '@/types/domain'

interface InviteUserModalProps {
  onInvite: (input: { email: string; name: string; role: InvitableRole }) => Promise<void>
  onClose: () => void
}

const ROLE_LABEL: Record<InvitableRole, string> = {
  administrador: 'Administrador / dueño',
  barista: 'Barista / vendedor',
}

/**
 * Invita a un usuario interno por correo (no crea la cuenta directamente):
 * la persona recibe un enlace de Supabase Auth para definir su propia
 * contraseña, sin afectar la sesión de quien invita.
 */
export function InviteUserModal({ onInvite, onClose }: InviteUserModalProps) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<InvitableRole>('barista')
  const [error, setError] = useState<string>()
  const [sending, setSending] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(undefined)

    if (!email.trim() || !name.trim()) {
      setError('Completa el nombre y el correo de la persona a invitar.')
      return
    }

    setSending(true)
    try {
      await onInvite({ email: email.trim(), name: name.trim(), role })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la invitación.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      title="Invitar usuario"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="invite-user-form" disabled={sending}>
            {sending ? 'Enviando…' : 'Enviar invitación'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} id="invite-user-form">
        <FormField label="Nombre" htmlFor="invite-name">
          <input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" />
        </FormField>

        <FormField
          label="Correo electrónico"
          htmlFor="invite-email"
          hint="Le enviaremos un enlace para que cree su propia contraseña."
        >
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="persona@negocio.com"
          />
        </FormField>

        <FormField label="Rol" htmlFor="invite-role">
          <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as InvitableRole)}>
            {Object.entries(ROLE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormField>

        {error && <div className="form-error-banner">{error}</div>}
      </form>
    </Modal>
  )
}
