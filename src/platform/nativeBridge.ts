import { App, type URLOpenListenerEvent } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { supabase } from '@/services/api/supabaseClient'
import { IS_NATIVE, NATIVE_URL_SCHEME } from './appTarget'
import { takeNativeAuthReturn } from './nativeAuthReturn'

interface NavigableRouter {
  navigate: (to: string, options?: { replace?: boolean }) => unknown
}

/**
 * Integración con el sistema operativo en las apps Android/iOS (Fase 7).
 * En la web no hace nada. Se llama una vez desde main.tsx.
 *
 *  - Deep links: `co.cafexis.clientes://auth-callback?code=…` termina el
 *    login con Google; cualquier otro (`co.cafexis.clientes://app/c/mi-cafeteria`)
 *    abre esa ruta dentro de la app.
 *  - Botón "atrás" de Android: vuelve a la pantalla anterior o cierra la app.
 */
export function initNativeBridge(router: NavigableRouter): void {
  if (!IS_NATIVE) return

  void App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
    void handleDeepLink(event.url, router)
  })

  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back()
    else void App.exitApp()
  })
}

async function handleDeepLink(rawUrl: string, router: NavigableRouter): Promise<void> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return
  }
  if (url.protocol !== `${NATIVE_URL_SCHEME}:`) return

  if (url.host === 'auth-callback') {
    // Cierra la pestaña del navegador del sistema (iOS; en Android no hace falta).
    void Browser.close().catch(() => undefined)

    const code = url.searchParams.get('code')
    const providerError = url.searchParams.get('error_description')
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) console.error('No se pudo completar el inicio de sesión:', error.message)
    } else if (providerError) {
      console.error('Inicio de sesión cancelado o rechazado:', providerError)
    }
    router.navigate(takeNativeAuthReturn() ?? '/', { replace: true })
    return
  }

  // co.cafexis.clientes://app/c/mi-cafeteria -> /c/mi-cafeteria
  const path = `${url.pathname}${url.search}`
  if (path.startsWith('/')) router.navigate(path)
}
