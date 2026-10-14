import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { CATEGORY_LABEL, PRIORITY_META, STATUS_META, formatRelative } from './supportLabels'
import type { SupportCaseSummary } from '@/types/domain'
import './support.css'

interface CaseListProps {
  cases: SupportCaseSummary[]
  /** Ruta base del detalle: '/ayuda' o '/soporte/casos'. */
  basePath: string
  showBusiness?: boolean
  showAssignee?: boolean
}

/** Lista de casos como filas enlazadas (se apilan en pantallas angostas). */
export function CaseList({ cases, basePath, showBusiness = false, showAssignee = false }: CaseListProps) {
  return (
    <ul className="case-list">
      {cases.map((c) => (
        <li key={c.id}>
          <Link to={`${basePath}/${c.id}`} className="case-list__row">
            <div className="case-list__main">
              <span className="case-list__code">{c.code}</span>
              <strong className="case-list__subject">{c.subject}</strong>
              <span className="case-list__meta">
                {showBusiness && <>{c.businessName} · </>}
                {CATEGORY_LABEL[c.category]} · {c.messages} mensaje{c.messages === 1 ? '' : 's'} · {formatRelative(c.lastActivityAt)}
                {showAssignee && <> · {c.assignedToName ? `Asignado a ${c.assignedToName}` : 'Sin asignar'}</>}
              </span>
            </div>
            <div className="case-list__badges">
              <Badge tone={PRIORITY_META[c.priority].tone}>{PRIORITY_META[c.priority].label}</Badge>
              <Badge tone={STATUS_META[c.status].tone}>{STATUS_META[c.status].label}</Badge>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
