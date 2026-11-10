import { Fragment, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { deletePromoCode, setPromoCodeActive } from '@/services/api/superUserService'
import { PromoCodeFormModal } from './PromoCodeFormModal'
import { PROMO_STATE_META, errorText, formatDate, promoBenefitText, promoState } from './superUserFormat'
import type { AdminPlan, PromoCode } from '@/types/domain'

type CodeFilter = 'disponibles' | 'no_disponibles' | 'todos'

const FILTERS: Array<{ id: CodeFilter; label: string }> = [
  { id: 'disponibles', label: 'Disponibles' },
  { id: 'no_disponibles', label: 'Vencidos, agotados o desactivados' },
  { id: 'todos', label: 'Todos' },
]

interface Props {
  codes: PromoCode[]
  plans: AdminPlan[]
  onChanged: (message: string) => Promise<void>
}

/** Códigos de promoción: crear, editar, activar o desactivar, borrar los no usados y ver quién los usó. */
export function PromoCodesView({ codes, plans, onChanged }: Props) {
  const [filter, setFilter] = useState<CodeFilter>('disponibles')
  const [editing, setEditing] = useState<PromoCode | 'nuevo'>()
  const [deleting, setDeleting] = useState<PromoCode>()
  const [openUses, setOpenUses] = useState<string>()
  const [busyId, setBusyId] = useState<string>()
  const [error, setError] = useState<string>()
  const [copied, setCopied] = useState<string>()

  const shown = codes.filter((c) => {
    const available = promoState(c) === 'activo'
    return filter === 'todos' || (filter === 'disponibles' ? available : !available)
  })

  const run = async (promo: PromoCode, action: () => Promise<void>, message: string) => {
    setBusyId(promo.id)
    setError(undefined)
    try {
      await action()
      await onChanged(message)
    } catch (err) {
      setError(errorText(err, 'No se pudo guardar el cambio.'))
    } finally {
      setBusyId(undefined)
    }
  }

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(code)
      setTimeout(() => setCopied((c) => (c === code ? undefined : c)), 2000)
    } catch {
      // Sin permiso para el portapapeles: el código queda a la vista para copiarlo a mano.
    }
  }

  return (
    <section className="su-section" aria-label="Códigos de promoción">
      <div className="su-toolbar">
        <p className="su-muted su-toolbar__text">
          Dos tipos: <strong>días gratis</strong> de un plan pago (se aplican al instante) o <strong>descuento</strong> en el
          precio durante unos meses (lo descuentas al cobrar). El administrador lo escribe en Suscripción, o tú lo aplicas
          desde “Negocios y usuarios”. Cada negocio usa un código una sola vez.
        </p>
        <Button variant="primary" onClick={() => setEditing('nuevo')}>
          Nuevo código
        </Button>
      </div>

      <div className="page-toolbar__filters su-filters" role="group" aria-label="Filtrar códigos">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            className={['filter-chip', filter === f.id ? 'filter-chip--active' : ''].join(' ')}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="form-error-banner">{error}</div>}

      {shown.length === 0 ? (
        <EmptyState
          title={codes.length === 0 ? 'Aún no hay códigos de promoción' : 'Ningún código en esta lista'}
          description={codes.length === 0 ? 'Crea el primero con “Nuevo código”.' : undefined}
        />
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table su-codes">
            <thead>
              <tr>
                <th>Código</th>
                <th>Beneficio</th>
                <th>Se puede usar hasta</th>
                <th className="console-table__num">Usos</th>
                <th>Estado</th>
                <th>
                  <span className="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((promo) => {
                const state = PROMO_STATE_META[promoState(promo)]
                const uses = promo.redemptions.length
                const busy = busyId === promo.id
                const usesOpen = openUses === promo.id
                return (
                  <Fragment key={promo.id}>
                    <tr>
                      <td>
                        <button
                          type="button"
                          className="su-code su-code--button"
                          onClick={() => copy(promo.code)}
                          title="Copiar código"
                        >
                          {promo.code}
                        </button>
                        {copied === promo.code && (
                          <span className="su-muted" role="status">
                            {' '}
                            Copiado
                          </span>
                        )}
                        {promo.description && <span className="su-muted su-codes__desc">{promo.description}</span>}
                      </td>
                      <td data-label="Beneficio">{promoBenefitText(promo, plans)}</td>
                      <td data-label="Se puede usar hasta">{formatDate(promo.expiresAt)}</td>
                      <td className="console-table__num" data-label="Usos">
                        {uses > 0 ? (
                          <button
                            type="button"
                            className="su-link"
                            aria-expanded={usesOpen}
                            onClick={() => setOpenUses(usesOpen ? undefined : promo.id)}
                          >
                            {uses}
                            {promo.maxRedemptions ? ` de ${promo.maxRedemptions}` : ''}
                          </button>
                        ) : (
                          `0${promo.maxRedemptions ? ` de ${promo.maxRedemptions}` : ''}`
                        )}
                      </td>
                      <td>
                        <Badge tone={state.tone}>{state.label}</Badge>
                      </td>
                      <td>
                        <span className="su-codes__actions">
                          <Button variant="secondary" disabled={busy} onClick={() => setEditing(promo)}>
                            Editar
                          </Button>
                          <Button
                            variant="tertiary"
                            disabled={busy}
                            onClick={() =>
                              run(
                                promo,
                                () => setPromoCodeActive(promo.id, !promo.active),
                                promo.active ? `Desactivaste el código ${promo.code}.` : `Activaste el código ${promo.code}.`,
                              )
                            }
                          >
                            {promo.active ? 'Desactivar' : 'Activar'}
                          </Button>
                          {uses === 0 && (
                            <Button variant="tertiary" disabled={busy} onClick={() => setDeleting(promo)}>
                              Borrar
                            </Button>
                          )}
                        </span>
                      </td>
                    </tr>
                    {usesOpen && (
                      <tr className="su-codes__uses">
                        <td colSpan={6}>
                          <ul>
                            {promo.redemptions.map((r) => (
                              <li key={`${r.businessId}-${r.createdAt}`}>
                                <strong>{r.businessName || 'Negocio'}</strong> · {formatDate(r.createdAt)} · {r.summary}
                                {r.byPlatform ? ' · aplicado por Cafexis' : ''}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <PromoCodeFormModal
          plans={plans}
          promo={editing === 'nuevo' ? undefined : editing}
          onClose={() => setEditing(undefined)}
          onSaved={async (message) => {
            setEditing(undefined)
            await onChanged(message)
          }}
        />
      )}

      {deleting && (
        <Modal
          title={`Borrar el código ${deleting.code}`}
          onClose={() => setDeleting(undefined)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleting(undefined)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                disabled={busyId === deleting.id}
                onClick={async () => {
                  const promo = deleting
                  setDeleting(undefined)
                  await run(promo, () => deletePromoCode(promo.id), `Borraste el código ${promo.code}.`)
                }}
              >
                Borrar
              </Button>
            </>
          }
        >
          <p>Nadie lo ha usado todavía. Si alguien ya lo tiene, al escribirlo le saldrá que no existe.</p>
        </Modal>
      )}
    </section>
  )
}
