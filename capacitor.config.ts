import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Dos apps de tienda a partir del mismo código (Fase 7):
 *   - clientes: "Cafexis" — catálogo, pedidos y trazabilidad del cliente final.
 *   - equipo:   "Cafexis Equipo" — panel del personal y consola de soporte.
 * La variable CAFEXIS_APP elige cuál; no se usa directamente sino a través de
 * scripts/mobile.mjs (npm run mobile:clientes / mobile:equipo), que también
 * compila la web en el modo de Vite correspondiente.
 *
 * Los appId son los identificadores permanentes en Google Play y App Store:
 * cámbialos ANTES de la primera publicación si el dominio de la empresa no
 * es cafexis.co (después ya no se pueden cambiar). Si cambian, actualiza
 * también NATIVE_URL_SCHEME en src/platform/appTarget.ts.
 */
const APPS = {
  clientes: { appId: 'co.cafexis.clientes', appName: 'Cafexis' },
  equipo: { appId: 'co.cafexis.equipo', appName: 'Cafexis Equipo' },
} as const

const target = process.env.CAFEXIS_APP === 'equipo' ? 'equipo' : 'clientes'

const config: CapacitorConfig = {
  ...APPS[target],
  webDir: `dist-${target}`,
  android: { path: `mobile/${target}/android` },
  // 'always': el contenido no queda debajo del notch ni de la barra de estado.
  ios: { path: `mobile/${target}/ios`, contentInset: 'always' },
  plugins: {
    // Android: Capacitor ajusta el WebView para no quedar bajo las barras del sistema.
    SystemBars: { insetsHandling: 'native' },
  },
}

export default config
