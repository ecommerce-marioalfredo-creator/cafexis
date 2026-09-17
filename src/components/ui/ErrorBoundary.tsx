import { Component, type ReactNode } from 'react'
import './ErrorBoundary.css'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Red de seguridad para errores de renderizado que de otro modo dejarían
 * la pantalla en blanco (por ejemplo, configuración faltante o un error de
 * red no manejado). No sustituye el manejo de errores de cada pantalla —
 * es el último recurso antes del "no pasa nada".
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('Error no controlado en Cafexis:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <div className="error-boundary__panel">
            <h1>Algo salió mal</h1>
            <p>Cafexis no pudo cargar correctamente. Detalle técnico:</p>
            <pre>{this.state.error.message}</pre>
            <button onClick={() => window.location.reload()}>Recargar página</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
