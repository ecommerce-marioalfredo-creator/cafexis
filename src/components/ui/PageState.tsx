import './PageState.css'

export function PageLoading({ label = 'Cargando información…' }: { label?: string }) {
  return (
    <div className="page-state">
      <div className="page-state__spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function PageError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="page-state page-state--error">
      <strong>No pudimos cargar esta información</strong>
      <span>{message}</span>
      {onRetry && (
        <button className="page-state__retry" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  )
}
