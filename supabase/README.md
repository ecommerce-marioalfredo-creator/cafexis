# Base de datos de Cafexis en Supabase

Este directorio contiene el esquema completo de base de datos para Cafexis,
listo para aplicarse en un proyecto de Supabase. Todas las tablas usan el
sufijo `_cafexis` (por ejemplo `products_cafexis`, `orders_cafexis`) para que
convivan sin conflicto en un proyecto de Supabase compartido con otras cosas.

## Qué contiene

```
supabase/
  migrations/
    0001_schema_cafexis.sql          Tablas, tipos y triggers
    0002_rls_cafexis.sql             Seguridad por negocio (Row Level Security)
    0003_seed_demo_cafexis.sql       Datos de ejemplo del negocio demo
    0004_user_management_cafexis.sql Invitaciones, roles y permisos de gestión
  functions/
    invite-user/index.ts             Edge Function: invita usuarios sin cerrar tu sesión
```

El esquema traduce 1 a 1 el modelo de datos que ya usa el frontend
(`src/types/domain.ts`): negocios, usuarios internos, inventario, productos y
recetas, lotes de café (trazabilidad), proveedores, pedidos, compras y
reportes personalizados. Multi-tenant: cada fila pertenece a un
`business_id`, y las políticas de seguridad garantizan que un negocio nunca
pueda leer o modificar los datos de otro.

La autenticación usa **Supabase Auth** (no contraseñas propias): cada usuario
de `app_users_cafexis` está vinculado 1 a 1 con un usuario de `auth.users`,
que es quien maneja el login, la recuperación de contraseña, etc. de forma
segura.

## Qué necesito que me entregues

### 1. Un proyecto de Supabase

