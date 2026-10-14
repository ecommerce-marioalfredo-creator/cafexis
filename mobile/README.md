# Apps móviles de Cafexis (Android e iOS)

Dos apps de tienda salen del **mismo código web** (React + Vite) envuelto con
[Capacitor](https://capacitorjs.com/). Reutilizan todo: pantallas, servicios
(`src/services/api/*`) y Supabase.

| App | Para quién | Qué incluye | Identificador | Proyectos nativos |
|---|---|---|---|---|
| **Cafexis** | Clientes finales | Mis negocios, catálogo, pedidos, trazabilidad por lote | `co.cafexis.clientes` | `mobile/clientes/android`, `mobile/clientes/ios` |
| **Cafexis Equipo** | Personal y soporte | Panel del negocio, ventas, ayuda, consola de soporte | `co.cafexis.equipo` | `mobile/equipo/android`, `mobile/equipo/ios` |

La web (cafexis.vercel.app) sigue llevando ambas partes. Qué parte compila
cada app lo decide el modo de Vite (`src/platform/appTarget.ts`); qué rutas
incluye, `src/router.tsx`.

## Requisitos

- **Android**: [Android Studio](https://developer.android.com/studio) (trae
  el SDK y Java). Funciona en Windows, macOS y Linux.
- **iOS**: un Mac con [Xcode](https://developer.apple.com/xcode/) y
  CocoaPods. Apple no permite compilar apps de iOS en Windows.
- Para publicar: cuenta de Google Play Console (pago único) y Apple
  Developer Program (anual).

## Compilar y abrir

```bash
npm run mobile:clientes                      # compila la web en modo "clientes" y la copia a Android/iOS
npm run mobile:clientes -- open android      # abre Android Studio → Run ▶ en un emulador o teléfono
npm run mobile:clientes -- open ios          # abre Xcode (en un Mac)

npm run mobile:equipo                        # lo mismo para "Cafexis Equipo"
npm run mobile:equipo -- open android
```

Cada vez que cambie el código web hay que volver a correr
`npm run mobile:<app>` para que la app tenga la versión nueva. El `.env`
con `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` se incluye en la
compilación igual que en la web.

## Qué se adaptó para móvil

- **Login con Google (app de clientes)**: Google bloquea el inicio de sesión
  dentro de un WebView embebido, así que se abre en el navegador del
  sistema y vuelve a la app por *deep link*
  (`co.cafexis.clientes://auth-callback`), donde se canjea el código
  (flujo PKCE). Ver `src/services/api/customerAuthService.ts` y
  `src/platform/nativeBridge.ts`.
- **Deep links**: `co.cafexis.clientes://app/c/mi-cafeteria` abre ese
  catálogo dentro de la app. Registrados en `AndroidManifest.xml` e
  `Info.plist` de cada proyecto.
- **Botón atrás de Android**: vuelve a la pantalla anterior o cierra la app.
- **Bordes de pantalla**: el contenido no queda bajo la barra de estado ni el
  notch (`capacitor.config.ts`).
- **Abrir un negocio por link o código** en "Mis negocios": dentro de la
  app no hay barra de direcciones.
- Las apps **no muestran la cuenta demo** en el login (la web sí).

## Pendiente antes de publicar

1. **Supabase → Authentication → URL Configuration → Redirect URLs**: agregar
   `co.cafexis.clientes://auth-callback`. Sin esto, el login con Google de la
   app de clientes vuelve a la web en lugar de a la app.
2. **Identificadores definitivos**: `co.cafexis.clientes` y
   `co.cafexis.equipo` asumen el dominio `cafexis.co`. Si la empresa usa otro,
   cámbialos en `capacitor.config.ts` y `src/platform/appTarget.ts` **antes
   de la primera publicación** (después las tiendas no permiten cambiarlos) y
   vuelve a crear los proyectos nativos.
3. **Íconos y pantalla de inicio**: las apps usan el ícono por defecto de
   Capacitor. Hace falta el isotipo (la taza, sin el texto) en **1024×1024 px**
   con fondo; el logo actual es 768×646 e incluye el texto, que no se lee
   como ícono. Con ese archivo:
   `npx @capacitor/assets generate --iconBackgroundColor '#F1EFE8'`.
4. **QR que abran la app** (opcional): hoy los QR apuntan a la web. Para que
   abran la app si está instalada se necesitan *App Links* (Android) y
   *Universal Links* (iOS), que requieren publicar
   `/.well-known/assetlinks.json` y `apple-app-site-association` con las
   huellas de firma de cada app.
5. **Notificaciones push** (opcional): p. ej. "tu pedido está listo" o "nuevo
   caso de soporte"; requieren Firebase Cloud Messaging y APNs.
