import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/global.css'
import './styles/pages.css'
import './components/ui/ErrorBoundary.css'
import { ErrorBoundary } from './components/ui/ErrorBoundary'

const root = ReactDOM.createRoot(document.getElementById('root')!)

function renderFatalError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  root.render(
    <div className="error-boundary">
      <div className="error-boundary__panel">
        <h1>Cafexis no pudo iniciar</h1>
        <p>Ocurrió un error al cargar la configuración de la aplicación:</p>
        <pre>{message}</pre>
        <p>
          Si esto ocurre en un despliegue (Vercel, Netlify, etc.), revisa que las variables de entorno
          <code> VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> estén configuradas ahí.
        </p>
      </div>
    </div>,
  )
}

// El import de App (y transitivamente de supabaseClient.ts) puede lanzar en
// tiempo de evaluación del módulo si faltan las variables de entorno de
// Supabase — eso ocurre ANTES de que React monte nada, así que un Error
// Boundary normal no lo atrapa. Este try/catch alrededor del import dinámico
// es lo único que evita una pantalla en blanco sin explicación en ese caso.
import('./App')
  .then(({ App }) => {
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>,
    )
  })
  .catch(renderFatalError)
