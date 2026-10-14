import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useSupportCase, useSupportStaff } from '@/hooks/useSupport'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageLoading, PageError } from '@/components/ui/PageState'
import { CATEGORY_LABEL, PRIORITY_META, STATUS_META, formatDateTime } from './supportLabels'
import type { SupportCasePriority, SupportCaseStatus } from '@/types/domain'
import './support.css'

interface CaseThreadProps {
  caseId: string
  /** Equipo de plataforma: controles de estado/prioridad/asignación y notas internas. */
  staff: boolean
  backTo: string
  backLabel: string
}

/**
 * Detalle de un caso con su conversación. La base de datos ya filtra las
 * notas internas para el negocio y valida cada cambio; aquí solo se
 * muestran los controles que cada lado puede usar.
 */
export function CaseThread({ caseId, staff, backTo, backLabel }: CaseThreadProps) {
  const { supportCase: c, loading, error, reload, reply, update } = useSupportCase(caseId)
  const staffMembers = useSupportStaff(staff)
  const [body, setBody] = useState('')
  const [internal, setInternal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string>()

  if (loading && !c) return <PageLoading label="Cargando caso…" />
  if (error) return <PageError message={error} onRetry={reload} />
  if (!c) return null

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setActionError(undefined)
    try {
      await action()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo completar la acción.')
    } finally {
      setBusy(false)
    }
  }

  const handleReply = (e: FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    void run(async () => {
      await reply(body.trim(), staff && internal)
      setBody('')
      setInternal(false)
    })
  }

  const closed = c.status === 'cerrado'

  return (
    <div className="section-stack case-thread">
      <div>
        <Link to={backTo} className="case-thread__back">
          ← {backLabel}
        </Link>
        <div className="case-thread__header">
          <div>
            <span className="case-list__code">{c.code}</span>
            <h3 className="case-thread__subject">{c.subject}</h3>
            <p className="section-subtitle">
              {staff ? (
                <Link to={`/soporte/negocios/${c.businessId}`}>{c.businessName}</Link>
              ) : (
                c.businessName
              )}{' '}
              · {CATEGORY_LABEL[c.category]} · abierto por {c.openedByName ?? 'usuario eliminado'} el {formatDateTime(c.createdAt)}
            </p>
          </div>
          <div className="case-list__badges">
            <Badge tone={PRIORITY_META[c.priority].tone}>{PRIORITY_META[c.priority].label}</Badge>
            <Badge tone={STATUS_META[c.status].tone}>{STATUS_META[c.status].label}</Badge>
          </div>
        </div>
      </div>

      {staff && (
        <Card>
          <div className="case-thread__controls">
            <label>
              Estado
              <select
                value={c.status}
                disabled={busy}
                onChange={(e) => run(() => update({ status: e.target.value as SupportCaseStatus }))}
              >
                {(Object.keys(STATUS_META) as SupportCaseStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Prioridad
              <select
                value={c.priority}
                disabled={busy}
                onChange={(e) => run(() => update({ priority: e.target.value as SupportCasePriority }))}
              >
                {(Object.keys(PRIORITY_META) as SupportCasePriority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Asignado a
              <select
                value={c.assignedTo ?? ''}
                disabled={busy}
                onChange={(e) => run(() => update({ assignedTo: e.target.value || null }))}
              >
                <option value="">Sin asignar</option>
                {staffMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Card>
      )}

      {!staff && c.status === 'resuelto' && (
        <Card>
          <div className="case-thread__confirm">
            <span>El equipo de soporte marcó este caso como resuelto. ¿Se solucionó tu problema?</span>
            <div className="report-page__actions">
              <Button variant="primary" disabled={busy} onClick={() => run(() => update({ status: 'cerrado' }))}>
                Sí, cerrar el caso
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => run(() => update({ status: 'abierto' }))}>
                No, sigue pasando
              </Button>
            </div>
          </div>
        </Card>
      )}

      {actionError && <div className="form-error-banner">{actionError}</div>}

      <ol className="case-thread__timeline">
        <li className="case-message case-message--business">
          <div className="case-message__meta">
            <strong>{c.openedByName ?? 'Negocio'}</strong> · {formatDateTime(c.createdAt)}
          </div>
          <p className="case-message__body">{c.description}</p>
        </li>
        {c.messages.map((m) =>
          m.kind === 'evento' ? (
            <li key={m.id} className="case-event">
              {m.authorName ?? 'Sistema'}: {m.body} · {formatDateTime(m.createdAt)}
            </li>
          ) : (
            <li
              key={m.id}
              className={[
                'case-message',
                m.authorIsStaff ? 'case-message--staff' : 'case-message--business',
                m.kind === 'nota_interna' ? 'case-message--internal' : '',
              ].join(' ')}
            >
              <div className="case-message__meta">
                <strong>{m.authorName ?? 'Usuario eliminado'}</strong>
                {m.authorIsStaff && ' (Soporte Cafexis)'} · {formatDateTime(m.createdAt)}
                {m.kind === 'nota_interna' && <Badge tone="warning">Nota interna · el negocio no la ve</Badge>}
              </div>
              <p className="case-message__body">{m.body}</p>
            </li>
          ),
        )}
      </ol>

      {closed ? (
        <p className="section-subtitle">Este caso está cerrado. Si el problema vuelve, abre un caso nuevo.</p>
      ) : (
        <form className="case-thread__reply" onSubmit={handleReply}>
          <label htmlFor="case-reply" className="case-thread__reply-label">
            {staff ? 'Responder' : 'Escribir al equipo de soporte'}
          </label>
          <textarea id="case-reply" rows={4} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="case-thread__reply-actions">
            {staff ? (
              <label className="case-thread__internal">
                <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                Nota interna (solo el equipo la ve)
              </label>
            ) : (
              <span />
            )}
            <Button variant="primary" type="submit" disabled={busy || !body.trim()}>
              {busy ? 'Enviando…' : internal ? 'Guardar nota' : 'Enviar'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