Si aún no tienes uno:
1. Crea una cuenta en [supabase.com](https://supabase.com) (tiene plan gratuito).
2. Crea un proyecto nuevo (elige una región cercana a Colombia, por ejemplo
   `us-east-1` o `sa-east-1` si está disponible).
3. Anota la **contraseña de la base de datos** que te pida al crearlo — la
   necesitarás para conectarte por línea de comandos.

### 2. Las claves de conexión (para conectar el frontend)

Dentro de tu proyecto de Supabase, ve a **Project Settings → API** y
compárteme (o colócalas tú mismo en un archivo `.env` local, ver más abajo):

| Dato | Dónde se usa | ¿Es secreto? |
|---|---|---|
| **Project URL** (`https://xxxxx.supabase.co`) | Frontend | No |
| **anon public key** | Frontend | No (es pública, protegida por RLS) |
| **service_role key** | Solo si construimos funciones de servidor | **Sí, nunca en el frontend ni en git** |

Con la Project URL y la anon key puedo conectar el frontend directamente
(instalando `@supabase/supabase-js` y reemplazando la capa `services/api/*`
que ya está preparada para esto). La `service_role key` solo se necesitaría
si más adelante construimos funciones/edge functions en el servidor — no la
compartas en ningún mensaje ni la subas a GitHub.

### 3. Cómo aplicar el esquema

Tienes dos formas, elige la que prefieras:

**Opción A — Panel web de Supabase (más simple):**
1. Ve a **SQL Editor** en el panel de tu proyecto.
2. Copia y ejecuta, en orden, el contenido de:
   - `migrations/0001_schema_cafexis.sql`
   - `migrations/0002_rls_cafexis.sql`
   - `migrations/0003_seed_demo_cafexis.sql` (opcional, son datos de ejemplo)
   - `migrations/0004_user_management_cafexis.sql`
   - `migrations/0005_fase1_datos_base_cafexis.sql`
   - `migrations/0006_fase2_operacion_diaria_cafexis.sql`
   - `migrations/0007_fase3_roles_cafexis.sql`
   - `migrations/0008_supervisor_rpc_negocio_cafexis.sql`
   - `migrations/0009_fase4_inteligencia_cafexis.sql`
   - `migrations/0010_fase5_cliente_final_cafexis.sql`
   - `migrations/0011_fase7_plataforma_soporte_cafexis.sql` (pendiente)
   - `migrations/0012_fase6_integraciones_cafexis.sql` (pendiente — ver paso 11;
     el número de archivo quedó después de la 0011 por orden de llegada, pero
     no depende de ella)
   - `migrations/0013_auditoria_seguridad_cafexis.sql` (ya aplicada — ver paso 13)
   - `migrations/0014_pedidos_y_permisos_por_rol_cafexis.sql` (ya aplicada — ver paso 14)
   - `migrations/0015_fotos_producto_cafexis.sql` (ver paso 15)
   - `migrations/0016_cancelacion_y_avisos_cafexis.sql` (ya aplicada — ver paso 16)
   - `migrations/0017_invitados_cafexis.sql` (ver paso 17)
   - `migrations/0018_guias_preparacion_cafexis.sql` (pendiente — ver paso 18)
   - `migrations/0019_planes_suscripcion_cafexis.sql` (ya aplicada — ver paso 19)
   - `migrations/0020_cambio_de_plan_cafexis.sql` (ya aplicada — ver paso 20)
   - `migrations/0021_super_usuario_promociones_cafexis.sql` (pendiente — ver paso 21)

**Opción B — Supabase CLI (recomendado si seguimos iterando el esquema):**
```bash
npm install -g supabase
supabase login
supabase link --project-ref <tu-project-ref>   # está en Project Settings → General
supabase db push
```

### 4. Usuario demo (ya creado — login verificado)

El seed crea el negocio "Mi Cafetería" pero no el usuario, porque las
contraseñas las maneja Supabase Auth, no una tabla nuestra. El usuario demo
(`laura@micafeteria.co` / `cafexis123`) ya está creado en tu proyecto: se
verificó el login por separado (llamada REST directa a
`/auth/v1/token?grant_type=password`), responde `200` y trae un perfil
completo en `app_users_cafexis` (rol `administrador`, negocio "Mi
Cafetería"). No se necesita ningún paso adicional.

Si en algún momento necesitas recrearlo (por ejemplo en un proyecto de
Supabase nuevo):

1. En el panel de Supabase, ve a **Authentication → Users → Add user** y
   crea un usuario con correo `laura@micafeteria.co` y contraseña `cafexis123`
   (o la que prefieras — solo ajusta el mensaje en `LoginPage.tsx` si la cambias).
   Marca **Auto Confirm User** al crearlo para no depender de un correo de
   confirmación.
2. Copia el **UUID** que Supabase le asignó a ese usuario.
3. En el **SQL Editor**, ejecuta (reemplazando `<uuid-del-usuario>`):
   ```sql
   insert into app_users_cafexis (id, business_id, name, email, role)
   values ('<uuid-del-usuario>', '11111111-1111-1111-1111-111111111111', 'Laura Gómez', 'laura@micafeteria.co', 'administrador');
   ```

De ahí en adelante, cuando alguien se registre desde el formulario de
Cafexis, todo este proceso (crear usuario en Auth + su fila en
`app_users_cafexis` + su negocio en `businesses_cafexis`) lo hace el propio
frontend automáticamente — este paso manual es solo para recrear la cuenta
demo si hiciera falta.

### 5. Migración de Fase 1 (ya aplicada — Configuración y Lotes de café)

El frontend ya incluye el CRUD completo de Inventario, Configuración del
negocio, Proveedores y Lotes de café, pero dos piezas dependen de que se
ejecute `migrations/0005_fase1_datos_base_cafexis.sql` en tu proyecto real:

1. **Vincular un producto empacado a su lote de origen** (en el formulario de
   Productos): la migración agrega la columna `coffee_lot_id` a
   `products_cafexis`. Sin ella, guardar un producto con un lote seleccionado
   falla con `Could not find the 'coffee_lot_id' column...`.
2. **Subir el logo del negocio desde Configuración**: la migración crea el
   bucket público de Storage `business-logos` con sus políticas (cada negocio
   solo puede subir/reemplazar su propio archivo). Sin ella, subir un logo
   falla con `Bucket not found`. Editar nombre, tipo, país y color del
   negocio sí funciona sin este paso, porque solo usa columnas que ya
   existían.

Para aplicarla: en el **SQL Editor** del panel de Supabase, copia y ejecuta
el contenido de `migrations/0005_fase1_datos_base_cafexis.sql`. El resto de
los módulos nuevos (Inventario completo, Proveedores con búsqueda por NIT,
creación/edición de Lotes de café) no dependen de este paso y ya funcionan
contra el esquema actual.

### 6. Migración de Fase 2 (ya aplicada — vender y comprar)

`migrations/0006_fase2_operacion_diaria_cafexis.sql` (después de la 0005)
habilita la operación diaria. Sin ella, "Nueva venta" y las acciones de
Compras fallan con `Could not find the function ...`.

- **Punto de venta** (`register_sale_cafexis`): crea el pedido y sus líneas en
  una transacción, con los precios de la base de datos. Métodos de pago:
  efectivo, tarjeta, transferencia y Nequi (solo se registra; no hay cobro en
  línea). Los pedidos nuevos se numeran `V-0001`, `V-0002`…
- **Descuento automático de inventario**: un trigger en `order_items_cafexis`
  descuenta los ingredientes de la receta; si el producto no tiene receta pero
  sí lote de origen y "kg del lote por unidad", descuenta del lote. Si falta
  stock, **la venta no se guarda** y se muestra qué falta.
- **Compras automáticas**: cuando una venta o un ajuste deja un insumo en
  "bajo" o "agotado", se agrega a una propuesta del sistema para su
  *proveedor preferido* (campo nuevo en Inventario), sin duplicar insumos que
  ya estén en una orden abierta. Cantidad sugerida: lo que falta para llegar
  al doble del umbral. El botón "Revisar inventario" hace la misma revisión
  para todo el inventario.
- **Ciclo de una orden**: propuesta → confirmada → recibida, o cancelada desde
  propuesta/confirmada. Las órdenes manuales nacen confirmadas. Recibir suma
  las cantidades al inventario. La base de datos rechaza cualquier otro salto
  de estado.

### 7. Migración de Fase 3 (ya aplicada — roles y personal)

`migrations/0007_fase3_roles_cafexis.sql` amplía las políticas de seguridad
de las tablas de negocio (inventario, productos, lotes, pedidos, compras,
proveedores del negocio, reportes personalizados) para que el
`supervisor_tecnico` pueda también **escribir** en cualquier negocio, no
solo leerlo como ya podía desde `0002_rls_cafexis.sql`. Esto habilita el
selector de negocio que aparece en el panel superior solo para ese rol: al
elegir otro negocio, el supervisor pasa a operar ahí (crear productos,
registrar ventas, ajustar inventario, etc.) con los mismos permisos que el
administrador de ese negocio.

También en esta fase: el menú lateral y las rutas del panel ahora se
filtran por rol. El barista solo ve "Ventas" (su tablero de pedidos, con la
receta de cada bebida visible en cada tarjeta); intentar abrir cualquier
otra sección a mano lo redirige de vuelta. Administrador y supervisor
técnico siguen viendo el panel completo.

### 8. Supervisor operando otro negocio en ventas y compras (ya aplicada)

`migrations/0008_supervisor_rpc_negocio_cafexis.sql` corrige que las
funciones de Fase 2 (`register_sale_cafexis`, `create_purchase_order_cafexis`,
`generate_purchase_proposals_cafexis`) usaban siempre el negocio del perfil:
un supervisor técnico que eligiera otro negocio en el selector registraba
ventas y compras en el suyo. Ahora reciben `p_business_id`; un negocio
distinto al propio solo se acepta si quien llama es supervisor técnico.

**Importante:** el frontend ya envía `p_business_id`, así que sin esta
migración "Nueva venta", "Nueva orden de compra" y "Revisar inventario"
fallan con `Could not find the function ...`.

### 9. Migración de Fase 4 (ya aplicada — reportes y reposición)

`migrations/0009_fase4_inteligencia_cafexis.sql` (después de la 0008). Se
verificó directamente contra tu proyecto: `report_sales_cafexis` responde
con datos reales, así que la sección Reportes y la "Sugerencia de
reposición" de Compras ya funcionan.

- **Historial de movimientos** (`stock_movements_cafexis`): cada cambio de
  existencia de un insumo o lote queda registrado con su motivo (venta,
  compra recibida, ajuste manual o existencia inicial). Lo escriben
  triggers; nadie puede editarlo desde la app. Al aplicar la migración se
  reconstruye el consumo de las ventas anteriores con las recetas actuales
  (marcado como `estimated`).
- **Reportes** calculados en la base de datos (sin el límite de 1000 filas
  por consulta): ventas por producto, categoría, método de pago, hora, día,
  semana o mes, y movimientos de insumos o lotes. Los 4 reportes
  predefinidos del alcance y los personalizados usan las mismas funciones.
- **Proyección de reposición** (`inventory_projection_cafexis`): consumo
  diario promedio por ventas, fecha estimada de agotamiento y cantidad
  sugerida para cubrir N días más el umbral de alerta.
- **Solo administrador y supervisor técnico** ven reportes, movimientos,
  proyección y reportes personalizados (el barista no, según el alcance).

### 10. Migración de Fase 5 (ya aplicada — cliente final web)

`migrations/0010_fase5_cliente_final_cafexis.sql` (no depende de la 0009,
se puede aplicar antes o después de ella). Se verificó directamente contra
tu proyecto: el negocio demo ya tiene `slug` (`mi-cafeteria`), y las tres
funciones públicas responden sin necesitar sesión —
`get_public_business_cafexis`, `get_public_catalog_cafexis` (devuelve el
catálogo completo de "Mi Cafetería") y `get_public_coffee_lot_cafexis`
(probado con el lote `HUI-2026-04`). El catálogo público (`/c/mi-cafeteria`)
y la trazabilidad por QR (`/trazabilidad/:lotId`) ya funcionan.

- **`businesses_cafexis.slug`**: identificador en la URL pública
  (`/c/:slug`), generado automáticamente del nombre del negocio (único en
  toda la plataforma, con sufijo numérico si hay colisión). Se asigna solo
  y no cambia al editar el nombre después.
- **`customers_cafexis`**: perfil del cliente final (login con Google), sin
  negocio fijo — a diferencia de los empleados internos
  (`app_users_cafexis`), un cliente puede estar vinculado a varios negocios
  (`customer_businesses_cafexis`), igual que elegir cuenta en Gmail.
- **Catálogo y trazabilidad públicos**: `get_public_business_cafexis`,
  `get_public_catalog_cafexis`, `get_public_coffee_lot_cafexis` — de
  lectura, sin sesión, exponen solo lo que un visitante anónimo debe ver
  (nunca las tablas completas).
- **Pedido del cliente final**: `register_public_order_cafexis` (exige
  login con Google y estar vinculado al negocio), mismo patrón que el
  punto de venta interno — los precios los toma la base de datos, nunca el
  cliente, y el mismo trigger de descuento de inventario ya existente
  (0006) aplica igual.

**Paso adicional, fuera de esta migración**: el login con Google requiere
configurar ese proveedor en el panel de Supabase. Ve a **Authentication →
Providers → Google**, actívalo, y pega el **Client ID** y **Client
Secret** de un proyecto de [Google Cloud
Console](https://console.cloud.google.com/apis/credentials) (tipo de
credencial "OAuth 2.0 Client ID", aplicación web). En **Authorized redirect
URIs** de Google Cloud, agrega la URL de callback que Supabase muestra en
esa misma pantalla (termina en `/auth/v1/callback`). Sin este paso, el
botón "Iniciar sesión con Google" del catálogo público falla.

### 11. Migración de Fase 6 (pendiente — integraciones externas)

`migrations/0012_fase6_integraciones_cafexis.sql`. Las tres piezas de esta
fase dependen de cuentas con terceros que, al escribir esto, el negocio
todavía no tiene — el código está completo y listo, pero **no se ha podido
probar contra las APIs reales de Wompi ni de Factus** sin esas
credenciales. Documentado con precisión abajo qué funciona ya mismo (toda
la parte de suscripciones, sin dependencia externa) y qué queda a la
espera de una cuenta real.

- **Suscripciones (sin dependencia externa, funciona ya)**: todo negocio
  nuevo nace con 14 días de prueba (`business_subscriptions_cafexis`,
  trigger automático al crear el negocio); los ya existentes antes de esta
  migración quedan en estado "activa" sin fecha de vencimiento, para no
  bloquear ninguna cuenta real. El administrador ve su propio estado en
  **Suscripción** (menú lateral); el supervisor técnico, además, ve y
  cambia el de cualquier negocio ahí mismo. **Desde la 0019 (paso 19)** una
  suscripción vencida ya no bloquea el panel: el negocio baja al plan
  Básica. Solo una cuenta "cancelada" va a `/suscripcion-vencida`.
- **Pasarela de pagos (Wompi, de referencia — requiere cuenta)**: desde
  esta migración, el pedido público del cliente final (`/c/:slug`) nace en
  estado `pendiente_pago`, no directo en `pedido`; el punto de venta
  interno del empleado no cambia (sigue cobrando en efectivo/datáfono
  físico). El checkout lo genera la Edge Function `create-payment-link`
  (necesita `WOMPI_PRIVATE_KEY`); la confirmación la recibe
  `wompi-webhook` (necesita `WOMPI_EVENTS_SECRET`, y debe configurarse
  como webhook en el panel de Wompi). Sin esas credenciales, ambas
  funciones responden con un error claro ("Falta configurar
  WOMPI_PRIVATE_KEY...") en vez de fallar en silencio.
  **Hoy el catálogo no usa Wompi**: el pedido llega a **Ventas** y al
  dashboard como "Por confirmar", con la forma de pago elegida, y el personal
  lo cobra y lo pasa a preparación. Las funciones siguen en el repositorio
  para retomar el pago en línea cuando la cuenta esté aprobada; habrá que
  volver a llamar a `createPaymentLink` (`paymentService.ts`) desde
  `PublicCatalogPage.tsx`.
- **Facturación electrónica DIAN (Factus, de referencia — requiere
  cuenta)**: botón "Generar factura" en cada pedido ya `entregado`
  (**Ventas**, solo administrador/supervisor técnico). La RPC
  `request_invoice_cafexis` abre la solicitud; la Edge Function
  `generate-invoice` la completa llamando a Factus (necesita
  `FACTUS_API_TOKEN`, y una cuenta con NIT y resolución de facturación DIAN
  vigente). Sin eso, la función responde con el mismo tipo de error claro.

Para desplegar las tres Edge Functions nuevas y configurar sus secretos:
```bash
supabase functions deploy create-payment-link
supabase functions deploy generate-invoice
supabase functions deploy wompi-webhook --no-verify-jwt   # Wompi no manda un JWT de Supabase

supabase secrets set WOMPI_PRIVATE_KEY=<tu-llave-privada-de-wompi>
supabase secrets set WOMPI_EVENTS_SECRET=<tu-events-secret-de-wompi>
supabase secrets set FACTUS_API_TOKEN=<tu-token-de-factus>
```
Y en el panel de Wompi (Developers → Webhooks), registra la URL pública de
`wompi-webhook` (`https://<tu-proyecto>.supabase.co/functions/v1/wompi-webhook`)
para que te avise cuando un pago se apruebe.

### 12. Migración de Fase 7 (pendiente — consola de soporte y seguridad)

`migrations/0011_fase7_plataforma_soporte_cafexis.sql` (después de la 0010;
es compatible con la 0012 en cualquier orden). Tiene **dos pasos
obligatorios** después de aplicarla:

1. **Volver a desplegar la Edge Function** `supabase functions deploy
   invite-user`. Ahora registra la invitación *antes* de enviar el correo, y
   la base de datos solo crea el perfil de un usuario invitado si encuentra
   esa invitación. Sin el redespliegue, los nuevos invitados quedan sin
   perfil.
2. **Redirect URL de la app de clientes**: en **Authentication → URL
   Configuration → Redirect URLs**, agregar
   `co.cafexis.clientes://auth-callback` (ver `mobile/README.md`).

Qué incluye:

- **Rol `soporte`**: ve todos los negocios desde la consola y atiende casos,
  pero es de **solo lectura** sobre los datos de los negocios (políticas RLS
  restrictivas + bloqueo en las RPC de venta y compra). Solo el supervisor
  técnico puede invitar o asignar este rol.
- **Casos de soporte** (`support_cases_cafexis`,
  `support_case_messages_cafexis`): administradores y baristas los abren
  desde **Ayuda y soporte**; el equipo los ve todos en la **Consola de
  soporte**, los asigna, cambia estado/prioridad, responde y deja notas
  internas que el negocio no ve. Todo cambio pasa por RPC y queda como
  evento en la conversación.
- **Consola de plataforma** (`platform_business_overview_cafexis`,
  `platform_business_detail_cafexis`): salud de todos los negocios (ventas,
  alertas, usuarios, casos) y diagnóstico de uno, en solo lectura.
- **Huecos de seguridad cerrados** (existían desde antes, pero se volvieron
  graves con los clientes que entran con Google en la Fase 5):
  - cualquier usuario autenticado podía insertarse en `app_users_cafexis`
    en cualquier negocio y con cualquier rol, incluso supervisor técnico;
  - registrarse con `signUp` y metadatos `business_id`/`role` inventados
    creaba un perfil interno sin invitación;
  - un administrador podía ascender a alguien a supervisor técnico.

**Nota para la 0012 (Fase 6)**: `request_invoice_cafexis` solo admite
administrador y supervisor técnico activos (rechaza barista y soporte), y
junto con `attach_payment_reference_cafexis` es `security definer`, porque
`invoices_cafexis` y `payment_transactions_cafexis` solo tienen policy de
lectura.

### 13. Auditoría de seguridad (ya aplicada)

`migrations/0013_auditoria_seguridad_cafexis.sql`. Después de aplicarla:

1. **Volver a desplegar cuatro Edge Functions**:
   `supabase functions deploy generate-invoice`,
   `supabase functions deploy create-payment-link`,
   `supabase functions deploy invite-user` y
   `supabase functions deploy wompi-webhook --no-verify-jwt`.
2. **Publicar el frontend del mismo commit**: el registro de negocios ahora
   usa la RPC `register_business_cafexis`, y la migración quita el permiso de
   insertar negocios y perfiles directamente desde el navegador.

Qué corrige:

- **Usuarios desactivados** con el botón "Desactivar" de Configuración
  seguían teniendo acceso completo; ahora RLS y el login los bloquean.
- **Pedidos del cliente final**: cualquier cuenta de Google podía insertar
  pedidos y líneas directo por la API (con el estado, total y precios que
  quisiera, sin pasar por el pago). Ahora solo se pide con
  `register_public_order_cafexis`.
- **Referencias entre negocios**: con el id de un producto o lote de otro
  negocio (son públicos en el catálogo y el QR) se podía descontar su
  inventario. Un trigger valida ahora que producto, receta, lote y líneas de
  compra sean del mismo negocio.
- **Supervisor técnico** vuelve a poder crear productos en el negocio que
  opera (la 0012 lo había quitado) e invitar usuarios a ese negocio.
- **Pagos**: solo se aprueba si el monto cobrado coincide con el del
  pedido, y una transacción aprobada ya no cambia con eventos tardíos.
- **Facturas**: `generate-invoice` valida el rol de quien la pide y nunca
  emite dos veces la misma factura.
- **Reportes y panel**: los pedidos "pendiente de pago" ya no cuentan como
  venta.
- **"Mis negocios"** del cliente mostraba los negocios vacíos (el cliente no
  puede leer `businesses_cafexis`); ahora usa `list_my_businesses_cafexis`.
- **Registro**: negocio y administrador se crean juntos en una transacción.
  Si el proyecto exige confirmar el correo, el negocio se termina de crear
  en el primer login.
- **Logos**: el bucket solo acepta PNG, JPG o WebP de hasta 2 MB.

### 14. Pedidos y permisos por rol (ya aplicada)

`migrations/0014_pedidos_y_permisos_por_rol_cafexis.sql`. No requiere
redesplegar Edge Functions; sí publicar el frontend del mismo commit (usa
las RPC nuevas y el estado `cancelado`).

Qué incluye:

- **Cobro en caja** (`confirm_order_payment_cafexis`): cualquier persona
  activa del negocio confirma que el cliente pagó un pedido "pendiente de
  pago" (por ejemplo, eligió efectivo en el catálogo, que ya no lo envía a
  Wompi) y puede corregir el método con el que pagó.
- **Cancelar pedidos** (`cancel_order_cafexis`; la 0016 amplía quién puede):
  cualquier pedido no entregado. Repone exactamente el inventario que
  descontó (según el historial de movimientos), guarda motivo, fecha y quién
  canceló, y anula el cobro en línea pendiente. Nuevo estado `cancelado`,
  fuera de las cifras de reportes, panel y consola.
- **Máquina de estados**: pendiente de pago → pedido → en preparación →
  listo → entregado, validada en la base de datos; cancelar solo con la RPC.
- **Permisos por rol en el servidor**: el barista vende (con la RPC, a
  precios del catálogo) y avanza pedidos, pero ya no puede editar
  inventario, productos, recetas, lotes, compras, proveedores, datos o logo
  del negocio, ni el total, el método de pago o las líneas de un pedido. El
  directorio de proveedores deja de ser visible y editable para los clientes
  finales.
- **Suscripción vencida**: `register_sale_cafexis` también bloquea la venta en
  el servidor.
- **Consola de plataforma**: ventas de hoy, 7 y 14 días sin pedidos no
  cobrados ni cancelados.

### 15. Fotos de producto

`migrations/0015_fotos_producto_cafexis.sql` crea el bucket público
`product-images` (máximo 5 MB; JPG, PNG o WebP) y sus políticas: las fotos las
ve cualquiera y solo las sube quien administra el negocio. Sin esta migración,
guardar un producto con foto falla con un error de Storage; el resto del
catálogo sigue funcionando.

Esta migración se llamó antes `0013_fotos_producto_cafexis.sql`. Si ya la
aplicaste con ese nombre, vuelve a ejecutarla: es segura de repetir y ajusta
los permisos a las reglas de la 0014.

### 16. Cancelación y avisos (ya aplicada)

`migrations/0016_cancelacion_y_avisos_cafexis.sql`. No requiere redesplegar
Edge Functions; sí publicar el frontend del mismo commit.

Qué incluye:

- **Quién cancela** (`cancel_order_cafexis`): el personal activo del negocio,
  incluido el barista, en cualquier pedido no entregado; el cliente, solo sus
  propios pedidos y mientras no hayan empezado a prepararse. Soporte sigue sin
  poder. El pedido nunca se borra.
- **Quién canceló**: `cancelled_by_side` dice si fue el cliente o el negocio.
  `cancelled_by` guarda la persona del negocio (queda vacío si fue el cliente).
- **Avisos** (`order_notifications_cafexis`): cada cancelación deja un aviso
  para el negocio y otro para el cliente, si pidió desde el catálogo. Se ven en
  la campana del panel y del catálogo. Solo los crea la base de datos; los
  avisos del negocio se comparten entre todo su personal, así que marcarlos
  como leídos aplica para todos.
- **Dónde se ven los cancelados**: en el historial del cliente y en
  **Reportes → Histórico de pedidos**. No aparecen como comandas en el
  dashboard ni en el tablero de Ventas, y no cuentan en las cifras de ventas.
  El dashboard solo muestra una alerta roja con las cancelaciones del día y
  quién las hizo; esa alerta no depende de si alguien ya abrió la campana.

### 17. Clientes invitados (pendiente de aplicar)

`migrations/0017_invitados_cafexis.sql`. No requiere redesplegar Edge
Functions. Además hay que activar **Authentication → Providers → Allow
anonymous sign-ins** en el panel de Supabase.

Qué incluye:

- **Continuar sin cuenta**: el cliente solo escribe su nombre y queda con una
  sesión anónima. Pide, ve sus pedidos, recibe avisos y cancela igual que con
  Google, pero su historial solo existe en ese dispositivo.
- **Registrar un negocio** (`register_business_cafexis`) ahora exige una cuenta
  real, para que un script no pueda abrir negocios sin límite con sesiones
  anónimas.
- Sin cuenta es más fácil enviar pedidos falsos, y cada pedido descuenta
  inventario hasta que el personal lo cancela. Antes de recibir negocios reales,
  activar el CAPTCHA en **Authentication → Attack Protection**.

### 18. Guías de preparación: videos y PDF por producto (pendiente de aplicar)

`migrations/0018_guias_preparacion_cafexis.sql`. No requiere redesplegar Edge
Functions; sí publicar el frontend del mismo commit. Sin la migración, la
pantalla **Guías de preparación** muestra un error y el resto sigue igual: el
tablero de Ventas y el catálogo simplemente no muestran el enlace.

Qué incluye:

- **Tabla `product_guides_cafexis`**: uno o varios materiales por producto
  (cualquier producto de venta, no solo bebidas), cada uno con título,
  descripción, tipo (video o PDF) y origen: archivo subido **o** enlace
  externo (YouTube, Vimeo, Google Drive…).
- **Quién hace qué**: todo el personal activo del negocio los consulta (el
  barista en `/preparacion` y desde cada comanda); solo el administrador o el
  supervisor técnico los suben, editan, borran y marcan como **disponibles
  para el cliente**. Soporte no escribe.
- **Cliente final**: `get_public_product_guides_cafexis` devuelve solo los
  materiales marcados como disponibles; en el catálogo aparece el botón
  "Cómo se prepara" bajo esos productos.
- **Bucket privado `product-guides`** (máximo 50 MB; PDF, MP4 o WebM). Los
  archivos se abren con URLs firmadas que vencen en 2 horas: un material
  interno nunca queda público, y al quitarle "disponible para el cliente"
  deja de poder abrirse desde fuera del negocio. Un trigger impide que una
  guía apunte a un producto o a un archivo de otro negocio.
- **Límite de 50 MB**: es el máximo por archivo del plan gratuito de
  Supabase. Para videos más pesados, súbelos a YouTube como "no listado" (o a
  Drive) y pega el enlace; en un plan pago se puede subir el límite en
  **Storage → Settings** y en la migración.

### 19. Planes de suscripción: Básica, Profesional y Premium (ya aplicada)

`migrations/0019_planes_suscripcion_cafexis.sql`. Requiere la 0018 (recrea
su función pública de guías). No requiere redesplegar Edge Functions; sí
publicar el frontend del mismo commit. El frontend funciona antes de aplicarla:
sin la migración, todo negocio se comporta como hoy (sistema completo) y la
página **Suscripción** muestra los planes de referencia.

Qué hace:

- **Tres planes** en `subscription_plans_cafexis`, cada uno con sus
  funciones (`features`) y límites (`limits`). El plan "Básico" de la 0012
  se renombra a **Básica** (mismo id) y se agregan **Profesional** y
  **Premium**. Precios de referencia: $ 0, $ 79.900 y $ 149.900 al mes
  ($ 799.000 y $ 1.499.000 al año); se cambian en la tabla.
- **Negocios existentes**: los que estaban en prueba o activos pasan a
  Premium para no perder nada de lo que ya usan; el supervisor técnico les
  asigna después su plan real en **Suscripción → Todos los negocios**. El
  negocio demo (Mi Cafetería) queda en **Premium activo sin vencimiento**.
- **Negocios nuevos**: 14 días de prueba en Premium. Al terminar la prueba
  o el período pago, el negocio **baja solo a Básica** y sigue operando (ya
  no se bloquea). Lo que pase de los límites no se borra: solo no se pueden
  crear más registros. Solo una cuenta **cancelada** queda bloqueada.
- **Verificación en el servidor**: `plan_permite_cafexis()` y
  `plan_limite_cafexis()` se revisan en triggers, así que no basta con
  saltarse la pantalla:
  - Pedidos desde el celular (`register_public_order_cafexis`): desde
    Profesional. En Básica el catálogo es solo menú.
  - Compras y proveedores, lotes de café y guías de preparación: desde
    Profesional. Las propuestas de compra automáticas no se generan en
    Básica (de lo contrario harían fallar la venta).
  - Reportes personalizados y factura DIAN: Premium (la factura también como
    complemento de Profesional: `addons = '{factura_dian}'`).
  - Color de marca: desde Profesional (en Básica, el panel y el catálogo
    usan el color de Cafexis; el guardado no se borra).
  - Topes de Básica: 2 usuarios del equipo (administradores y baristas
    activos más invitaciones pendientes), 20 productos y 30 insumos.
    Profesional: 6 usuarios.
  - Página pública del lote (QR) y "Cómo se prepara" en el catálogo:
    Premium; las RPC públicas no devuelven nada en otros planes.
- **Solo en pantalla**: el histórico de pedidos de 30 días de Básica, los
  reportes predefinidos y "más vendidos" en el dashboard (son lecturas de
  los propios datos del negocio).
- **Cambio de plan**: el administrador lo solicita desde **Suscripción**
  (se abre un caso de soporte con el plan y la forma de pago); el supervisor
  técnico lo asigna ahí mismo, con la fecha hasta la que está pago y el
  complemento de factura DIAN. El cobro recurrente con Wompi queda para
  cuando esté la cuenta de comercio.

Para cambiar un plan (por ejemplo, el precio o un límite) basta con editar
su fila; las claves de `features` y `limits` están documentadas al inicio
de la migración. Si cambias qué incluye cada plan, actualiza también el
cuadro de `src/components/plan/planCatalog.ts`, que es lo que ve el dueño.

### 20. Cambio de plan desde Suscripción (ya aplicada)

`migrations/0020_cambio_de_plan_cafexis.sql`. Requiere la 0019. No requiere
redesplegar Edge Functions; sí publicar el frontend del mismo commit. Sin la
migración, "Cambiar de plan" sigue funcionando a medias: el administrador
deja la solicitud como caso de soporte y el supervisor técnico cambia el plan
directamente.

Qué incluye:

- **Botón "Cambiar de plan"** en **Suscripción** (también "Cambiar a …" en
  cada tarjeta de plan). Se elige el plan y la forma de pago (mensual o
  anual) y se ve qué funciones se ganan o se pierden y cómo cambian los
  límites, con aviso si el negocio ya pasa de los límites del plan nuevo.
- **Bajar a Básica** (o a cualquier plan gratis): inmediato.
- **Plan pago pedido por el administrador**: queda como **solicitud
  pendiente** (`pending_plan_id`, `pending_billing_period`) y se abre un
  caso de soporte con el plan, la forma de pago y el precio. El negocio la ve
  en Suscripción y puede cancelarla; mientras tanto sigue en su plan.
- **Supervisor técnico**: aprueba o rechaza la solicitud desde Suscripción
  (en el negocio que opera o en **Todos los negocios**, columna
  "Solicitud"). Al aprobar, el plan queda pago por un mes o un año desde hoy
  (la fecha se puede ajustar en la tabla) y se deja constancia en el caso.
  También puede cambiar el plan de cualquier negocio al instante.
- RPC nuevas: `change_business_plan_cafexis(plan, forma de pago, negocio)` y
  `cancel_plan_change_cafexis(negocio)`. `get_business_plan_cafexis` ahora
  devuelve la forma de pago y la solicitud pendiente.

Cuando esté la cuenta de Wompi, el webhook del cobro hará lo mismo que
"Aprobar": llamar a `change_business_plan_cafexis` con el plan pendiente.

### 21. Panel del super usuario y códigos de promoción (pendiente de aplicar)

`migrations/0021_super_usuario_promociones_cafexis.sql`. Requiere 0001–0020.
No requiere redesplegar Edge Functions; sí publicar el frontend del mismo
commit. "Super usuario" es el rol `supervisor_tecnico`; soporte no ve nada
de esto. Sin la migración, el Dashboard del supervisor muestra un aviso para
aplicarla y Suscripción simplemente no muestra el campo del código.

Qué incluye:

- **Dashboard → Plataforma (super usuario)**, la vista por defecto del
  supervisor técnico (la otra pestaña, **Negocio**, es el dashboard del
  negocio que opera):
  - Resumen: negocios, usuarios activos, ingreso mensual estimado (plan
    efectivo con su descuento; el anual se reparte en 12) y lo que hay por
    atender (solicitudes de plan, planes vencidos o que vencen en 7 días,
    cuentas canceladas).
  - **Negocios y usuarios**: cada negocio con su suscripción completa, uso
    frente a los límites, clientes registrados, códigos usados y la lista de
    usuarios (rol, estado, último ingreso) e invitaciones pendientes.
    Búsqueda por negocio, usuario o correo, y filtros por plan y estado.
  - **Editar suscripción**: plan, estado, forma de pago, fin de la prueba,
    pago vigente hasta (+1 mes, +1 año, sin vencimiento), factura DIAN,
    descuento (% y hasta cuándo), y aprobar o rechazar la solicitud
    pendiente. Muestra con qué plan quedará operando el negocio.
  - **Aplicar código** a cualquier negocio.
  - **Códigos de promoción**: crear, editar, activar o desactivar, borrar
    los que nadie ha usado y ver qué negocios usaron cada uno.
  - **Planes**: nombre, descripción, precios, días de prueba, límites,
    funciones, recomendado y si está a la venta.
- **Suscripción** (administrador): "¿Tienes un código de promoción?", con el
  descuento vigente y los códigos que ya usó.
- Tablas nuevas: `promo_codes_cafexis` (solo el supervisor la lee y la
  escribe) y `promo_code_redemptions_cafexis` (cada canje; el negocio ve los
  suyos). Columnas nuevas en `business_subscriptions_cafexis`:
  `discount_percent`, `discount_ends_at` y `discount_promo_code_id`.
- RPC nuevas: `platform_subscriptions_overview_cafexis()` y
  `redeem_promo_code_cafexis(código, negocio)`. El supervisor ahora puede
  editar `subscription_plans_cafexis`.

Reglas de los códigos (las aplica la base de datos):

- Hay dos tipos. **Días gratis** de un plan pago: se aplican al instante, y
  si el negocio ya tiene ese plan vigente, los días se suman al final.
  **Descuento**: N % en un plan, o en cualquier plan pago, durante N meses.
  Mientras el cobro sea manual, el supervisor resta el descuento al cobrar;
  queda a la vista en su panel y en Suscripción.
- Cada código tiene fecha de vencimiento (después nadie lo puede usar, pero
  lo que ya se dio no se pierde) y, si quieres, un tope de usos. Cada
  negocio lo usa una sola vez.
- El administrador no puede canjear días de un plan menor al que ya tiene,
  ni días de otro plan si tiene un plan pago vigente (perdería lo pagado),
  ni un descuento si ya tiene uno vigente. En esos casos escribe a soporte.
  El supervisor sí puede aplicarlos.
- Un código que ya se usó no cambia su beneficio y no se borra: solo
  cambian su descripción, vencimiento, tope o si está activo.
- La Básica no se puede cobrar ni quitar de la venta, porque es el plan al
  que baja todo negocio cuando vence. Las funciones y los límites de un plan
  tienen que ser claves que el sistema conoce.

Si cambias funciones o límites de un plan, actualiza también los textos del
cuadro comparativo en `src/components/plan/planCatalog.ts`.

## Gestión de usuarios y roles (invitaciones)

Desde "Configuración" en el panel, un administrador (o el supervisor técnico)
puede invitar usuarios internos nuevos (administrador o barista) a su
negocio. Como `supabase.auth.signUp()` autenticaría como el usuario invitado
y cerraría la sesión de quien invita, este flujo usa
`supabase.auth.admin.inviteUserByEmail`, que solo funciona con la
**service_role key** — por eso vive en una Edge Function
(`functions/invite-user/`), nunca en el frontend.

### Desplegar la Edge Function (pendiente — necesario para que "Invitar usuario" funcione)

1. Instala la CLI de Supabase si no la tienes: `npm install -g supabase`.
2. Autentícate y enlaza el proyecto (si no lo hiciste ya para las migraciones):
   ```bash
   supabase login
   supabase link --project-ref <tu-project-ref>
   ```
3. Despliega la función:
   ```bash
   supabase functions deploy invite-user
   ```
4. Configúrale su variable de entorno secreta — **nunca la pongas en el
   repositorio ni me la compartas por mensaje**, solo en el panel de
   Supabase: **Project Settings → Edge Functions → invite-user → Secrets**,
   o por CLI:
   ```bash
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>
   ```
   La `service_role key` está en **Project Settings → API** (la misma
   pantalla donde está la anon key, más abajo, marcada como secreta).

Sin este despliegue, el botón "Invitar usuario" del panel mostrará un error
al intentar enviar la invitación (la función no existe todavía en tu
proyecto de Supabase).

### Qué hace cada pieza

- `user_invitations_cafexis`: registra cada invitación enviada, para
  mostrarla como "pendiente" en el panel hasta que la persona acepta.
- Un trigger sobre `auth.users` completa automáticamente el perfil
  (`app_users_cafexis`) apenas la persona invitada confirma su cuenta —
  no requiere ningún paso manual adicional.
- Solo `administrador` (de su propio negocio) o `supervisor_tecnico` pueden
  invitar, cambiar el rol de alguien o desactivarlo — reforzado con
  políticas RLS, no solo con la interfaz.
- Nadie puede cambiar su propio rol (ni un administrador puede
  autodegradarse por error), salvo el supervisor técnico.

## Frontend ya conectado a Supabase

El frontend ya no usa datos de ejemplo en memoria: `src/services/api/*Service.ts`
consulta directamente las tablas `*_cafexis` a través de
`src/services/api/supabaseClient.ts`, y `authService.ts` usa Supabase Auth
(`signUp` / `signInWithPassword`) en lugar de `localStorage`. Las credenciales
viven en un `.env` local (no versionado) con `VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY` — ver `.env.example`.

Se verificó por separado (llamada REST directa) que las políticas de RLS
responden correctamente: sin sesión autenticada, `businesses_cafexis` no
devuelve ninguna fila aunque exista el negocio demo, que es el comportamiento
esperado — las únicas tablas/funciones visibles sin sesión son las públicas
de la Fase 5 (ver paso 10). El login end-to-end con la cuenta demo ya está
probado y funciona (ver paso 4); registrar un negocio nuevo desde
`/registro` también funciona sin pasos manuales.
